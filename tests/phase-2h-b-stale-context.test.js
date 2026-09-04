"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const browser = require("../google-route-browser.js");

function preparedContext() {
    return {
        snapshot: {
            home: {
                address: "1 Home Rd, Elk City, OK",
                latitude: 35.41,
                longitude: -99.4,
            },
            timing: {
                departureTime: "2026-09-10T13:00:00Z",
                homeByTime: "2026-09-10T22:00:00Z",
            },
            stops: [{ id: "shared" }, { id: "plain" }],
        },
        context: {
            serviceByStopId: {
                shared: 900,
                plain: 300,
            },
        },
    };
}

function copy(value) {
    return JSON.parse(JSON.stringify(value));
}

function assertStale(initial, changed) {
    assert.throws(
        () => browser.assertPreparedContextCurrent(initial, changed),
        (error) =>
            error instanceof browser.GoogleRouteBrowserError &&
            error.code === "STALE_ROUTE" &&
            error.message.includes("No route was changed"),
    );
}

test("Google result is stale when route, Home, service, Departure, or Home By changes in flight", () => {
    const initial = preparedContext();
    assert.equal(
        browser.assertPreparedContextCurrent(initial, copy(initial)),
        true,
    );

    const reordered = copy(initial);
    reordered.snapshot.stops.reverse();
    assertStale(initial, reordered);

    const movedHome = copy(initial);
    movedHome.snapshot.home.latitude = 35.42;
    assertStale(initial, movedHome);

    const changedService = copy(initial);
    changedService.context.serviceByStopId.shared = 960;
    assertStale(initial, changedService);

    const changedDeparture = copy(initial);
    changedDeparture.snapshot.timing.departureTime = "2026-09-10T13:30:00Z";
    assertStale(initial, changedDeparture);

    const changedHomeBy = copy(initial);
    changedHomeBy.snapshot.timing.homeByTime = "2026-09-10T21:30:00Z";
    assertStale(initial, changedHomeBy);
});
