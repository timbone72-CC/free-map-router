"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const {
    METADATA_TOKEN_URL,
    callGoogleOptimizeTours,
    createRequestHandler,
} = require("../google-route-server.js");

async function withServer(handler, callback) {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
        const address = server.address();
        await callback(`http://127.0.0.1:${address.port}`);
    } finally {
        server.close();
        await once(server, "close");
    }
}

function sampleRequest() {
    return {
        requestId: "request-1",
        home: { latitude: 35.411, longitude: -99.404 },
        stops: [
            { id: "job-a", latitude: 35.51, longitude: -99.49 },
            { id: "job-b", latitude: 35.61, longitude: -99.59 },
        ],
    };
}

test("private server exposes a minimal health response", async () => {
    await withServer(createRequestHandler(), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            ok: true,
            service: "fmr-route-optimizer",
        });
    });
});

test("optimization endpoint validates and returns a complete order", async () => {
    let receivedRequest = null;
    const handler = createRequestHandler({
        optimize: async (request) => {
            receivedRequest = request;
            return {
                requestId: request.requestId,
                orderedStopIds: ["job-b", "job-a"],
                skippedStopIds: [],
                totalDistanceMeters: 12345,
                totalDurationSeconds: 1800,
            };
        },
    });

    await withServer(handler, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/optimize`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ...sampleRequest(),
                customerName: "must not survive validation",
                stops: sampleRequest().stops.map((stop) => ({
                    ...stop,
                    address: "must not survive validation",
                    notes: "must not survive validation",
                })),
            }),
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            requestId: "request-1",
            orderedStopIds: ["job-b", "job-a"],
            skippedStopIds: [],
            totalDistanceMeters: 12345,
            totalDurationSeconds: 1800,
        });
        assert.deepEqual(receivedRequest, sampleRequest());
    });
});

test("invalid coordinates are rejected before provider access", async () => {
    let providerCalled = false;
    const handler = createRequestHandler({
        optimize: async () => {
            providerCalled = true;
            return {};
        },
    });

    await withServer(handler, async (baseUrl) => {
        const request = sampleRequest();
        request.stops[0].latitude = null;

        const response = await fetch(`${baseUrl}/optimize`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
        });

        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.ok, false);
        assert.equal(body.code, "MISSING_COORDINATE");
        assert.equal(providerCalled, false);
    });
});

test("optimization endpoint requires JSON and POST", async () => {
    await withServer(createRequestHandler(), async (baseUrl) => {
        const getResponse = await fetch(`${baseUrl}/optimize`);
        assert.equal(getResponse.status, 405);

        const textResponse = await fetch(`${baseUrl}/optimize`, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "not json",
        });
        assert.equal(textResponse.status, 415);
    });
});

test("Cloud Run provider obtains a metadata token and calls optimizeTours", async () => {
    const calls = [];
    const fakeFetch = async (url, options = {}) => {
        calls.push({ url, options });

        if (url === METADATA_TOKEN_URL) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ access_token: "runtime-token" }),
            };
        }

        return {
            ok: true,
            status: 200,
            json: async () => ({
                routes: [
                    {
                        visits: [
                            { shipmentLabel: "job-b", shipmentIndex: 1 },
                            { shipmentLabel: "job-a" },
                        ],
                        metrics: {
                            travelDistanceMeters: 25000,
                            travelDuration: "3600s",
                        },
                    },
                ],
            }),
        };
    };

    const result = await callGoogleOptimizeTours(sampleRequest(), {
        fetchImpl: fakeFetch,
        projectId: "free-map-router",
    });

    assert.deepEqual(result, {
        requestId: "request-1",
        orderedStopIds: ["job-b", "job-a"],
        skippedStopIds: [],
        totalDistanceMeters: 25000,
        totalDurationSeconds: 3600,
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, METADATA_TOKEN_URL);
    assert.equal(calls[0].options.headers["Metadata-Flavor"], "Google");
    assert.equal(
        calls[1].url,
        "https://routeoptimization.googleapis.com/v1/projects/free-map-router:optimizeTours",
    );
    assert.equal(calls[1].options.headers.authorization, "Bearer runtime-token");

    const googleRequest = JSON.parse(calls[1].options.body);
    assert.deepEqual(
        googleRequest.model.shipments.map((shipment) => shipment.label),
        ["job-a", "job-b"],
    );
    assert.equal(JSON.stringify(googleRequest).includes("address"), false);
    assert.equal(JSON.stringify(googleRequest).includes("notes"), false);
});
