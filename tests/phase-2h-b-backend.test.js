const test = require("node:test");
const assert = require("node:assert/strict");

const {
    RouteContractError,
    buildBackendRequest,
    buildCoordinateRequest,
    validateBackendResponse,
} = require("../google-route-contract.js");
const {
    GoogleRouteProviderError,
    buildGoogleOptimizeToursRequest,
    interpretGoogleOptimizeToursResponse,
} = require("../google-route-provider.js");
const {
    resolveGoogleRouteRequest,
} = require("../google-route-server.js");

const DEPARTURE = "2026-09-10T13:00:00Z";
const HOME_BY = "2026-09-10T22:00:00Z";

function coordinateRequest(stopCount = 2) {
    return {
        requestId: `timed-${stopCount}`,
        home: { latitude: 35.4676, longitude: -97.5164 },
        timing: {
            departureTime: DEPARTURE,
            homeByTime: HOME_BY,
        },
        stops: Array.from({ length: stopCount }, (_, index) => ({
            id: `stop-${index + 1}`,
            latitude: 35.5 + index * 0.01,
            longitude: -97.5 - index * 0.01,
            serviceDurationSeconds: index === 0 ? 300 : 120,
        })),
    };
}

function timedGoogleResponse(request) {
    let cursor = Date.parse(DEPARTURE) + 600000;
    const visits = request.stops.map((stop) => {
        const visit = {
            shipmentLabel: stop.id,
            startTime: new Date(cursor).toISOString().replace(".000Z", "Z"),
        };
        cursor += (stop.serviceDurationSeconds + 600) * 1000;
        return visit;
    });
    return {
        routes: [
            {
                vehicleStartTime: DEPARTURE,
                vehicleEndTime: new Date(cursor + 600000)
                    .toISOString()
                    .replace(".000Z", "Z"),
                visits,
                metrics: {
                    travelDistanceMeters: 12345,
                    travelDuration: "1800s",
                    waitDuration: "0s",
                    visitDuration: `${request.stops.reduce(
                        (sum, stop) => sum + stop.serviceDurationSeconds,
                        0,
                    )}s`,
                    totalDuration: "3600s",
                },
            },
        ],
        skippedShipments: [],
    };
}

test("legacy /optimize request remains unchanged when timing fields are absent", () => {
    const request = buildBackendRequest({
        requestId: "legacy",
        home: { latitude: 35, longitude: -97 },
        stops: [{ id: "a", address: "100 Main St, Elk City, OK" }],
    });

    assert.deepEqual(request, {
        requestId: "legacy",
        home: { latitude: 35, longitude: -97 },
        stops: [{ id: "a", address: "100 Main St, Elk City, OK" }],
    });
});

test("time-aware contract preserves whole-second timing and per-stop service seconds", () => {
    const request = buildBackendRequest({
        requestId: "timed",
        home: { latitude: 35, longitude: -97 },
        timing: {
            departureTime: "2026-09-10T08:00:00-05:00",
            homeByTime: "2026-09-10T17:00:00-05:00",
        },
        stops: [
            {
                id: "shared",
                address: "100 Main St, Elk City, OK",
                serviceDurationSeconds: 1500,
            },
        ],
    });

    assert.deepEqual(request.timing, {
        departureTime: DEPARTURE,
        homeByTime: HOME_BY,
    });
    assert.equal(request.stops[0].serviceDurationSeconds, 1500);
});

