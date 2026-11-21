"use strict";

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
const { resolveGoogleRouteRequest } = require("../google-route-server.js");

function request(existingCount = 4) {
    const stops = Array.from({ length: existingCount }, (_, index) => ({
        id: `old-${index + 1}`,
        latitude: 35 + index / 100,
        longitude: -99 - index / 100,
        serviceDurationSeconds: 300,
    }));
    stops.push({
        id: "new-stop",
        latitude: 35.75,
        longitude: -99.75,
        serviceDurationSeconds: 600,
    });
    return {
        requestId: "insert-1",
        home: { latitude: 35, longitude: -99 },
        stops,
        insertion: { newStopId: "new-stop" },
    };
}

function responseWithOrder(ids) {
    return {
        routes: [{
            visits: ids.map((id) => ({ shipmentLabel: id })),
            metrics: { travelDuration: "4800s", travelDistanceMeters: 28000 },
        }],
    };
}

test("insert-one request keeps precisely one new stop separate from the existing ordered route", () => {
    const prepared = buildBackendRequest(request());
    assert.deepEqual(prepared.insertion, { newStopId: "new-stop" });
    assert.deepEqual(prepared.stops.map((stop) => stop.id), [
        "old-1", "old-2", "old-3", "old-4", "new-stop",
    ]);
    assert.deepEqual(buildCoordinateRequest(prepared), prepared);
    const normal = buildBackendRequest({ ...request(), insertion: undefined });
    assert.equal(Object.hasOwn(normal, "insertion"), false);
});

test("insert-one request rejects a missing/duplicate new stop or reordered input", () => {
    for (const invalid of [
        { ...request(), insertion: { newStopId: "not-present" } },
        { ...request(), insertion: { newStopId: "old-2" } },
        { ...request(), insertion: {} },
        { ...request(), stops: [request().stops[0]], insertion: { newStopId: "old-1" } },
    ]) {
        assert.throws(
            () => buildBackendRequest(invalid),
            (error) => error instanceof RouteContractError &&
                ["INVALID_INSERTION", "MISSING_ID"].includes(error.code),
        );
    }
    const duplicated = request();
    duplicated.stops.push({ ...duplicated.stops[0] });
    assert.throws(() => buildBackendRequest(duplicated), /Duplicate selected stop ID/);
});

test("Google receives consecutive delivery precedence locks, not an unrestricted route", () => {
    const normal = buildGoogleOptimizeToursRequest({
        ...request(),
        insertion: undefined,
    });
    assert.equal(normal.model.precedenceRules, undefined);
    const locked = buildGoogleOptimizeToursRequest(request(), {
        now: "2026-11-20T14:00:00Z",
    });
    assert.deepEqual(locked.model.precedenceRules, [
        { firstIndex: 0, secondIndex: 1, firstIsDelivery: true, secondIsDelivery: true, offsetDuration: "0s" },
        { firstIndex: 1, secondIndex: 2, firstIsDelivery: true, secondIsDelivery: true, offsetDuration: "0s" },
        { firstIndex: 2, secondIndex: 3, firstIsDelivery: true, secondIsDelivery: true, offsetDuration: "0s" },
    ]);
    assert.deepEqual(locked.model.shipments.map((x) => x.label), [
        "old-1", "old-2", "old-3", "old-4", "new-stop",
    ]);
    assert.equal(locked.model.vehicles[0].costPerTraveledHour, 1);
});

test("locked-order calculation supports large preexisting routes without silently changing any IDs", () => {
    const input = request(40);
    const locked = buildGoogleOptimizeToursRequest(input);
    assert.equal(locked.model.shipments.length, 41);
    assert.equal(locked.model.precedenceRules.length, 39);
    assert.equal(locked.timeout, "60s");
    const expected = input.stops.map((stop) => stop.id);
    const inserted = [...expected.slice(0, 17), "new-stop", ...expected.slice(17, -1)];
    assert.deepEqual(
        interpretGoogleOptimizeToursResponse(input, responseWithOrder(inserted)).orderedStopIds,
        inserted,
    );
});

test("provider accepts new stop at start, middle, or end, never rearranging old stops", () => {
    const input = request();
    const old = ["old-1", "old-2", "old-3", "old-4"];
    for (let position = 0; position <= old.length; position += 1) {
        const ids = [...old.slice(0, position), "new-stop", ...old.slice(position)];
        const output = interpretGoogleOptimizeToursResponse(input, responseWithOrder(ids));
        assert.deepEqual(output.orderedStopIds, ids);
        assert.equal(output.totalDistanceMeters, 28000);
    }
});

test("provider rejects reorder, skipped stops, duplicates or invented stops and preserves failure", () => {
    const input = request();
    assert.throws(
        () => interpretGoogleOptimizeToursResponse(input, responseWithOrder([
            "old-2", "old-1", "new-stop", "old-3", "old-4",
        ])),
        (error) => error instanceof GoogleRouteProviderError &&
            error.code === "INSERTION_ORDER_CHANGED" && error.statusCode === 502,
    );
    for (const ids of [
        ["old-1", "old-2", "old-3", "new-stop"],
        ["old-1", "old-2", "new-stop", "new-stop", "old-4"],
        ["old-1", "old-2", "old-3", "new-stop", "invented"],
    ]) {
        assert.throws(() => interpretGoogleOptimizeToursResponse(input, responseWithOrder(ids)));
    }
    assert.throws(() => interpretGoogleOptimizeToursResponse(input, {
        ...responseWithOrder(["old-1", "old-2", "old-3", "old-4", "new-stop"]),
        skippedShipments: [{ label: "old-2" }],
    }));
});

test("browser-side contract also rejects an attempted reorder before any route write", () => {
    const input = request();
    assert.throws(
        () => validateBackendResponse(input, {
            requestId: input.requestId,
            orderedStopIds: ["old-2", "old-1", "new-stop", "old-3", "old-4"],
        }),
        (error) => error.code === "INSERTION_ORDER_CHANGED",
    );
});

test("address geocoding preserves insertion intent, locations, service time and original stop IDs", async () => {
    const input = request();
    input.stops[1] = { id: "old-2", address: "102 Main, Elk City, OK", serviceDurationSeconds: 300 };
    input.stops.at(-1) = { id: "new-stop", address: "350 Main, Elk City, OK", serviceDurationSeconds: 600 };
    const seen = [];
    const ready = await resolveGoogleRouteRequest(input, {
        accessToken: "test",
        geocode: async (address) => {
            seen.push(address);
            return { latitude: 35.8, longitude: -99.8 };
        },
    });
    assert.equal(seen.length, 2);
    assert.deepEqual(ready.insertion, { newStopId: "new-stop" });
    assert.deepEqual(ready.stops.map((stop) => stop.id), input.stops.map((stop) => stop.id));
    assert.equal(ready.stops.at(-1).serviceDurationSeconds, 600);
    assert.equal(ready.stops[1].latitude, 35.8);
});
