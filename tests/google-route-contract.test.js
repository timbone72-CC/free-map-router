const test = require("node:test");
const assert = require("node:assert/strict");
const {
    MAX_STOPS,
    RouteContractError,
    applyOrderedStopIds,
    buildBackendRequest,
    buildCoordinateRequest,
    validateBackendResponse,
} = require("../google-route-contract.js");

function sampleStops() {
    return [
        {
            id: "job-a",
            address: "Address A",
            notes: "Private note",
        },
        {
            id: "job-b",
            address: "Address B",
            source: "GIS",
        },
        {
            id: "job-c",
            latitude: 35.3,
            longitude: -99.3,
        },
    ];
}

function sampleRequest() {
    return buildBackendRequest({
        requestId: "request-1",
        home: {
            address: "Home text is not sent",
            latitude: 35,
            longitude: -99,
        },
        stops: sampleStops(),
    });
}

test("backend request keeps addresses for ordinary stops and coordinates for manual pins", () => {
    const request = sampleRequest();

    assert.deepEqual(request, {
        requestId: "request-1",
        home: { latitude: 35, longitude: -99 },
        stops: [
            { id: "job-a", address: "Address A" },
            { id: "job-b", address: "Address B" },
            { id: "job-c", latitude: 35.3, longitude: -99.3 },
        ],
    });
    assert.equal(JSON.stringify(request).includes("Private note"), false);
    assert.equal(JSON.stringify(request).includes("Address A"), true);
    assert.equal(JSON.stringify(request).includes("GIS"), false);
});

test("backend request rejects a stop without an address or complete coordinates", () => {
    assert.throws(
        () =>
            buildBackendRequest({
                requestId: "request-1",
                home: { latitude: 35, longitude: -99 },
                stops: [{ id: "job-a", latitude: null, longitude: -99 }],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "MISSING_COORDINATE",
    );
});

test("backend request rejects ambiguous address and coordinate input", () => {
    assert.throws(
        () =>
            buildBackendRequest({
                requestId: "request-1",
                home: { latitude: 35, longitude: -99 },
                stops: [
                    {
                        id: "job-a",
                        address: "Address A",
                        latitude: 35.1,
                        longitude: -99.1,
                    },
                ],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "AMBIGUOUS_STOP_LOCATION",
    );
});

test("coordinate request requires provider-ready coordinate pairs", () => {
    const request = buildCoordinateRequest({
        requestId: "request-1",
        home: { latitude: 35, longitude: -99 },
        stops: [{ id: "job-a", latitude: 35.1, longitude: -99.1 }],
    });
    assert.deepEqual(request.stops[0], {
        id: "job-a",
        latitude: 35.1,
        longitude: -99.1,
    });
    assert.throws(
        () =>
            buildCoordinateRequest({
                requestId: "request-1",
                home: { latitude: 35, longitude: -99 },
                stops: [{ id: "job-a", address: "Address A" }],
            }),
        /latitude is required/,
    );
});

test("backend request rejects duplicate selected stop IDs", () => {
    assert.throws(
        () =>
            buildBackendRequest({
                requestId: "request-1",
                home: { latitude: 35, longitude: -99 },
                stops: [
                    { id: "same", latitude: 35.1, longitude: -99.1 },
                    { id: "same", latitude: 35.2, longitude: -99.2 },
                ],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "DUPLICATE_STOP_ID",
    );
});

test("backend request enforces the app-owned 100-stop limit", () => {
    const stops = Array.from({ length: MAX_STOPS + 1 }, (_, index) => ({
        id: `job-${index}`,
        latitude: 35 + index / 10000,
        longitude: -99,
    }));

    assert.throws(
        () =>
            buildBackendRequest({
                requestId: "request-1",
                home: { latitude: 35, longitude: -99 },
                stops,
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "TOO_MANY_STOPS",
    );
});

test("valid backend response preserves every selected stop exactly once", () => {
    const request = sampleRequest();
    const result = validateBackendResponse(request, {
        requestId: "request-1",
        orderedStopIds: ["job-c", "job-a", "job-b"],
        skippedStopIds: [],
        totalDistanceMeters: 12345,
        totalDurationSeconds: 4567,
    });

    assert.deepEqual(result.orderedStopIds, ["job-c", "job-a", "job-b"]);
    assert.equal(result.totalDistanceMeters, 12345);
    assert.equal(result.totalDurationSeconds, 4567);
});

test("backend response rejects a skipped stop", () => {
    const request = sampleRequest();

    assert.throws(
        () =>
            validateBackendResponse(request, {
                requestId: "request-1",
                orderedStopIds: ["job-a", "job-b"],
                skippedStopIds: ["job-c"],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "SKIPPED_STOPS",
    );
});

test("backend response rejects missing, duplicate, and unknown stop IDs", () => {
    const request = sampleRequest();

    assert.throws(
        () =>
            validateBackendResponse(request, {
                requestId: "request-1",
                orderedStopIds: ["job-a", "job-b"],
            }),
        /Expected 3 ordered stops but received 2/,
    );

    assert.throws(
        () =>
            validateBackendResponse(request, {
                requestId: "request-1",
                orderedStopIds: ["job-a", "job-a", "job-c"],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "DUPLICATE_ORDERED_STOP_ID",
    );

    assert.throws(
        () =>
            validateBackendResponse(request, {
                requestId: "request-1",
                orderedStopIds: ["job-a", "job-b", "unknown"],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "UNKNOWN_STOP_ID",
    );
});

test("backend response must match the active request", () => {
    const request = sampleRequest();

    assert.throws(
        () =>
            validateBackendResponse(request, {
                requestId: "old-request",
                orderedStopIds: ["job-a", "job-b", "job-c"],
            }),
        (error) =>
            error instanceof RouteContractError &&
            error.code === "REQUEST_ID_MISMATCH",
    );
});

test("applying a valid order keeps the original stop objects unchanged", () => {
    const stops = sampleStops();
    const before = structuredClone(stops);
    const ordered = applyOrderedStopIds(stops, ["job-c", "job-a", "job-b"]);

    assert.equal(ordered[0], stops[2]);
    assert.equal(ordered[1], stops[0]);
    assert.equal(ordered[2], stops[1]);
    assert.deepEqual(stops, before);
});
