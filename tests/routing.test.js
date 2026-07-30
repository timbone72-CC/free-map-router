const test = require("node:test");
const assert = require("node:assert/strict");
const { optimizeRoundTripOrder } = require("../routing.js");

test("optimization starts with the stop nearest verified Home", () => {
    const home = { latitude: 35, longitude: -99 };
    const far = { id: "far", latitude: 36, longitude: -99 };
    const near = { id: "near", latitude: 35.1, longitude: -99 };
    const middle = { id: "middle", latitude: 35.5, longitude: -99 };

    const result = optimizeRoundTripOrder(home, [far, near, middle]);

    assert.deepEqual(
        result.map((stop) => stop.id),
        ["near", "middle", "far"],
    );
});

test("optimization preserves every selected stop exactly once", () => {
    const home = { latitude: 35, longitude: -99 };
    const stops = [
        { id: "a", latitude: 35.8, longitude: -99.2 },
        { id: "b", latitude: 35.2, longitude: -99.3 },
        { id: "c", latitude: 35.5, longitude: -99.1 },
    ];

    const result = optimizeRoundTripOrder(home, stops);

    assert.deepEqual(
        result.map((stop) => stop.id).sort(),
        ["a", "b", "c"],
    );
    assert.equal(stops[0].id, "a");
});
