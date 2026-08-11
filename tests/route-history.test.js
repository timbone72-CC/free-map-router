const test = require("node:test");
const assert = require("node:assert/strict");

const {
    readRouteHistory,
    replaceRoute,
    setRouteOptimizationStatus,
    stageWorkbookRoute,
    startPendingRoute,
    writeRouteHistory,
} = require("../route-history.js");

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

function namedRoutes() {
    return {
        google: {
            routeIds: ["g2", "g1"],
            sourceUpdatedAt: "2026-08-10T13:00:00.000Z",
            optimizationStatus: "google_optimized",
        },
        basic: {
            routeIds: ["b1", "b2"],
            sourceUpdatedAt: "2026-08-10T13:00:00.000Z",
            optimizationStatus: "basic_optimized",
        },
        pending: null,
    };
}

test("a newer workbook route waits as pending without replacing either saved route", () => {
    const next = stageWorkbookRoute(
        namedRoutes(),
        ["n1", "n2"],
        "2026-08-10T14:00:00.000Z",
    );

    assert.equal(next.result, "newer");
    assert.deepEqual(next.history.google.routeIds, ["g2", "g1"]);
    assert.equal(next.history.google.optimizationStatus, "google_optimized");
    assert.deepEqual(next.history.basic.routeIds, ["b1", "b2"]);
    assert.equal(next.history.basic.optimizationStatus, "basic_optimized");
    assert.deepEqual(next.history.pending.routeIds, ["n1", "n2"]);
    assert.equal(next.history.pending.optimizationStatus, "not_optimized");
});

test("Start New Route replaces both variants from pending and clears pending", () => {
    const staged = stageWorkbookRoute(
        namedRoutes(),
        ["n1", "n2"],
        "2026-08-10T14:00:00.000Z",
    ).history;
    const started = startPendingRoute(staged);

    assert.equal(started.result, "started");
    assert.deepEqual(started.history.google.routeIds, ["n1", "n2"]);
    assert.deepEqual(started.history.basic.routeIds, ["n1", "n2"]);
    assert.equal(started.history.google.optimizationStatus, "not_optimized");
    assert.equal(started.history.basic.optimizationStatus, "not_optimized");
    assert.equal(started.history.pending, null);
    assert.notEqual(started.history.google, started.history.basic);
});

test("rechecking a pending workbook export preserves all three snapshots", () => {
    const staged = stageWorkbookRoute(
        namedRoutes(),
        ["n1", "n2"],
        "2026-08-10T14:00:00.000Z",
    ).history;
    const repeated = stageWorkbookRoute(
        staged,
        ["n2", "n1"],
        "2026-08-10T14:00:00.000Z",
    );

    assert.equal(repeated.result, "pending");
    assert.deepEqual(repeated.history.pending.routeIds, ["n1", "n2"]);
    assert.deepEqual(repeated.history.google.routeIds, ["g2", "g1"]);
    assert.deepEqual(repeated.history.basic.routeIds, ["b1", "b2"]);
});

test("an older workbook export never replaces or stages a route", () => {
    const older = stageWorkbookRoute(
        namedRoutes(),
        ["old"],
        "2026-08-10T12:00:00.000Z",
    );

    assert.equal(older.result, "older");
    assert.equal(older.history.pending, null);
    assert.deepEqual(older.history.google.routeIds, ["g2", "g1"]);
    assert.deepEqual(older.history.basic.routeIds, ["b1", "b2"]);
});

test("legacy Google Current and Basic Previous migrate into named slots", () => {
    const storage = memoryStorage();
    storage.setItem(
        "fmr_route_history_v1",
        JSON.stringify({
            current: {
                routeIds: ["g2", "g1"],
                optimizationStatus: "google_optimized",
            },
            previous: {
                routeIds: ["b1", "b2"],
                optimizationStatus: "basic_optimized",
            },
        }),
    );

    const restored = readRouteHistory(
        storage,
        new Set(["g1", "g2", "b1", "b2"]),
    );
    assert.deepEqual(restored.google.routeIds, ["g2", "g1"]);
    assert.equal(restored.google.optimizationStatus, "google_optimized");
    assert.deepEqual(restored.basic.routeIds, ["b1", "b2"]);
    assert.equal(restored.basic.optimizationStatus, "basic_optimized");
    assert.equal(restored.pending, null);
});

test("one legacy Current route is copied safely into both named slots", () => {
    const storage = memoryStorage();
    storage.setItem(
        "fmr_route_history_v1",
        JSON.stringify({ current: { routeIds: ["a", "b"] } }),
    );

    const restored = readRouteHistory(storage, new Set(["a", "b"]));
    assert.deepEqual(restored.google.routeIds, ["a", "b"]);
    assert.deepEqual(restored.basic.routeIds, ["a", "b"]);
    assert.equal(restored.google.optimizationStatus, "not_optimized");
    assert.equal(restored.basic.optimizationStatus, "not_optimized");
});

test("route storage filters invalid and duplicate stop IDs in every slot", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    writeRouteHistory(
        storage,
        {
            google: { routeIds: ["a", "missing", "a", "b"] },
            basic: { routeIds: ["b", "missing"] },
            pending: {
                routeIds: ["missing", "a"],
                sourceUpdatedAt: "2026-08-11T12:00:00.000Z",
            },
        },
        validIds,
    );

    const restored = readRouteHistory(storage, validIds);
    assert.deepEqual(restored.google.routeIds, ["a", "b"]);
    assert.deepEqual(restored.basic.routeIds, ["b"]);
    assert.deepEqual(restored.pending.routeIds, ["a"]);
});

test("a damaged pending snapshot with no saved jobs cannot block a later inbox", () => {
    const storage = memoryStorage();
    writeRouteHistory(
        storage,
        {
            google: { routeIds: ["a"] },
            pending: {
                routeIds: ["missing"],
                sourceUpdatedAt: "2026-08-11T13:00:00.000Z",
            },
        },
        new Set(["a"]),
    );

    const restored = readRouteHistory(storage, new Set(["a"]));
    assert.equal(restored.pending, null);
    const next = stageWorkbookRoute(
        restored,
        ["a"],
        "2026-08-11T13:00:00.000Z",
        new Set(["a"]),
    );
    assert.equal(next.result, "newer");
    assert.deepEqual(next.history.pending.routeIds, ["a"]);
});

test("optimizer and manual status changes affect only the named route", () => {
    const initial = {
        google: { routeIds: ["a", "b"] },
        basic: { routeIds: ["a", "b"] },
        pending: null,
    };
    const googleOptimized = setRouteOptimizationStatus(
        initial,
        "google",
        "google_optimized",
    );
    const basicOptimized = setRouteOptimizationStatus(
        googleOptimized,
        "basic",
        "basic_optimized",
    );
    const changed = replaceRoute(basicOptimized, "google", ["b", "a"]);
    const marked = setRouteOptimizationStatus(
        changed,
        "google",
        "manually_changed",
    );

    assert.deepEqual(marked.google.routeIds, ["b", "a"]);
    assert.equal(marked.google.optimizationStatus, "manually_changed");
    assert.deepEqual(marked.basic.routeIds, ["a", "b"]);
    assert.equal(marked.basic.optimizationStatus, "basic_optimized");
});

test("an empty route cannot retain a stale optimizer label", () => {
    const initial = setRouteOptimizationStatus(
        { google: { routeIds: ["a"] } },
        "google",
        "google_optimized",
    );
    const cleared = replaceRoute(initial, "google", []);

    assert.equal(cleared.google, null);
});
