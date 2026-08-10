"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { createRequestHandler } = require("../google-route-server.js");
const {
    RouteAuthenticationError,
} = require("../google-route-auth.js");

const ALLOWED_ORIGIN = "https://timbone72-cc.github.io";

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
        requestId: "browser-request-1",
        home: { latitude: 35.411, longitude: -99.404 },
        stops: [
            { id: "job-a", latitude: 35.51, longitude: -99.49 },
            { id: "job-b", latitude: 35.61, longitude: -99.59 },
        ],
    };
}

function authenticatedHandler({ authenticate } = {}) {
    return createRequestHandler({
        allowedOrigin: ALLOWED_ORIGIN,
        authenticate:
            authenticate ||
            (async (request) => {
                assert.equal(
                    request.headers.authorization,
                    "Bearer company-google-token",
                );
                return {
                    subject: "company-account-subject",
                    email: "inandoutinspections2026@gmail.com",
                };
            }),
        optimize: async (request) => ({
            requestId: request.requestId,
            orderedStopIds: ["job-b", "job-a"],
            skippedStopIds: [],
            totalDistanceMeters: 12345,
            totalDurationSeconds: 1800,
        }),
    });
}

test("approved GitHub Pages origin receives a narrow CORS preflight", async () => {
    await withServer(authenticatedHandler(), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/optimize`, {
            method: "OPTIONS",
            headers: {
                origin: ALLOWED_ORIGIN,
                "access-control-request-method": "POST",
                "access-control-request-headers": "authorization,content-type",
            },
        });

        assert.equal(response.status, 204);
        assert.equal(
            response.headers.get("access-control-allow-origin"),
            ALLOWED_ORIGIN,
        );
        assert.equal(
            response.headers.get("access-control-allow-methods"),
            "GET, POST, OPTIONS",
        );
        assert.equal(
            response.headers.get("access-control-allow-headers"),
            "Authorization, Content-Type",
        );
    });
});

test("authenticated company account can read the backend workbook inbox", async () => {
    const inbox = {
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-08-10T18:00:00.000Z",
        addresses: [{ address: "100 Main St, Elk City, OK 73644" }],
    };
    const handler = createRequestHandler({
        allowedOrigin: ALLOWED_ORIGIN,
        authenticate: async () => ({
            subject: "company-account-subject",
            email: "inandoutinspections2026@gmail.com",
        }),
        readInbox: async () => inbox,
    });

    await withServer(handler, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/workbook-inbox`, {
            headers: {
                origin: ALLOWED_ORIGIN,
                authorization: "Bearer company-google-token",
            },
        });

        assert.equal(response.status, 200);
        assert.equal(
            response.headers.get("access-control-allow-origin"),
            ALLOWED_ORIGIN,
        );
        assert.deepEqual(await response.json(), inbox);
    });
});

test("workbook inbox is not read before company authentication", async () => {
    let readerCalled = false;
    const handler = createRequestHandler({
        allowedOrigin: ALLOWED_ORIGIN,
        authenticate: async () => {
            throw new RouteAuthenticationError(
                401,
                "SIGN_IN_REQUIRED",
                "Sign in with the approved company Google account.",
            );
        },
        readInbox: async () => {
            readerCalled = true;
            return {};
        },
    });

    await withServer(handler, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/workbook-inbox`, {
            headers: { origin: ALLOWED_ORIGIN },
        });

        assert.equal(response.status, 401);
        assert.equal(readerCalled, false);
    });
});

test("authenticated company request reaches optimization", async () => {
    await withServer(authenticatedHandler(), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/optimize`, {
            method: "POST",
            headers: {
                origin: ALLOWED_ORIGIN,
                authorization: "Bearer company-google-token",
                "content-type": "application/json",
            },
            body: JSON.stringify(sampleRequest()),
        });

        assert.equal(response.status, 200);
        assert.equal(
            response.headers.get("access-control-allow-origin"),
            ALLOWED_ORIGIN,
        );
        assert.deepEqual(await response.json(), {
            requestId: "browser-request-1",
            orderedStopIds: ["job-b", "job-a"],
            skippedStopIds: [],
            totalDistanceMeters: 12345,
            totalDurationSeconds: 1800,
        });
    });
});

test("wrong origin is rejected before authentication or optimization", async () => {
    let authenticated = false;
    const handler = authenticatedHandler({
        authenticate: async () => {
            authenticated = true;
        },
    });

    await withServer(handler, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/optimize`, {
            method: "POST",
            headers: {
                origin: "https://example.com",
                authorization: "Bearer company-google-token",
                "content-type": "application/json",
            },
            body: JSON.stringify(sampleRequest()),
        });

        assert.equal(response.status, 403);
        assert.equal(authenticated, false);
        const body = await response.json();
        assert.equal(body.code, "ORIGIN_NOT_ALLOWED");
        assert.equal(response.headers.get("access-control-allow-origin"), null);
    });
});

test("missing or disallowed account token fails closed", async () => {
    const handler = authenticatedHandler({
        authenticate: async () => {
            throw new RouteAuthenticationError(
                403,
                "ACCOUNT_NOT_ALLOWED",
                "Use the approved company Google account for road optimization.",
            );
        },
    });

    await withServer(handler, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/optimize`, {
            method: "POST",
            headers: {
                origin: ALLOWED_ORIGIN,
                authorization: "Bearer personal-google-token",
                "content-type": "application/json",
            },
            body: JSON.stringify(sampleRequest()),
        });

        assert.equal(response.status, 403);
        assert.equal(
            response.headers.get("access-control-allow-origin"),
            ALLOWED_ORIGIN,
        );
        const body = await response.json();
        assert.equal(body.code, "ACCOUNT_NOT_ALLOWED");
    });
});
