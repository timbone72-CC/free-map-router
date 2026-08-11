"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const {
    GOOGLE_GEOCODE_ENDPOINT,
    METADATA_TOKEN_URL,
    callGoogleOptimizeTours,
    createRequestHandler,
    geocodeAddressWithGoogle,
    resolveGoogleRouteRequest,
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
            { id: "job-a", address: "101 Main St, Elk City, OK" },
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
        request.stops[1].latitude = null;

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

test("Google geocoder returns a validated coordinate pair", async () => {
    const calls = [];
    const result = await geocodeAddressWithGoogle(
        "11269 N 1960 CIR, Elk City, OK 73644",
        {
            accessToken: "runtime-token",
            fetchImpl: async (url, options) => {
                calls.push({ url, options });
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [
                            {
                                location: {
                                    latitude: 35.3880075,
                                    longitude: -99.481198,
                                },
                            },
                        ],
                    }),
                };
            },
        },
    );

    assert.deepEqual(result, {
        latitude: 35.3880075,
        longitude: -99.481198,
    });
    assert.match(calls[0].url, new RegExp(`^${GOOGLE_GEOCODE_ENDPOINT}/`));
    assert.match(calls[0].url, /11269%20N%201960%20CIR/);
    assert.equal(calls[0].options.headers.authorization, "Bearer runtime-token");
});

test("Google geocoder fails closed when an address has no result", async () => {
    await assert.rejects(
        geocodeAddressWithGoogle("Unknown rural address", {
            accessToken: "runtime-token",
            fetchImpl: async () => ({
                ok: true,
                status: 200,
                json: async () => ({ results: [] }),
            }),
        }),
        (error) =>
            error.code === "ADDRESS_NOT_FOUND" &&
            error.statusCode === 422 &&
            error.message.includes("Unknown rural address"),
    );
});

test("route resolution geocodes ordinary addresses and preserves manual pins", async () => {
    const geocoded = [];
    const result = await resolveGoogleRouteRequest(sampleRequest(), {
        accessToken: "runtime-token",
        geocode: async (address) => {
            geocoded.push(address);
            return { latitude: 35.51, longitude: -99.49 };
        },
    });

    assert.deepEqual(geocoded, ["101 Main St, Elk City, OK"]);
    assert.deepEqual(result.stops, [
        { id: "job-a", latitude: 35.51, longitude: -99.49 },
        { id: "job-b", latitude: 35.61, longitude: -99.59 },
    ]);
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

test("Cloud Run geocodes addresses before calling optimizeTours", async () => {
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

        if (url.startsWith(GOOGLE_GEOCODE_ENDPOINT)) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    results: [
                        {
                            location: {
                                latitude: 35.51,
                                longitude: -99.49,
                            },
                        },
                    ],
                }),
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
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, METADATA_TOKEN_URL);
    assert.equal(calls[0].options.headers["Metadata-Flavor"], "Google");
    assert.equal(
        calls[2].url,
        "https://routeoptimization.googleapis.com/v1/projects/free-map-router:optimizeTours",
    );
    assert.equal(calls[1].options.headers.authorization, "Bearer runtime-token");
    assert.equal(calls[2].options.headers.authorization, "Bearer runtime-token");

    const googleRequest = JSON.parse(calls[2].options.body);
    assert.deepEqual(
        googleRequest.model.shipments.map((shipment) => shipment.label),
        ["job-a", "job-b"],
    );
    assert.equal(JSON.stringify(googleRequest).includes("address"), false);
    assert.equal(JSON.stringify(googleRequest).includes("notes"), false);
});

test("Google validation detail reaches the app without exposing the request", async () => {
    const fakeFetch = async (url) => {
        if (url === METADATA_TOKEN_URL) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ access_token: "runtime-token" }),
            };
        }

        if (String(url).startsWith(GOOGLE_GEOCODE_ENDPOINT)) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    results: [
                        {
                            location: {
                                latitude: 35.51,
                                longitude: -99.49,
                            },
                        },
                    ],
                }),
            };
        }

        return {
            ok: false,
            status: 400,
            json: async () => ({
                error: {
                    message: "Request contains an invalid argument.",
                    details: [
                        {
                            fieldViolations: [
                                {
                                    field: "model.global_start_time",
                                    description: "Start time must be in the future.",
                                },
                            ],
                        },
                    ],
                },
            }),
        };
    };

    await assert.rejects(
        () =>
            callGoogleOptimizeTours(sampleRequest(), {
                fetchImpl: fakeFetch,
                projectId: "free-map-router",
            }),
        (error) => {
            assert.equal(error.statusCode, 502);
            assert.equal(error.code, "GOOGLE_ROUTE_FAILED");
            assert.equal(
                error.message,
                "Google rejected the route request: model.global_start_time: Start time must be in the future.",
            );
            assert.equal(error.message.includes("101 Main St"), false);
            return true;
        },
    );
});
