const test = require("node:test");
const assert = require("node:assert/strict");
const {
    buildGoogleOptimizeToursRequest,
    interpretGoogleOptimizeToursResponse,
} = require("../google-route-provider.js");

function backendRequest() {
    return {
        requestId: "request-1",
        home: { latitude: 35, longitude: -99 },
        stops: [
            { id: "job-a", latitude: 35.1, longitude: -99.1 },
            { id: "job-b", latitude: 35.2, longitude: -99.2 },
            { id: "job-c", latitude: 35.3, longitude: -99.3 },
        ],
    };
}

test("Google request minimizes traffic-aware driving time and returns Home", () => {
    const request = buildGoogleOptimizeToursRequest(backendRequest());

    assert.equal(request.model.vehicles.length, 1);
    assert.deepEqual(request.model.vehicles[0].startLocation, {
        latitude: 35,
        longitude: -99,
    });
    assert.deepEqual(request.model.vehicles[0].endLocation, {
        latitude: 35,
        longitude: -99,
    });
    assert.equal(request.model.vehicles[0].costPerTraveledHour, 1);
    assert.equal(request.model.vehicles[0].costPerKilometer, undefined);
    assert.equal(request.searchMode, "CONSUME_ALL_AVAILABLE_TIME");
    assert.equal(request.timeout, "30s");
    assert.equal(request.considerRoadTraffic, true);
});

test("Google request sends one service delivery for every selected stop", () => {
    const request = buildGoogleOptimizeToursRequest(backendRequest());

    assert.equal(request.model.shipments.length, 3);
    assert.deepEqual(
        request.model.shipments.map((shipment) => shipment.label),
        ["job-a", "job-b", "job-c"],
    );
    assert.deepEqual(request.model.shipments[1].deliveries[0], {
        label: "job-b",
        arrivalLocation: { latitude: 35.2, longitude: -99.2 },
        duration: "0s",
    });
});

test("Google response labels become the complete validated app order", () => {
    const result = interpretGoogleOptimizeToursResponse(backendRequest(), {
        routes: [
            {
                visits: [
                    { shipmentLabel: "job-c" },
                    { shipmentLabel: "job-a" },
                    { shipmentLabel: "job-b" },
                ],
                metrics: {
                    travelDistanceMeters: 10000,
                    travelDuration: "3600s",
                },
            },
        ],
    });

    assert.deepEqual(result.orderedStopIds, ["job-c", "job-a", "job-b"]);
    assert.equal(result.totalDistanceMeters, 10000);
    assert.equal(result.totalDurationSeconds, 3600);
});

test("Google response can fall back to shipment indexes including omitted zero", () => {
    const result = interpretGoogleOptimizeToursResponse(backendRequest(), {
        routes: [
            {
                visits: [
                    { shipmentIndex: 2 },
                    {},
                    { shipmentIndex: 1 },
                ],
            },
        ],
    });

    assert.deepEqual(result.orderedStopIds, ["job-c", "job-a", "job-b"]);
});

test("Google skipped shipments invalidate the whole result", () => {
    assert.throws(
        () =>
            interpretGoogleOptimizeToursResponse(backendRequest(), {
                routes: [
                    {
                        visits: [
                            { shipmentLabel: "job-a" },
                            { shipmentLabel: "job-b" },
                        ],
                    },
                ],
                skippedShipments: [{ label: "job-c" }],
            }),
        /provider skipped 1 selected stop/,
    );
});

test("Google must return exactly one vehicle route", () => {
    assert.throws(
        () =>
            interpretGoogleOptimizeToursResponse(backendRequest(), {
                routes: [],
            }),
        /exactly one Google vehicle route/,
    );

    assert.throws(
        () =>
            interpretGoogleOptimizeToursResponse(backendRequest(), {
                routes: [{ visits: [] }, { visits: [] }],
            }),
        /exactly one Google vehicle route/,
    );
});

test("Google cannot insert, omit, or duplicate a selected stop", () => {
    assert.throws(
        () =>
            interpretGoogleOptimizeToursResponse(backendRequest(), {
                routes: [
                    {
                        visits: [
                            { shipmentLabel: "job-a" },
                            { shipmentLabel: "job-b" },
                            { shipmentLabel: "unknown" },
                        ],
                    },
                ],
            }),
        /Unknown ordered stop ID/,
    );

    assert.throws(
        () =>
            interpretGoogleOptimizeToursResponse(backendRequest(), {
                routes: [
                    {
                        visits: [
                            { shipmentLabel: "job-a" },
                            { shipmentLabel: "job-a" },
                            { shipmentLabel: "job-c" },
                        ],
                    },
                ],
            }),
        /Duplicate ordered stop ID/,
    );

    assert.throws(
        () =>
            interpretGoogleOptimizeToursResponse(backendRequest(), {
                routes: [
                    {
                        visits: [
                            { shipmentLabel: "job-a" },
                            { shipmentLabel: "job-b" },
                        ],
                    },
                ],
            }),
        /Expected 3 ordered stops but received 2/,
    );
});