test("time-aware contract rejects missing service seconds and fractional timestamps", () => {
    assert.throws(
        () =>
            buildBackendRequest({
                requestId: "missing-service",
                home: { latitude: 35, longitude: -97 },
                timing: { departureTime: DEPARTURE, homeByTime: HOME_BY },
                stops: [{ id: "a", address: "100 Main St" }],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "MISSING_SERVICE_DURATION",
    );

    assert.throws(
        () =>
            buildBackendRequest({
                requestId: "fractional-time",
                home: { latitude: 35, longitude: -97 },
                timing: {
                    departureTime: "2026-09-10T13:00:00.500Z",
                    homeByTime: HOME_BY,
                },
                stops: [
                    { id: "a", address: "100 Main St", serviceDurationSeconds: 300 },
                ],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "INVALID_ROUTE_TIME",
    );
});

test("coordinate contract preserves timed service data after address resolution", () => {
    const request = buildCoordinateRequest(coordinateRequest());
    assert.equal(request.stops[0].serviceDurationSeconds, 300);
    assert.deepEqual(request.timing, {
        departureTime: DEPARTURE,
        homeByTime: HOME_BY,
    });
});

test("Google timed model uses stop service, selected departure, hard Home By, and existing objective", () => {
    const request = coordinateRequest();
    const google = buildGoogleOptimizeToursRequest(request, {
        now: new Date("2030-01-01T00:00:00Z"),
    });

    assert.equal(google.model.globalStartTime, DEPARTURE);
    assert.equal(google.model.globalEndTime, HOME_BY);
    assert.equal(google.model.shipments[0].deliveries[0].duration, "300s");
    assert.equal(google.model.shipments[1].deliveries[0].duration, "120s");
    assert.deepEqual(google.model.vehicles[0].startTimeWindows, [
        { startTime: DEPARTURE, endTime: DEPARTURE },
    ]);
    assert.deepEqual(google.model.vehicles[0].endTimeWindows, [
        { startTime: DEPARTURE, endTime: HOME_BY },
    ]);
    assert.equal(google.model.vehicles[0].costPerTraveledHour, 1);
    assert.equal(google.considerRoadTraffic, true);
    assert.equal(Object.hasOwn(google.model.vehicles[0], "costPerKilometer"), false);
    assert.equal(JSON.stringify(google).includes("preferredFinish"), false);
});

test("32 and 33 stop timed requests retain the protected solver timeout boundary", () => {
    assert.equal(buildGoogleOptimizeToursRequest(coordinateRequest(32)).timeout, "30s");
    assert.equal(buildGoogleOptimizeToursRequest(coordinateRequest(33)).timeout, "60s");
});

test("provider retains complete schedule facts and exact requested service total", () => {
    const request = coordinateRequest();
    const result = interpretGoogleOptimizeToursResponse(
        request,
        timedGoogleResponse(request),
    );

    assert.deepEqual(result.orderedStopIds, ["stop-1", "stop-2"]);
    assert.equal(result.schedule.vehicleStartTime, DEPARTURE);
    assert.equal(result.schedule.travelDurationSeconds, 1800);
    assert.equal(result.schedule.waitDurationSeconds, 0);
    assert.equal(result.schedule.totalServiceDurationSeconds, 420);
    assert.deepEqual(
        result.schedule.visits.map((visit) => visit.stopId),
        ["stop-1", "stop-2"],
    );
});

test("timed provider rejects skipped work as a visible Home By conflict", () => {
    const request = coordinateRequest();
    const response = timedGoogleResponse(request);
    response.skippedShipments = [{ label: "stop-2" }];

    assert.throws(
        () => interpretGoogleOptimizeToursResponse(request, response),
        (error) =>
            error instanceof GoogleRouteProviderError &&
            error.code === "HOME_BY_CONFLICT" &&
            error.statusCode === 422,
    );
});

test("timed provider rejects traffic infeasibility instead of claiming Home By confidence", () => {
    const request = coordinateRequest();
    const response = timedGoogleResponse(request);
    response.routes[0].hasTrafficInfeasibilities = true;

    assert.throws(
        () => interpretGoogleOptimizeToursResponse(request, response),
        (error) =>
            error instanceof GoogleRouteProviderError &&
            error.code === "TRAFFIC_SCHEDULE_INFEASIBLE" &&
            error.statusCode === 422,
    );
});

test("timed provider rejects a Google visit-service total that differs from requested work", () => {
    const request = coordinateRequest();
    const response = timedGoogleResponse(request);
    response.routes[0].metrics.visitDuration = "1s";

    assert.throws(
        () => interpretGoogleOptimizeToursResponse(request, response),
        (error) =>
            error instanceof GoogleRouteProviderError &&
            error.code === "INVALID_GOOGLE_SCHEDULE" &&
            error.statusCode === 502,
    );
});

test("schedule validation rejects service totals that do not match the request", () => {
    const request = buildCoordinateRequest(coordinateRequest());
    const provider = interpretGoogleOptimizeToursResponse(
        request,
        timedGoogleResponse(request),
    );
    const damaged = {
        ...provider,
        schedule: {
            ...provider.schedule,
            totalServiceDurationSeconds: 1,
        },
    };

    assert.throws(
        () => validateBackendResponse(request, damaged),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "SCHEDULE_SERVICE_MISMATCH",
    );
});

test("request-only address geocoding preserves service duration and top-level timing", async () => {
    const resolved = await resolveGoogleRouteRequest(
        {
            requestId: "geocode-timed",
            home: { latitude: 35, longitude: -97 },
            timing: { departureTime: DEPARTURE, homeByTime: HOME_BY },
            stops: [
                {
                    id: "address-stop",
                    address: "100 Main St, Elk City, OK",
                    serviceDurationSeconds: 900,
                },
            ],
        },
        {
            accessToken: "test-token",
            geocode: async () => ({ latitude: 35.4, longitude: -99.4 }),
        },
    );

    assert.deepEqual(resolved.timing, {
        departureTime: DEPARTURE,
        homeByTime: HOME_BY,
    });
    assert.deepEqual(resolved.stops, [
        {
            id: "address-stop",
            latitude: 35.4,
            longitude: -99.4,
            serviceDurationSeconds: 900,
        },
    ]);
});
