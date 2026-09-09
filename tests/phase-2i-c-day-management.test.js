"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RoutePlanDays = require("../route-plan-days.js");
const RouteHistory = require("../route-history.js");
const Backup = require("../backup.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
    };
}

function dayContext(routeDate = "2026-09-08") {
    return {
        routeDate,
        departureTime: "08:00",
        preferredFinishTime: "10:00",
        homeByTime: "12:00",
        timeZone: "America/Chicago",
    };
}

function oneDayPlan() {
    return RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: dayContext(),
        google: {
            routeIds: ["s1", "s2", "s3", "s4"],
            sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                s1: ["ORDER-A", "ORDER-B"],
                s2: ["ORDER-C"],
            },
            gigIdsByStopId: { s3: ["GIG-1"] },
            gigManagedStopIds: ["s3"],
        },
        basic: {
            routeIds: ["s4", "s3", "s2", "s1"],
            sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: {
                s1: ["ORDER-A", "ORDER-B"],
                s2: ["ORDER-C"],
            },
            gigIdsByStopId: { s3: ["GIG-1"] },
            gigManagedStopIds: ["s3"],
        },
    }).activePlan;
}

function planningRecords() {
    return [
        {
            schemaVersion: 1,
            kind: "workbook",
            workItemId: "ORDER-A",
            serviceMinutes: 60,
            assignedDate: null,
            lockedDay: false,
            revision: 1,
            updatedAt: "2026-09-08T12:00:00.000Z",
        },
        {
            schemaVersion: 1,
            kind: "workbook",
            workItemId: "ORDER-B",
            serviceMinutes: 60,
            assignedDate: null,
            lockedDay: false,
            revision: 1,
            updatedAt: "2026-09-08T12:00:00.000Z",
        },
        {
            schemaVersion: 1,
            kind: "workbook",
            workItemId: "ORDER-C",
            serviceMinutes: 60,
            assignedDate: "2026-09-09",
            lockedDay: true,
            revision: 1,
            updatedAt: "2026-09-08T12:00:00.000Z",
        },
    ];
}

function savedStops() {
    return [
        { id: "s1", address: "One", latitude: 35.0, longitude: -99.0 },
        { id: "s2", address: "Two", latitude: 35.1, longitude: -98.8 },
        { id: "s3", address: "Three", latitude: 35.2, longitude: -98.6 },
        { id: "s4", address: "Four", latitude: null, longitude: null },
    ];
}

test("2I-C builds consecutive per-Day Workday contexts without UTC date drift", () => {
    const contexts = RoutePlanDays.buildDayContexts(dayContext(), 3);
    assert.deepEqual(
        contexts.map((context) => context.routeDate),
        ["2026-09-08", "2026-09-09", "2026-09-10"],
    );
    assert.equal(contexts[1].departureTime, "08:00");
    assert.equal(contexts[1].preferredFinishTime, "10:00");
    assert.equal(contexts[1].homeByTime, "12:00");
    assert.equal(contexts[1].timeZone, "America/Chicago");
});

test("automatic Day count is a deterministic minimum from known service and never counts unknown gig duration as zero", () => {
    const result = RoutePlanDays.recommendDayCount({
        plan: oneDayPlan(),
        planningRecords: planningRecords(),
        savedStops: savedStops(),
        baseDayContext: dayContext(),
    });
    assert.equal(result.dayCount, 2);
    assert.equal(result.knownServiceMinutes, 180);
    assert.deepEqual(result.unknownStopIds, ["s3"]);
    assert.equal(result.incomplete, true);
});

test("local assignment is deterministic, keeps same-address exact work together, and respects a locked Day", () => {
    const plan = oneDayPlan();
    const contexts = RoutePlanDays.buildDayContexts(dayContext(), 2);
    const first = RoutePlanDays.assignStopGroups({
        plan,
        planningRecords: planningRecords(),
        savedStops: savedStops(),
        dayContexts: contexts,
    });
    const second = RoutePlanDays.assignStopGroups({
        plan,
        planningRecords: planningRecords(),
        savedStops: savedStops(),
        dayContexts: contexts,
    });

    assert.deepEqual(first, second);
    assert.equal(first.assignmentByStopId.s2, "2026-09-09");
    assert.equal(first.assignmentByStopId.s1, "2026-09-08");
    assert.equal(
        first.unassigned.some(
            (item) => item.stopId === "s3" && item.reason === "unknown_service",
        ),
        true,
    );
});

