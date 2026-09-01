"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    buildGoogleOptimizeToursRequest,
} = require("../google-route-provider.js");

function routeRequest(stopCount) {
    return {
        requestId: `deadline-${stopCount}`,
        home: { latitude: 35.411, longitude: -99.404 },
        stops: Array.from({ length: stopCount }, (_, index) => ({
            id: `job-${index + 1}`,
            latitude: 35.5 + index * 0.001,
            longitude: -99.5 - index * 0.001,
        })),
    };
}

test("Google keeps the established 30-second solver time below the large-route threshold", () => {
    const request = buildGoogleOptimizeToursRequest(routeRequest(32), {
        now: "2026-08-31T22:00:00Z",
    });

    assert.equal(request.timeout, "30s");
    assert.equal(request.searchMode, "CONSUME_ALL_AVAILABLE_TIME");
    assert.equal(request.considerRoadTraffic, true);
});

test("Google allows 60 seconds for routes with 33 or more selected stops", () => {
    const request = buildGoogleOptimizeToursRequest(routeRequest(33), {
        now: "2026-08-31T22:00:00Z",
    });

    assert.equal(request.timeout, "60s");
    assert.equal(request.searchMode, "CONSUME_ALL_AVAILABLE_TIME");
    assert.equal(request.considerRoadTraffic, true);
    assert.equal(request.model.shipments.length, 33);
});
