"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    GoogleRouteBrowserError,
    buildBrowserRequest,
    duplicateCoordinateGroups,
    formatMetrics,
    initializeBrowserUi,
    loadWorkbookInboxFromBackend,
    optimizeWithGoogle,
    prepareSnapshotForGoogle,
} = require("../google-route-browser.js");

test("successful Google sign-in loads the backend workbook inbox through the app bridge", async () => {
    const signInContainer = { hidden: false };
    const optimizeButton = {
        disabled: true,
        addEventListener() {},
    };
    const authStatus = { textContent: "" };
    let credentialCallback = null;
    let renderedInto = null;
    let appliedInbox = null;
    const elements = {
        googleRouteSignIn: signInContainer,
        googleOptimizeRoute: optimizeButton,
        googleRouteAuthStatus: authStatus,
    };
    const root = {
        document: {
            readyState: "complete",
            visibilityState: "visible",
            getElementById(id) {
                return elements[id] || null;
            },
        },
        FMRRouteBridge: {
            setRouteStatus() {},
            async applyWorkbookInboxFromBackend(inbox, options) {
                appliedInbox = { inbox, options };
            },
        },
        google: {
            accounts: {
                id: {
                    initialize(options) {
                        credentialCallback = options.callback;
                    },
                    renderButton(container) {
                        renderedInto = container;
                    },
                },
            },
        },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            app: "free-map-router",
            inboxVersion: 1,
            source: "InspectorADE Repeat Job Predictor - LIVE",
            updatedAt: "2026-08-10T18:00:00.000Z",
            addresses: [{ address: "101 Main St, Elk City, OK" }],
        }),
    });

    try {
        assert.equal(initializeBrowserUi(root), true);
        assert.equal(renderedInto, signInContainer);
        assert.equal(signInContainer.hidden, false);

        await credentialCallback({ credential: "company-google-id-token" });
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(optimizeButton.disabled, false);
    assert.equal(signInContainer.hidden, true);
    assert.equal(
        appliedInbox.inbox.addresses[0].address,
        "101 Main St, Elk City, OK",
    );
    assert.deepEqual(appliedInbox.options, {
        allowStaleConfirmation: true,
    });
    assert.equal(
        authStatus.textContent,
        "Signed in for this browser session. Google Optimize will verify the approved company account.",
    );
});

test("rejected Google sign-in restores the account chooser", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    const signInContainer = { hidden: false };
    let optimizeClick = null;
    const optimizeButton = {
        disabled: true,
        addEventListener(eventName, callback) {
            if (eventName === "click") optimizeClick = callback;
        },
    };
    const authStatus = { textContent: "" };
    let credentialCallback = null;
    const elements = {
        googleRouteSignIn: signInContainer,
        googleOptimizeRoute: optimizeButton,
        googleRouteAuthStatus: authStatus,
    };
    const root = {
        document: {
            readyState: "complete",
            visibilityState: "visible",
            getElementById(id) {
                return elements[id] || null;
            },
        },
        FMRRouteBridge: {
            setRouteStatus() {},
            prepareSelectedRouteSnapshot: async () => snapshot(),
        },
        google: {
            accounts: {
                id: {
                    initialize(options) {
                        credentialCallback = options.callback;
                    },
                    renderButton() {},
                },
            },
        },
    };
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({
            code: "ACCOUNT_NOT_ALLOWED",
            message: "Use the approved company Google account.",
        }),
    });

    assert.equal(initializeBrowserUi(root), true);
    await credentialCallback({ credential: "personal-google-id-token" });
    assert.equal(signInContainer.hidden, true);

    await optimizeClick();

    assert.equal(signInContainer.hidden, false);
    assert.equal(optimizeButton.disabled, true);
    assert.equal(
        authStatus.textContent,
        "Sign-in expired or the account was not approved. Sign in again with the company account.",
    );
});

