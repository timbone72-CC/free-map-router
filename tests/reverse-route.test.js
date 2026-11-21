"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RouteHistory = require("../route-history.js");
const RouteOrder = require("../route-order.js");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const start = app.indexOf("function reverseSelectedRoute() {");
const end = app.indexOf("\nfunction ", start + 1);
assert.ok(start >= 0 && end > start, "route reversal must be an app-owned action");
const actionSource = app.slice(start, end);

function setup() {
    const validIds = new Set(["s1", "s2", "s3"]);
    const storageData = new Map();
    const storage = {
        getItem(key) { return storageData.get(key) || null; },
        setItem(key, value) { storageData.set(key, value); },
    };
    let state = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: {
            routeDate: "2026-11-20",
            departureTime: "08:00",
            preferredFinishTime: "15:00",
            homeByTime: "17:00",
            timeZone: "America/Chicago",
        },
        google: {
            routeIds: ["s1", "s2", "s3"],
            sourceUpdatedAt: "2026-11-20T14:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { s1: ["ORDER-A"], s2: ["ORDER-B"] },
            gigIdsByStopId: { s3: ["GIG-1"] },
        },
        basic: {
            routeIds: ["s2", "s3", "s1"],
            sourceUpdatedAt: "2026-11-20T14:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: { s1: ["ORDER-A"], s2: ["ORDER-B"] },
            gigIdsByStopId: { s3: ["GIG-1"] },
        },
    }, validIds);
    state = RouteHistory.writeRouteHistory(storage, state, validIds);
    let renders = 0;
    const runtime = {
        routeIds: state.google.routeIds.slice(),
        routeOrderSendPromise: null,
        activeRouteSlot: "google",
        els: { routeStatus: { textContent: "" } },
        persistActiveRoute(status) {
            state = RouteHistory.replaceRoute(
                state, runtime.activeRouteSlot, runtime.routeIds, validIds
            );
            state = RouteHistory.setRouteOptimizationStatus(
                state, runtime.activeRouteSlot, status, validIds
            );
            state = RouteHistory.writeRouteHistory(storage, state, validIds);
            runtime.routeIds = state[runtime.activeRouteSlot].routeIds.slice();
        },
        renderRouteList() { renders += 1; },
    };
    vm.runInNewContext(actionSource, runtime);
    return {
        runtime,
        snapshot() { return state; },
        persisted() { return RouteHistory.readRouteHistory(storage, validIds); },
        renderCount() { return renders; },
    };
}

test("Reverse Route flips only selected active Day, preserves exact work IDs and returns reversed stop numbering", () => {
    const harness = setup();
    const { runtime } = harness;
    const before = harness.snapshot();
    const planId = before.activePlan.planId;
    const basicIds = before.basic.routeIds.slice();
    assert.equal(runtime.reverseSelectedRoute(), true);
    assert.deepEqual(Array.from(runtime.routeIds), ["s3", "s2", "s1"]);

    const after = harness.persisted();
    assert.deepEqual(after.google.routeIds, ["s3", "s2", "s1"]);
    assert.deepEqual(after.basic.routeIds, basicIds);
    assert.equal(after.activePlan.planId, planId);
    assert.equal(after.google.optimizationStatus, "manually_changed");
    assert.equal(after.google.schedule, null);
    assert.deepEqual(after.google.orderIdsByStopId.s1, ["ORDER-A"]);
    assert.deepEqual(after.google.orderIdsByStopId.s2, ["ORDER-B"]);
    assert.deepEqual(after.google.gigIdsByStopId.s3, ["GIG-1"]);
    assert.match(runtime.els.routeStatus.textContent, /Google Route reversed — 3 stops/);
    assert.equal(harness.renderCount(), 1);

    const stops = {
        s1: { id: "s1", address: "100 First St" },
        s2: { id: "s2", address: "200 Second St" },
        s3: { id: "s3", address: "300 Gig St" },
    };
    const artifact = RouteOrder.buildActiveDayWorkbookRouteOrder({
        routeSlot: "google",
        routeHistory: after,
        routeStops: after.google.routeIds.map(id => stops[id]),
        now: "2026-11-20T15:00:00.000Z",
    });
    assert.deepEqual(artifact.stops, [
        { stopNumber: 1, address: "300 Gig St", orderIds: [], gigIds: ["GIG-1"] },
        { stopNumber: 2, address: "200 Second St", orderIds: ["ORDER-B"] },
        { stopNumber: 3, address: "100 First St", orderIds: ["ORDER-A"] },
    ]);

    // Reverse again restores the same stop order without deleting jobs.
    assert.equal(runtime.reverseSelectedRoute(), true);
    assert.deepEqual(harness.persisted().google.routeIds, ["s1", "s2", "s3"]);
});

test("reverse action is inactive with one stop or an in-flight workbook send", () => {
    const harness = setup();
    const { runtime } = harness;
    runtime.routeIds = ["s1"];
    assert.equal(runtime.reverseSelectedRoute(), false);
    assert.equal(harness.renderCount(), 0);
    runtime.routeIds = ["s1", "s2", "s3"];
    runtime.routeOrderSendPromise = Promise.resolve();
    assert.equal(runtime.reverseSelectedRoute(), false);
    assert.deepEqual(harness.persisted().google.routeIds, ["s1", "s2", "s3"]);
});

test("selected Basic reversal changes Basic only, leaving Google order intact", () => {
    const harness = setup();
    const { runtime } = harness;
    runtime.activeRouteSlot = "basic";
    runtime.routeIds = harness.snapshot().basic.routeIds.slice();
    assert.equal(runtime.reverseSelectedRoute(), true);
    assert.deepEqual(harness.persisted().basic.routeIds, ["s1", "s3", "s2"]);
    assert.deepEqual(harness.persisted().google.routeIds, ["s1", "s2", "s3"]);
    assert.match(runtime.els.routeStatus.textContent, /Basic Route reversed/);
});

test("reverse action stays visible in route header and disabled for ineligible routes", () => {
    assert.match(html, /id="plannerHeading">Today's Route<\/h3>[\s\S]*?id="reverseRoute"/);
    assert.match(html, /app\.js\?v=3\.34\.18/);
    assert.match(app, /reverseRoute: document\.getElementById\("reverseRoute"\)/);
    assert.match(app, /els\.reverseRoute\?\.addEventListener\("click", reverseSelectedRoute\)/);
    assert.equal((app.match(/routeIds\.length < 2 \|\| Boolean\(routeOrderSendPromise\)/g) || []).length, 2);
    assert.match(actionSource, /persistActiveRoute\("manually_changed"\)/);
});
