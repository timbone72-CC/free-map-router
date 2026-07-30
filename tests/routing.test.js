const test = require("node:test");
const assert = require("node:assert/strict");
const {
    improveWithTwoOpt,
    optimizeRoundTripOrder,
    roundTripMiles,
} = require("../routing.js");

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

test("the second pass removes a crossing and shortens the round trip", () => {
    const home = { latitude: 0, longitude: 0 };
    const crossing = [
        { id: "north", latitude: 0, longitude: 1 },
        { id: "south-east", latitude: 1, longitude: 0 },
        { id: "north-east", latitude: 1, longitude: 1 },
    ];

    const improved = improveWithTwoOpt(home, crossing);

    assert.ok(
        roundTripMiles(home, improved) < roundTripMiles(home, crossing),
    );
    assert.deepEqual(
        improved.map((stop) => stop.id).sort(),
        crossing.map((stop) => stop.id).sort(),
    );
});
