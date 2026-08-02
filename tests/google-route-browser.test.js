"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    GoogleRouteBrowserError,
    buildBrowserRequest,
    duplicateCoordinateGroups,
    formatMetrics,
    optimizeWithGoogle,
    prepareSnapshotForGoogle,
} = require("../google-route-browser.js");

function snapshot() {
    return {
        home: {
            address: "222 Blackburn Blvd, Elk City, OK 73644",
            latitude: 35.4301483,
            longitude: -99.4031811,
        },
        stops: [
            {
                id: "job-a",
                address: "101 Main St, Elk City, OK",
                source: "GIS",
                notes: "private note",
                latitude: 35.44,
                longitude: -99.41,
            },
            {
                id: "job-b",
                address: "202 Main St, Elk City, OK",
                source: "DCFS",
                notes: "another private note",
                latitude: 35.45,
                longitude: -99.42,
            },
        ],
    };
}

test("browser request sends only opaque IDs and coordinates", () => {
    const request = buildBrowserRequest(snapshot(), "browser-request-1");

    assert.deepEqual(request, {
        requestId: "browser-request-1",
        home: {
            latitude: 35.4301483,
            longitude: -99.4031811,
        },
        stops: [
            { id: "job-a", latitude: 35.44, longitude: -99.41 },
            { id: "job-b", latitude: 35.45, longitude: -99.42 },
        ],
    });

    const serialized = JSON.stringify(request);
    assert.equal(serialized.includes("Blackburn"), false);
    assert.equal(serialized.includes("private note"), false);
    assert.equal(serialized.includes("GIS"), false);
    assert.equal(serialized.includes("DCFS"), false);
});

test("duplicate saved coordinates stop the browser request", () => {
    const route = snapshot();
    route.stops[1].latitude = route.stops[0].latitude;
    route.stops[1].longitude = route.stops[0].longitude;

    assert.equal(duplicateCoordinateGroups(route.stops).length, 1);
    assert.throws(
        () => buildBrowserRequest(route, "browser-request-1"),
        (error) =>
            error instanceof GoogleRouteBrowserError &&
            error.code === "DUPLICATE_COORDINATES" &&
            error.message.includes("101 Main St") &&
            error.message.includes("202 Main St"),
    );
});

test("blank coordinates are missing, not duplicate saved pins", () => {
    const route = snapshot();
    route.stops.forEach((stop) => {
        stop.latitude = null;
        stop.longitude = null;
    });

    assert.equal(duplicateCoordinateGroups(route.stops).length, 0);
});

test("Google preparation waits for the app to locate missing coordinates", async () => {
    const prepared = snapshot();
    const calls = [];
    const result = await prepareSnapshotForGoogle({
        prepareSelectedRouteSnapshot: async () => {
            calls.push("prepare");
            return prepared;
        },
    });

    assert.deepEqual(calls, ["prepare"]);
    assert.equal(result, prepared);
});

test("browser sends the memory-only token and validates the complete response", async () => {
    const calls = [];
    const fakeFetch = async (url, options) => {
        calls.push({ url, options });
        return {
            ok: true,
            status: 200,
            json: async () => ({
                requestId: "browser-request-1",
                orderedStopIds: ["job-b", "job-a"],
                skippedStopIds: [],
                totalDistanceMeters: 16093.44,
                totalDurationSeconds: 3600,
            }),
        };
    };

    const result = await optimizeWithGoogle({
        snapshot: snapshot(),
        idToken: "company-google-id-token",
        fetchImpl: fakeFetch,
        backendUrl: "https://optimizer.example",
        id: "browser-request-1",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://optimizer.example/optimize");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(
        calls[0].options.headers.authorization,
        "Bearer company-google-id-token",
    );
    assert.equal(
        calls[0].options.headers["content-type"],
        "application/json",
    );
    assert.equal(
        calls[0].options.body.includes("company-google-id-token"),
        false,
    );
    assert.deepEqual(result.response.orderedStopIds, ["job-b", "job-a"]);
    assert.equal(formatMetrics(result.response), "10.0 road miles · 1.0 hours estimated driving");
});

test("missing sign-in and backend account rejection fail closed", async () => {
    await assert.rejects(
        optimizeWithGoogle({
            snapshot: snapshot(),
            idToken: "",
            fetchImpl: async () => {
                throw new Error("must not call network");
            },
            id: "browser-request-1",
        }),
        (error) =>
            error instanceof GoogleRouteBrowserError &&
            error.statusCode === 401 &&
            error.code === "SIGN_IN_REQUIRED",
    );

    await assert.rejects(
        optimizeWithGoogle({
            snapshot: snapshot(),
            idToken: "personal-google-id-token",
            fetchImpl: async () => ({
                ok: false,
                status: 403,
                json: async () => ({
                    code: "ACCOUNT_NOT_ALLOWED",
                    message: "Use the approved company Google account.",
                }),
            }),
            backendUrl: "https://optimizer.example",
            id: "browser-request-1",
        }),
        (error) =>
            error instanceof GoogleRouteBrowserError &&
            error.statusCode === 403 &&
            error.code === "ACCOUNT_NOT_ALLOWED",
    );
});
