"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const RouteHistory = require("../route-history.js");
const RouteOrder = require("../route-order.js");
const RoutePlanDays = require("../route-plan-days.js");
const GoogleBrowser = require("../google-route-browser.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const browserSource = fs.readFileSync(path.join(__dirname, "..", "google-route-browser.js"), "utf8");

const ids = new Set(["s1", "s2", "s3", "new"]);

function memoryStorage() {
    const values = new Map();
    let writes = 0;
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { writes++; values.set(key, String(value)); },
        count() { return writes; },
    };
}

function context(date = "2026-11-20") {
    return {
        routeDate: date,
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function setup() {
    const storage = memoryStorage();
    const seeded = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: context(),
        google: {
            routeIds: ["s1", "s2", "s3"],
            sourceUpdatedAt: "2026-11-20T14:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { s1: ["ORDER-1"], s2: ["ORDER-2"] },
            gigIdsByStopId: { s3: ["GIG-3"] },
        },
        basic: {
            routeIds: ["s3", "s2", "s1"],
            sourceUpdatedAt: "2026-11-20T14:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: { s1: ["ORDER-1"], s2: ["ORDER-2"] },
            gigIdsByStopId: { s3: ["GIG-3"] },
        },
    }, ids);
    RouteHistory.writeRouteHistory(storage, seeded, ids);
    const current = () => RouteHistory.readRouteHistory(storage, ids);
    const expected = current();
    const insertion = (override = {}) => ({
        planId: expected.activePlan.planId,
        planRevision: expected.activePlan.revision,
        dayId: expected.activePlan.activeDayId,
        originalIds: ["s1", "s2", "s3"],
        newStopId: "new",
        orderedIds: ["s1", "new", "s2", "s3"],
        ...override,
    });
    return { storage, current, insertion };
}

test("one inserted saved address preserves old order, exact work IDs, Basic and route return, with a single write", () => {
    const harness = setup();
    const before = harness.current();
    assert.equal(RouteHistory.canInsertSavedStop(before, "new"), true);
    const beforeWrites = harness.storage.count();
    const result = RouteHistory.commitGoogleInsertion(
        harness.storage, harness.insertion(), ids,
    );
    assert.equal(harness.storage.count(), beforeWrites + 1);
    assert.deepEqual(result.google.routeIds, ["s1", "new", "s2", "s3"]);
    assert.equal(result.google.optimizationStatus, "google_optimized");
    assert.equal(result.google.schedule, null);
    assert.deepEqual(result.basic, before.basic);
    assert.deepEqual(result.google.orderIdsByStopId.s1, ["ORDER-1"]);
    assert.deepEqual(result.google.orderIdsByStopId.s2, ["ORDER-2"]);
    assert.deepEqual(result.google.gigIdsByStopId.s3, ["GIG-3"]);
    assert.equal(result.activePlan.standaloneStops.some((x) => x.stopId === "new"), true);
    const stops = {
        s1: { id: "s1", address: "100 First St" },
        s2: { id: "s2", address: "200 Second St" },
        s3: { id: "s3", address: "300 Third St" },
        new: { id: "new", address: "150 New Ave" },
    };
    const artifact = RouteOrder.buildActiveDayWorkbookRouteOrder({
        routeSlot: "google",
        routeHistory: harness.current(),
        routeStops: result.google.routeIds.map((id) => stops[id]),
        now: "2026-11-20T18:00:00.000Z",
    });
    assert.deepEqual(artifact.stops.map((s) => s.address), [
        "100 First St", "150 New Ave", "200 Second St", "300 Third St",
    ]);
    assert.deepEqual(artifact.stops[0].orderIds, ["ORDER-1"]);
    assert.deepEqual(artifact.stops[1].orderIds, []);
    assert.deepEqual(artifact.stops[3].gigIds, ["GIG-3"]);
});

test("insertion is rejected atomically if Google reorders old stops or repeats the new one", () => {
    const h = setup();
    const before = h.storage.getItem(RouteHistory.STORAGE_KEY);
    for (const orderedIds of [
        ["s2", "new", "s1", "s3"],
        ["s1", "new", "s2", "new"],
        ["s1", "s2", "s3"],
    ]) {
        assert.throws(
            () => RouteHistory.commitGoogleInsertion(h.storage, h.insertion({ orderedIds }), ids),
            /order|route was changed/i,
        );
        assert.equal(h.storage.getItem(RouteHistory.STORAGE_KEY), before);
    }
});