test("actual due date can prioritize manual work without inventing workbook due dates", () => {
    const plan = oneDayPlan();
    const records = [
        ...planningRecords(),
        {
            schemaVersion: 1,
            kind: "gig",
            workItemId: "GIG-1",
            serviceMinutes: 30,
            assignedDate: null,
            lockedDay: false,
            revision: 1,
            updatedAt: "2026-09-08T12:00:00.000Z",
        },
    ];
    const result = RoutePlanDays.assignStopGroups({
        plan,
        planningRecords: records,
        savedStops: savedStops(),
        dayContexts: RoutePlanDays.buildDayContexts(dayContext(), 2),
        workItemDetails: {
            "gig:GIG-1": { dueDate: "2026-09-08" },
        },
    });
    assert.equal(result.assignmentByStopId.s3, "2026-09-08");
});

test("building a multi-day replacement preserves exact work pool and creates selected-Day Google/Basic candidates with no schedule confidence", () => {
    const plan = oneDayPlan();
    const contexts = RoutePlanDays.buildDayContexts(dayContext(), 2);
    const assignment = RoutePlanDays.assignStopGroups({
        plan,
        planningRecords: planningRecords(),
        savedStops: savedStops(),
        dayContexts: contexts,
    });
    const nextPlanning = RoutePlanDays.upsertPlanningAssignments(
        planningRecords(),
        plan,
        assignment.assignmentByStopId,
        { now: "2026-09-08T13:00:00.000Z" },
    );
    const nextPlan = RoutePlanDays.planFromAssignments({
        plan,
        dayContexts: contexts,
        assignmentByStopId: assignment.assignmentByStopId,
        activeRouteDate: "2026-09-08",
        replaceIdentity: true,
        identitySeed: "phase-2i-c-test",
        now: "2026-09-08T13:00:00.000Z",
    });

    assert.notEqual(nextPlan.planId, plan.planId);
    assert.equal(nextPlan.days.length, 2);
    assert.deepEqual(nextPlan.workItems, plan.workItems);
    assert.equal(nextPlan.days[0].google.optimizationStatus, "not_optimized");
    assert.equal(nextPlan.days[0].google.schedule, null);
    assert.equal(nextPlan.days[0].basic.schedule, null);
    assert.equal(nextPlan.days[1].google.routeIds.includes("s2"), true);
    assert.equal(
        nextPlan.days.some((day) => day.google?.routeIds.includes("s3")),
        false,
    );
    assert.equal(
        nextPlanning.find((record) => record.workItemId === "ORDER-A").assignedDate,
        nextPlanning.find((record) => record.workItemId === "ORDER-B").assignedDate,
    );
});

test("manual move moves all exact work at one physical stop together and lock uses existing planning metadata", () => {
    const plan = oneDayPlan();
    const contexts = RoutePlanDays.buildDayContexts(dayContext(), 2);
    const initialAssignment = {
        s1: "2026-09-08",
        s2: "2026-09-09",
        s4: "2026-09-08",
    };
    const initialPlanning = RoutePlanDays.upsertPlanningAssignments(
        planningRecords(),
        plan,
        initialAssignment,
        { now: "2026-09-08T13:00:00.000Z" },
    );
    const multi = RoutePlanDays.planFromAssignments({
        plan,
        dayContexts: contexts,
        assignmentByStopId: initialAssignment,
        replaceIdentity: true,
        identitySeed: "move-test",
        now: "2026-09-08T13:00:00.000Z",
    });
    const moved = RoutePlanDays.moveStop({
        plan: multi,
        planningRecords: initialPlanning,
        stopId: "s1",
        routeDate: "2026-09-09",
        now: "2026-09-08T14:00:00.000Z",
    });

    for (const workItemId of ["ORDER-A", "ORDER-B"]) {
        assert.equal(
            moved.planningRecords.find((record) => record.workItemId === workItemId)
                .assignedDate,
            "2026-09-09",
        );
    }
    assert.equal(moved.plan.days[1].google.routeIds.includes("s1"), true);
    assert.equal(moved.plan.days[0].google?.routeIds.includes("s1") || false, false);

    const locked = RoutePlanDays.lockStop({
        plan: moved.plan,
        planningRecords: moved.planningRecords,
        stopId: "s1",
        locked: true,
        now: "2026-09-08T15:00:00.000Z",
    });
    for (const workItemId of ["ORDER-A", "ORDER-B"]) {
        assert.equal(
            locked.planningRecords.find((record) => record.workItemId === workItemId)
                .lockedDay,
            true,
        );
    }
});

