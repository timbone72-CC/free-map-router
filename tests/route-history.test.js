const test = require("node:test");
const assert = require("node:assert/strict");

const {
    applyWorkbookRoute,
    readRouteHistory,
    replaceRoute,
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
