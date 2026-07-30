const test = require("node:test");
const assert = require("node:assert/strict");
const {
    buildGoogleMapsDirectionsUrl,
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

test("Google Maps export keeps readable addresses for automatic pins", () => {
    const home = {
        address: "Home address text",
        latitude: 35.1,
        longitude: -99.1,
        pinStatus: "geocoded",
    };
    const stop = {
        address: "Stop address text",
        latitude: 35.2,
        longitude: -99.2,
        pinStatus: "geocoded",
    };

    const url = buildGoogleMapsDirectionsUrl(home, [stop]);

    assert.match(url, /origin=Home%20address%20text/);
    assert.match(url, /waypoints=Stop%20address%20text/);
    assert.doesNotMatch(url, /35\.2%2C-99\.2/);
});

test("Google Maps export uses coordinates only for a corrected manual pin", () => {
    const home = {
        address: "Readable Home",
        latitude: 35.1,
        longitude: -99.1,
        pinStatus: "geocoded",
    };
    const corrected = {
        address: "Ambiguous Address",
        latitude: 35.2,
        longitude: -99.2,
        pinStatus: "manual",
    };

    const url = buildGoogleMapsDirectionsUrl(home, [corrected]);

    assert.match(url, /origin=Readable%20Home/);
    assert.match(url, /waypoints=35\.2%2C-99\.2/);
});

test("an address with null coordinates stays a readable address", () => {
    const home = { address: "Readable Home" };
    const unverified = {
        address: "Readable Stop",
        latitude: null,
        longitude: null,
    };
    const url = buildGoogleMapsDirectionsUrl(home, [unverified]);

    assert.match(url, /waypoints=Readable%20Stop/);
    assert.doesNotMatch(url, /0%2C0/);
});