test("locked work outside the requested Day range is not silently moved or cleared", () => {
    const plan = oneDayPlan();
    const records = planningRecords().map((record) =>
        record.workItemId === "ORDER-C"
            ? { ...record, assignedDate: "2026-09-12", lockedDay: true }
            : record,
    );
    const result = RoutePlanDays.assignStopGroups({
        plan,
        planningRecords: records,
        savedStops: savedStops(),
        dayContexts: RoutePlanDays.buildDayContexts(dayContext(), 2),
    });
    assert.equal(
        result.unassigned.some(
            (item) => item.stopId === "s2" && item.reason === "locked_outside_plan",
        ),
        true,
    );
    const next = RoutePlanDays.upsertPlanningAssignments(
        records,
        plan,
        result.assignmentByStopId,
        { now: "2026-09-08T16:00:00.000Z" },
    );
    const locked = next.find((record) => record.workItemId === "ORDER-C");
    assert.equal(locked.assignedDate, "2026-09-12");
    assert.equal(locked.lockedDay, true);
});

test("active Day selection changes only active plan context and increments plan revision", () => {
    const plan = oneDayPlan();
    const multi = RoutePlanDays.planFromAssignments({
        plan,
        dayContexts: RoutePlanDays.buildDayContexts(dayContext(), 2),
        assignmentByStopId: { s1: "2026-09-08", s2: "2026-09-09", s4: "2026-09-08" },
        replaceIdentity: true,
        identitySeed: "active-day",
        now: "2026-09-08T13:00:00.000Z",
    });
    const selected = RoutePlanDays.activateDay(
        multi,
        multi.days[1].dayId,
        { now: "2026-09-08T14:00:00.000Z" },
    );
    assert.equal(selected.activeDayId, multi.days[1].dayId);
    assert.equal(selected.revision, multi.revision + 1);
    assert.deepEqual(selected.workItems, multi.workItems);
    assert.deepEqual(selected.days.map((day) => day.google), multi.days.map((day) => day.google));
});

test("route-history v7 and backup v5 preserve a multi-day plan and pending workbook route", () => {
    const storage = memoryStorage();
    const baseHistory = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: dayContext(),
        google: { routeIds: ["s1", "s2"] },
        basic: { routeIds: ["s2", "s1"] },
        pending: {
            routeIds: ["s4"],
            sourceUpdatedAt: "2026-09-08T15:00:00.000Z",
        },
    }, new Set(["s1", "s2", "s4"]));
    const plan = RoutePlanDays.planFromAssignments({
        plan: baseHistory.activePlan,
        dayContexts: RoutePlanDays.buildDayContexts(dayContext(), 2),
        assignmentByStopId: { s1: "2026-09-08", s2: "2026-09-09" },
        replaceIdentity: true,
        identitySeed: "persist",
        now: "2026-09-08T16:00:00.000Z",
    });
    const written = RouteHistory.writeRouteHistory(storage, {
        version: 7,
        activePlan: plan,
        pending: baseHistory.pending,
    }, new Set(["s1", "s2", "s4"]));
    assert.equal(written.activePlan.days.length, 2);
    assert.deepEqual(written.pending.routeIds, ["s4"]);

    const backup = Backup.createBackup({
        home: { address: "Home" },
        stops: [
            { id: "s1", address: "One" },
            { id: "s2", address: "Two" },
            { id: "s4", address: "Four" },
        ],
        routes: written,
    });
    assert.equal(backup.backupVersion, 5);
    assert.equal(backup.routes.activePlan.days.length, 2);
    const restored = Backup.parseBackup(JSON.stringify(backup));
    assert.equal(restored.routes.activePlan.days.length, 2);
    assert.deepEqual(restored.routes.pending.routeIds, ["s4"]);
});

test("2I-C Build Route controls are bounded, load before app.js, and contain no automatic Google path", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const controls = fs.readFileSync(
        path.join(__dirname, "..", "route-plan-controls.js"),
        "utf8",
    );
    const pure = fs.readFileSync(
        path.join(__dirname, "..", "route-plan-days.js"),
        "utf8",
    );

    for (const id of [
        "routePlanControls",
        "routePlanDaySelector",
        "routePlanDayCount",
        "routePlanAutoDays",
        "routePlanBuildDays",
        "routePlanAssignDays",
        "routePlanAssignmentList",
        "routePlanStatus",
    ]) {
        assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
    }
    assert.ok(html.indexOf("route-plan-days.js?v=1.0.0") < html.indexOf("route-history.js?v=7.0.0"));
    assert.ok(html.indexOf("route-plan-controls.js?v=1.0.0") < html.indexOf("app.js?v=3.33.0"));
    assert.doesNotMatch(controls, /fetch\s*\(/);
    assert.doesNotMatch(controls, /FMRGoogleRouteBrowser/);
    assert.doesNotMatch(pure, /fetch\s*\(/);
    assert.doesNotMatch(pure, /FMRGoogleRouteBrowser/);
    assert.equal((html.match(/data-page="(?:home|import|addresses|route|settings)"/g) || []).length, 5);
});