test("returning to the signed-in app refreshes the backend inbox once", async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    const signInContainer = { hidden: false };
    const optimizeButton = {
        disabled: true,
        addEventListener() {},
    };
    const authStatus = { textContent: "" };
    let credentialCallback = null;
    let focusListener = null;
    let visibilityListener = null;
    let releaseRefresh = null;
    let fetchCount = 0;
    const applied = [];
    const elements = {
        googleRouteSignIn: signInContainer,
        googleOptimizeRoute: optimizeButton,
        googleRouteAuthStatus: authStatus,
    };
    const root = {
        addEventListener(eventName, callback) {
            if (eventName === "focus") focusListener = callback;
        },
        document: {
            readyState: "complete",
            visibilityState: "visible",
            getElementById(id) {
                return elements[id] || null;
            },
            addEventListener(eventName, callback) {
                if (eventName === "visibilitychange") {
                    visibilityListener = callback;
                }
            },
        },
        FMRRouteBridge: {
            setRouteStatus() {},
            async applyWorkbookInboxFromBackend(inbox, options) {
                applied.push({ inbox, options });
            },
        },
        google: {
            accounts: {
                id: {
                    initialize(options) {
                        credentialCallback = options.callback;
                    },
                    renderButton() {},
                },
            },
        },
    };

    globalThis.fetch = async () => {
        fetchCount += 1;
        if (fetchCount === 2) {
            await new Promise((resolve) => {
                releaseRefresh = resolve;
            });
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                app: "free-map-router",
                inboxVersion: 1,
                source: "InspectorADE Repeat Job Predictor - LIVE",
                updatedAt:
                    fetchCount === 1
                        ? "2026-08-10T18:00:00.000Z"
                        : "2026-08-10T19:00:00.000Z",
                addresses: [{ address: `${fetchCount} Main St, Elk City, OK` }],
            }),
        };
    };

    assert.equal(initializeBrowserUi(root), true);
    await credentialCallback({ credential: "company-google-id-token" });
    assert.equal(fetchCount, 1);
    assert.equal(applied.length, 1);

    const focusRefresh = focusListener();
    visibilityListener();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fetchCount, 2);

    releaseRefresh();
    await focusRefresh;
    assert.equal(applied.length, 2);
    assert.deepEqual(applied[1].options, {
        allowStaleConfirmation: false,
    });
});

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
                pinStatus: "geocoded",
            },
            {
                id: "job-b",
                address: "202 Main St, Elk City, OK",
                source: "DCFS",
                notes: "another private note",
                latitude: 35.45,
                longitude: -99.42,
                pinStatus: "manual",
            },
        ],
    };
}

test("browser request sends written addresses except for manual pins", () => {
    const request = buildBrowserRequest(snapshot(), "browser-request-1");

    assert.deepEqual(request, {
        requestId: "browser-request-1",
        home: {
            latitude: 35.4301483,
            longitude: -99.4031811,
        },
        stops: [
            { id: "job-a", address: "101 Main St, Elk City, OK" },
            { id: "job-b", latitude: 35.45, longitude: -99.42 },
        ],
    });

    const serialized = JSON.stringify(request);
    assert.equal(serialized.includes("Blackburn"), false);
    assert.equal(serialized.includes("101 Main St"), true);
    assert.equal(serialized.includes("private note"), false);
    assert.equal(serialized.includes("GIS"), false);
    assert.equal(serialized.includes("DCFS"), false);
});

test("duplicate manual coordinates stop the browser request", () => {
    const route = snapshot();
    route.stops[0].pinStatus = "manual";
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

test("duplicate automatic coordinates do not block address-first optimization", () => {
    const route = snapshot();
    route.stops[1].pinStatus = "geocoded";
    route.stops[1].latitude = route.stops[0].latitude;
    route.stops[1].longitude = route.stops[0].longitude;

    assert.equal(duplicateCoordinateGroups(route.stops).length, 0);
    const request = buildBrowserRequest(route, "browser-request-1");
    assert.deepEqual(request.stops, [
        { id: "job-a", address: "101 Main St, Elk City, OK" },
        { id: "job-b", address: "202 Main St, Elk City, OK" },
    ]);
});

test("blank coordinates are missing, not duplicate saved pins", () => {
    const route = snapshot();
    route.stops.forEach((stop) => {
        stop.latitude = null;
        stop.longitude = null;
    });

    assert.equal(duplicateCoordinateGroups(route.stops).length, 0);
});

test("Google preparation waits for the app snapshot", async () => {
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

test("backend workbook inbox read uses GET, no-store, and the memory-only company token", async () => {
    const calls = [];
    const inbox = {
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-08-10T18:00:00.000Z",
        addresses: [{ address: "101 Main St, Elk City, OK" }],
    };

    const result = await loadWorkbookInboxFromBackend({
        idToken: "company-google-id-token",
        backendUrl: "https://optimizer.example",
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return {
                ok: true,
                status: 200,
                json: async () => inbox,
            };
        },
    });

    assert.deepEqual(result, inbox);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://optimizer.example/workbook-inbox");
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(
        calls[0].options.headers.authorization,
        "Bearer company-google-id-token",
    );
    assert.equal(JSON.stringify(calls[0]).includes("body"), false);
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
