const test = require("node:test");
const assert = require("node:assert/strict");
const {
    buildGoogleMapsDirectionsUrl,
    buildGoogleMapsRouteSections,
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

test("nine jobs fit safely in one round-trip Google Maps link", () => {
    const home = { address: "Home" };
    const stops = Array.from({ length: 9 }, (_, index) => ({
        address: `Stop ${index + 1}`,
    }));

    const sections = buildGoogleMapsRouteSections(home, stops);

    assert.equal(sections.length, 1);
    assert.equal(sections[0].waypoints.length, 9);
    assert.equal(sections[0].origin.address, "Home");
    assert.equal(sections[0].destination.address, "Home");
});

test("twenty jobs are balanced across safe numbered map sections", () => {
    const home = { address: "Home" };
    const stops = Array.from({ length: 20 }, (_, index) => ({
        address: `Stop ${index + 1}`,
    }));

    const sections = buildGoogleMapsRouteSections(home, stops);

    assert.equal(sections.length, 3);
    assert.deepEqual(
        sections.map((section) => section.waypoints.length),
        [6, 6, 6],
    );
    assert.ok(sections.every((section) => section.waypoints.length <= 9));
    assert.equal(sections[0].origin.address, "Home");
    assert.equal(sections.at(-1).destination.address, "Home");
});

test("split map sections preserve the complete route order without gaps", () => {
    const home = { address: "Home" };
    const stops = Array.from({ length: 20 }, (_, index) => ({
        address: `Stop ${index + 1}`,
    }));
    const expected = [home, ...stops, home].map((point) => point.address);

    const sections = buildGoogleMapsRouteSections(home, stops);
    const reconstructed = sections.flatMap((section, index) => {
        const points = [
            section.origin,
            ...section.waypoints,
            section.destination,
        ];
        return index === 0 ? points : points.slice(1);
    });

    assert.deepEqual(
        reconstructed.map((point) => point.address),
        expected,
    );
    for (let index = 1; index < sections.length; index++) {
        assert.equal(
            sections[index - 1].destination.address,
            sections[index].origin.address,
        );
    }
});
