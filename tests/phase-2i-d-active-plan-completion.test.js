"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RoutePlan = require("../route-plan.js");
const RoutePlanDays = require("../route-plan-days.js");
const RouteHistory = require("../route-history.js");
const Backup = require("../backup.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        raw(key) { return values.get(key); },
    };
}

function dayContext(date = "2026-09-09") {
    return {
        routeDate: date,
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function schedule(routeIds) {
    return {
        basisKey: "basis-2i-d",
        vehicleStartTime: "2026-09-09T13:00:00Z",
        vehicleEndTime: "2026-09-09T15:00:00Z",
        travelDurationSeconds: 1800,
        totalServiceDurationSeconds: 1800,
        waitDurationSeconds: 0,
        visits: routeIds.map((stopId, index) => ({
            stopId,
            startTime: `2026-09-09T13:${String(index * 20 + 10).padStart(2, "0")}:00Z`,
        })),
    };
}

function snapshot(routeIds, orderIdsByStopId = {}, gigIdsByStopId = {}, extra = {}) {
    return {
        routeIds,
        sourceUpdatedAt: "2026-09-09T12:00:00.000Z",
        optimizationStatus: "not_optimized",
        orderIdsByStopId,
        workbookPayByStopId: {},
        gigIdsByStopId,
        gigManagedStopIds: [],
        schedule: null,
        ...extra,
    };
}

function sharedPlan() {
    return RoutePlan.normalizeRoutePlan({
        schemaVersion: 1,
        planId: "plan-2id",
        revision: 3,
        updatedAt: "2026-09-09T12:00:00.000Z",
        activeDayId: "day-1",
        workItems: [
            { kind: "workbook", workItemId: "O-1", stopId: "s1" },
            { kind: "workbook", workItemId: "O-2", stopId: "s1" },
            { kind: "gig", workItemId: "G-1", stopId: "s1" },
            { kind: "workbook", workItemId: "O-3", stopId: "s2" },
        ],
        standaloneStops: [],
        days: [{
            dayId: "day-1",
            revision: 2,
            updatedAt: "2026-09-09T12:00:00.000Z",
            dayContext: dayContext(),
            google: snapshot(
                ["s1", "s2"],
                { s1: ["O-1", "O-2"], s2: ["O-3"] },
                { s1: ["G-1"] },
                { optimizationStatus: "google_optimized", schedule: schedule(["s1", "s2"]) },
            ),
            basic: snapshot(
                ["s2", "s1"],
                { s1: ["O-1", "O-2"], s2: ["O-3"] },
                { s1: ["G-1"] },
                { optimizationStatus: "basic_optimized" },
            ),
        }],
    });
}

function planning() {
    return [
        { kind: "workbook", workItemId: "O-1", serviceMinutes: 10, assignedDate: "2026-09-09", lockedDay: false, revision: 1, updatedAt: "2026-09-09T12:00:00.000Z" },
        { kind: "workbook", workItemId: "O-2", serviceMinutes: 10, assignedDate: "2026-09-09", lockedDay: false, revision: 1, updatedAt: "2026-09-09T12:00:00.000Z" },
        { kind: "gig", workItemId: "G-1", serviceMinutes: 15, assignedDate: "2026-09-09", lockedDay: false, revision: 1, updatedAt: "2026-09-09T12:00:00.000Z" },
        { kind: "workbook", workItemId: "O-3", serviceMinutes: 20, assignedDate: "2026-09-09", lockedDay: false, revision: 1, updatedAt: "2026-09-09T12:00:00.000Z" },
    ];
}

test("legacy/current Route Plan v1 stays compatible when no completion state exists", () => {
    const current = sharedPlan();
    assert.equal(current.schemaVersion, 1);
    assert.equal(Object.hasOwn(current.days[0], "completedWorkItems"), false);
    assert.equal(Object.hasOwn(current.days[0], "completedStandaloneStops"), false);
    assert.equal(RoutePlan.remainingPlanWorkItems(current).length, 4);
});

test("Done completion records every exact identity at one physical stop and removes that stop from both Day routes", () => {
    const completedAt = "2026-09-09T14:30:00.000Z";
    const next = RoutePlan.completeActiveDayStop(sharedPlan(), "s1", { completedAt });
    const day = next.days[0];

    assert.deepEqual(
        day.completedWorkItems.map((item) => `${item.kind}:${item.workItemId}`).sort(),
        ["gig:G-1", "workbook:O-1", "workbook:O-2"],
    );
    assert.ok(day.completedWorkItems.every((item) => item.stopId === "s1" && item.completedAt === completedAt));
    assert.deepEqual(day.google.routeIds, ["s2"]);
    assert.deepEqual(day.basic.routeIds, ["s2"]);
    assert.equal(day.google.schedule, null);
    assert.equal(next.workItems.length, 4, "completion identity must not delete the exact work pool");
    assert.equal(next.revision, 4);
    assert.equal(day.revision, 3);
});

test("route-only physical stop completion is retained without inventing a work identity", () => {
    const plan = RoutePlan.normalizeRoutePlan({
        schemaVersion: 1,
        planId: "standalone-plan",
        revision: 1,
        updatedAt: "2026-09-09T12:00:00.000Z",
        activeDayId: "day-1",
        workItems: [],
        standaloneStops: [{ stopId: "solo", assignedDate: "2026-09-09", lockedDay: false }],
        days: [{
            dayId: "day-1",
            revision: 1,
            updatedAt: "2026-09-09T12:00:00.000Z",
            dayContext: dayContext(),
            google: snapshot(["solo"]),
            basic: snapshot(["solo"]),
        }],
    });
    const next = RoutePlan.completeActiveDayStop(plan, "solo", { completedAt: "2026-09-09T14:00:00.000Z" });
    assert.deepEqual(next.days[0].completedStandaloneStops, [
        { stopId: "solo", completedAt: "2026-09-09T14:00:00.000Z" },
    ]);
    assert.deepEqual(next.days[0].google.routeIds, []);
    assert.equal(next.workItems.length, 0);
});

test("completed work is excluded from local reassignment and cannot resurrect inside the same active plan", () => {
    const completed = RoutePlan.completeActiveDayStop(sharedPlan(), "s1", {
        completedAt: "2026-09-09T14:30:00.000Z",
    });
    const contexts = [dayContext()];
    const assigned = RoutePlanDays.assignStopGroups({
        plan: completed,
        planningRecords: planning(),
        savedStops: [{ id: "s1" }, { id: "s2" }],
        dayContexts: contexts,
    });
    assert.deepEqual(assigned.groups.map((group) => group.stopId), ["s2"]);

    const rebuilt = RoutePlanDays.planFromAssignments({
        plan: completed,
        dayContexts: contexts,
        assignmentByStopId: assigned.assignmentByStopId,
        activeRouteDate: "2026-09-09",
        now: "2026-09-09T15:00:00.000Z",
        replaceIdentity: false,
    });
    assert.equal(rebuilt.days[0].completedWorkItems.length, 3);
    assert.equal(rebuilt.days[0].google.routeIds.includes("s1"), false);
    assert.equal(RoutePlan.planWorkItemsForDate(rebuilt, planning(), "2026-09-09").some((item) => item.stopId === "s1"), false);
});

test("deliberate active-plan replacement purges temporary completion state without resurrecting completed work", () => {
    const completed = RoutePlan.completeActiveDayStop(sharedPlan(), "s1", {
        completedAt: "2026-09-09T14:30:00.000Z",
    });
    const replacement = RoutePlanDays.planFromAssignments({
        plan: completed,
        dayContexts: [dayContext()],
        assignmentByStopId: { s1: "2026-09-09", s2: "2026-09-09" },
        activeRouteDate: "2026-09-09",
        now: "2026-09-09T15:00:00.000Z",
        replaceIdentity: true,
    });
    assert.notEqual(replacement.planId, completed.planId);
    assert.equal(replacement.workItems.some((item) => item.stopId === "s1"), false);
    assert.equal(Object.hasOwn(replacement.days[0], "completedWorkItems"), false);
    assert.deepEqual(replacement.days[0].google.routeIds, ["s2"]);
});

test("route-history persists completion canonically and backup v5 round-trips it", () => {
    const storage = memoryStorage();
    const validIds = new Set(["s1", "s2"]);
    let history = RouteHistory.writeRouteHistory(storage, {
        version: 7,
        activePlan: sharedPlan(),
        pending: snapshot(["s2"], { s2: ["PENDING"] }),
    }, validIds);
    history = RouteHistory.completeActivePlanStop(history, "s1", validIds, "2026-09-09T14:30:00.000Z");
    history = RouteHistory.writeRouteHistory(storage, history, validIds);

    assert.deepEqual(history.google.routeIds, ["s2"]);
    assert.deepEqual(history.basic.routeIds, ["s2"]);
    assert.equal(history.activePlan.days[0].completedWorkItems.length, 3);
    assert.deepEqual(history.pending.routeIds, ["s2"]);

    const raw = JSON.parse(storage.raw(RouteHistory.STORAGE_KEY));
    assert.equal(raw.activePlan.days[0].completedWorkItems.length, 3);
    const backup = Backup.createBackup({
        home: { address: "Home" },
        stops: [{ id: "s1", address: "A" }, { id: "s2", address: "B" }],
        routes: history,
    });
    const restored = Backup.parseBackup(JSON.stringify(backup));
    assert.equal(restored.routes.activePlan.days[0].completedWorkItems.length, 3);
    assert.deepEqual(restored.routes.google.routeIds, ["s2"]);
});

test("stale completion writes fail closed and completed identities remap with their physical stop", () => {
    const storage = memoryStorage();
    const validIds = new Set(["s1", "s2"]);
    const original = RouteHistory.writeRouteHistory(storage, { version: 7, activePlan: sharedPlan(), pending: null }, validIds);
    const stale = original;
    const completed = RouteHistory.completeActivePlanStop(original, "s1", validIds, "2026-09-09T14:30:00.000Z");
    const written = RouteHistory.writeRouteHistory(storage, completed, validIds);
    assert.throws(() => RouteHistory.writeRouteHistory(storage, stale, validIds), /revision conflict/);

    const remapped = RouteHistory.remapRouteStopIds(
        written,
        { s1: "kept" },
        new Set(["kept", "s2"]),
    );
    assert.ok(remapped.activePlan.days[0].completedWorkItems.every((item) => item.stopId === "kept"));
    assert.ok(remapped.activePlan.workItems.filter((item) => item.workItemId !== "O-3").every((item) => item.stopId === "kept"));
});

test("removing a completed manual gig removes its temporary completion identity too", () => {
    const validIds = new Set(["gstop"]);
    let history = RouteHistory.normalizeRouteHistory({
        google: snapshot(["gstop"], {}, { gstop: ["G-ONLY"] }),
        basic: snapshot(["gstop"], {}, { gstop: ["G-ONLY"] }),
    }, validIds);
    history = RouteHistory.completeActivePlanStop(history, "gstop", validIds, "2026-09-09T14:30:00.000Z");
    history = RouteHistory.setGigRouteMembership(history, { id: "G-ONLY", stopId: "gstop" }, false, validIds);
    assert.equal(history.activePlan.workItems.some((item) => item.workItemId === "G-ONLY"), false);
    assert.equal((history.activePlan.days[0].completedWorkItems || []).length, 0);
});

test("app wiring completes through the active-plan owner and replacement warnings disclose temporary completion purge", () => {
    const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
    const controls = fs.readFileSync(path.join(__dirname, "..", "route-plan-controls.js"), "utf8");
    assert.match(app, /completeActivePlanStop\(routeHistory, currentStopId, savedJobIds\(\)/);
    assert.doesNotMatch(app, /routeIds = nextRouteIds;\s*persistActiveRoute\(/);
    assert.match(app, /temporary completion progress/i);
    assert.match(controls, /temporary completion progress/i);
    assert.match(controls, /Google will NOT be called automatically/);
});