test("concurrent route editing and a changed active Day reject stale results without overwriting state", () => {
    const h = setup();
    const old = h.insertion();
    const changed = RouteHistory.replaceRoute(h.current(), "google", ["s3", "s2", "s1"], ids);
    RouteHistory.writeRouteHistory(h.storage, changed, ids);
    const afterChange = h.storage.getItem(RouteHistory.STORAGE_KEY);
    assert.throws(
        () => RouteHistory.commitGoogleInsertion(h.storage, old, ids),
        /route changed during calculation/,
    );
    assert.equal(h.storage.getItem(RouteHistory.STORAGE_KEY), afterChange);
});

test("a stop assigned to another Day is not eligible for insertion", () => {
    const h = setup();
    const current = h.current();
    const plan = RoutePlanDays.planFromAssignments({
        plan: current.activePlan,
        dayContexts: RoutePlanDays.buildDayContexts(context(), 2),
        assignmentByStopId: {
            s1: "2026-11-20",
            s2: "2026-11-21",
            s3: "2026-11-20",
        },
        activeRouteDate: "2026-11-20",
        replaceIdentity: true,
        identitySeed: "insert-fixture",
        now: "2026-11-20T18:00:00.000Z",
    });
    const second = plan.days[1];
    const newSecond = {
        ...second,
        google: {
            ...(second.google || {}),
            routeIds: [...(second.google?.routeIds || []), "new"],
        },
    };
    const otherDayPlan = RouteHistory.normalizeRouteHistory({
        version: 7,
        activePlan: {
            ...plan,
            standaloneStops: [
                ...plan.standaloneStops,
                { stopId: "new", assignedDate: "2026-11-21", lockedDay: true },
            ],
            days: [plan.days[0], newSecond],
        },
        pending: null,
    }, ids);
    assert.equal(RouteHistory.canInsertSavedStop(otherDayPlan, "new"), false);
});

test("insertion with a valid timed Google schedule saves it in the same atomic route write", () => {
    const h = setup();
    const ordered = h.insertion().orderedIds;
    const service = { s1: 300, s2: 300, s3: 300, new: 0 };
    const schedule = {
        basisKey: GoogleBrowser.buildScheduleBasisKey({
            routeIds: ordered,
            home: { address: "Home", latitude: 35, longitude: -99 },
            serviceByStopId: service,
            timing: {
                departureTime: "2026-11-20T14:00:00Z",
                homeByTime: "2026-11-20T23:00:00Z",
            },
        }),
        vehicleStartTime: "2026-11-20T14:00:00Z",
        vehicleEndTime: "2026-11-20T16:00:00Z",
        travelDurationSeconds: 3600,
        totalServiceDurationSeconds: 900,
        waitDurationSeconds: 0,
        visits: ordered.map((stopId, index) => ({
            stopId, startTime: `2026-11-20T1${4 + Math.floor(index / 2)}:${index % 2 ? "30" : "00"}:00Z`,
        })),
    };
    const before = h.storage.count();
    const result = RouteHistory.commitGoogleInsertion(
        h.storage, h.insertion({ schedule }), ids,
    );
    assert.equal(h.storage.count(), before + 1);
    assert.deepEqual(result.google.schedule.visits.map((v) => v.stopId), ordered);
    assert.equal(result.basic.schedule, null);
    assert.equal(h.current().google.schedule.basisKey, schedule.basisKey);
});

test("the existing Google optimize action is separate and the new saved-stop control is in Route Builder", () => {
    assert.match(html, /id="googleOptimizeRoute"/);
    assert.match(html, /id="googleInsertStopChoice"/);
    assert.match(html, /id="googleInsertStop"/);
    assert.ok(html.indexOf('id="googleInsertStopChoice"') < html.indexOf('id="routeOptimizeFeedback"'));
    assert.match(app, /function googleInsertionContext\(newStopId\)/);
    assert.match(app, /commitGoogleInsertion\(/);
    assert.match(app, /function renderGoogleInsertionChoices\(/);
    assert.match(browserSource, /insertionStopId: newStopId/);
    assert.match(browserSource, /assertPreparedContextCurrent\(prepared, currentPrepared\)/);
    assert.match(browserSource, /newStopButton\.addEventListener\("click"/);
});
