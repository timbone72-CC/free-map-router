const test = require("node:test");
const assert = require("node:assert/strict");

const {
    applyWorkbookRoute,
    readRouteHistory,
    replaceRoute,
    setRouteOptimizationStatus,
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

test("a newer workbook route moves current to previous", () => {
    const initial = applyWorkbookRoute(
        null,
        ["a", "b"],
        "2026-08-10T13:00:00.000Z",
    ).history;
    const optimized = replaceRoute(initial, "current", ["b", "a"]);
    const next = applyWorkbookRoute(
        optimized,
        ["c", "d"],
        "2026-08-10T14:00:00.000Z",
    );

    assert.equal(next.result, "newer");
    assert.deepEqual(next.history.current.routeIds, ["c", "d"]);
    assert.deepEqual(next.history.previous.routeIds, ["b", "a"]);
});

test("the same workbook export keeps the optimized current order", () => {
    const initial = applyWorkbookRoute(
        null,
        ["a", "b"],
        "2026-08-10T13:00:00.000Z",
    ).history;
    const optimized = replaceRoute(initial, "current", ["b", "a"]);
    const repeated = applyWorkbookRoute(
        optimized,
        ["a", "b"],
        "2026-08-10T13:00:00.000Z",
    );

    assert.equal(repeated.result, "same");
    assert.deepEqual(repeated.history.current.routeIds, ["b", "a"]);
    assert.equal(repeated.history.previous, null);
});

test("an older workbook export never replaces current", () => {
    const current = applyWorkbookRoute(
        null,
        ["new"],
        "2026-08-10T14:00:00.000Z",
    ).history;
    const older = applyWorkbookRoute(
        current,
        ["old"],
        "2026-08-10T13:00:00.000Z",
    );

    assert.equal(older.result, "older");
    assert.deepEqual(older.history.current.routeIds, ["new"]);
});

test("clearing current keeps its workbook timestamp so reconnect does not reload it", () => {
    const initial = applyWorkbookRoute(
        null,
        ["a"],
        "2026-08-10T14:00:00.000Z",
    ).history;
    const cleared = replaceRoute(initial, "current", []);
    const repeated = applyWorkbookRoute(
        cleared,
        ["a"],
        "2026-08-10T14:00:00.000Z",
    );

    assert.equal(repeated.result, "same");
    assert.deepEqual(repeated.history.current.routeIds, []);
});

test("route history persists only valid saved stop IDs", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    writeRouteHistory(storage, {
        current: { routeIds: ["a", "missing", "a", "b"] },
        previous: { routeIds: ["missing"] },
    }, validIds);

    const restored = readRouteHistory(storage, validIds);
    assert.deepEqual(restored.current.routeIds, ["a", "b"]);
    assert.equal(restored.previous, null);
});

test("optimizer status persists and follows Current to Previous", () => {
    const initial = applyWorkbookRoute(
        null,
        ["a", "b"],
        "2026-08-11T12:00:00.000Z",
    ).history;
    const googleOptimized = setRouteOptimizationStatus(
        initial,
        "current",
        "google_optimized",
    );
    const next = applyWorkbookRoute(
        googleOptimized,
        ["c"],
        "2026-08-11T13:00:00.000Z",
    ).history;

    assert.equal(next.current.optimizationStatus, "not_optimized");
    assert.equal(next.previous.optimizationStatus, "google_optimized");
});

test("older route history defaults safely and invalid statuses are rejected", () => {
    const storage = memoryStorage();
    storage.setItem(
        "fmr_route_history_v1",
        JSON.stringify({
            current: { routeIds: ["a"] },
            previous: {
                routeIds: ["b"],
                optimizationStatus: "untrusted-value",
            },
        }),
    );

    const restored = readRouteHistory(storage, new Set(["a", "b"]));
    assert.equal(restored.current.optimizationStatus, "not_optimized");
    assert.equal(restored.previous.optimizationStatus, "not_optimized");
});

test("manual status replaces an optimizer label without changing route order", () => {
    const initial = replaceRoute(null, "current", ["a", "b"]);
    const optimized = setRouteOptimizationStatus(
        initial,
        "current",
        "basic_optimized",
    );
    const changed = setRouteOptimizationStatus(
        optimized,
        "current",
        "manually_changed",
    );

    assert.deepEqual(changed.current.routeIds, ["a", "b"]);
    assert.equal(changed.current.optimizationStatus, "manually_changed");
});
