"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const settings = require("../settings.js");
const routing = require("../routing.js");
const browser = require("../google-route-browser.js");
const contract = require("../google-route-contract.js");
const provider = require("../google-route-provider.js");
const server = require("../google-route-server.js");
const history = require("../route-history.js");
const planning = require("../route-work-planning.js");
const workday = require("../workday-context.js");

function memoryStorage() {
    const data = new Map();
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value)),
    };
}

function fakeDocument() {
    const elements = new Map();
    for (const id of ["routeAvoidTolls", "routeAvoidTollsState", "routeOptimizeFeedback"]) {
        const listeners = new Map();
        elements.set(id, {
            dataset: {}, checked: false, textContent: "",
            addEventListener: (type, listener) => listeners.set(type, listener),
            fire: (type) => listeners.get(type)?.(),
        });
    }
    return { getElementById: (id) => elements.get(id) || null };
}

const home = { address: "100 Example Home Lane", latitude: 35.4, longitude: -99.4 };
const stops = [
    { id: "a", address: "101 Example Lane", serviceDurationSeconds: 300 },
    { id: "b", address: "102 Example Lane", latitude: 35.5, longitude: -99.5, pinStatus: "manual", serviceDurationSeconds: 300 },
];
const dayContext = {
    routeDate: "2026-11-13", departureTime: "07:00", preferredFinishTime: "15:00",
    homeByTime: "18:00", timeZone: "America/Chicago",
};

async function prepared(storage, enforceHomeBy) {
    const snapshot = { routeIds: ["a", "b"], orderIdsByStopId: { a: ["ORDER-A"], b: ["ORDER-B"] } };
    history.writeRouteHistory(storage, { version: 6, dayContext, google: snapshot, basic: snapshot }, new Set(["a", "b"]));
    return browser.prepareTimeAwareSnapshot({
        prepareSelectedRouteSnapshot: async () => ({ home, stops }),
    }, {
        storage, enforceHomeBy,
        root: {
            FMRSettings: settings, FMRRouteHistory: history, FMRWorkdayContext: workday,
            FMRWorkItemPlanningRuntime: { projectRoute: (route) => planning.buildRoutePlanningProjection(route, []) },
        },
    });
}

test("Avoid tolls defaults ON; both choices restore on reload and write only their setting", () => {
    const storage = memoryStorage();
    storage.setItem("fmr_route_history_v1", "protected-route");
    storage.setItem("fmr_work_item_planning_v1", "protected-planning");
    let notifications = 0;
    let document = fakeDocument();
    settings.bindAvoidTollsControl({ document, storage, onChange: () => notifications++ });
    assert.equal(document.getElementById("routeAvoidTolls").checked, true);
    assert.equal(notifications, 0);
    for (const choice of [false, true, false]) {
        const toggle = document.getElementById("routeAvoidTolls");
        toggle.checked = choice;
        toggle.fire("change");
        assert.equal(storage.getItem(settings.AVOID_TOLLS_KEY), String(choice));
        document = fakeDocument();
        settings.bindAvoidTollsControl({ document, storage });
        assert.equal(document.getElementById("routeAvoidTolls").checked, choice);
        assert.equal(document.getElementById("routeAvoidTollsState").textContent, choice ? "ON" : "OFF");
    }
    assert.equal(storage.getItem("fmr_route_history_v1"), "protected-route");
    assert.equal(storage.getItem("fmr_work_item_planning_v1"), "protected-planning");
});

test("an unsaved toll choice is restored if browser storage rejects the write", () => {
    const document = fakeDocument();
    let changed = false;
    settings.bindAvoidTollsControl({ document, storage: { getItem: () => "false", setItem: () => { throw Error("storage full"); } }, onChange: () => changed = true });
    document.getElementById("routeAvoidTolls").checked = true;
    document.getElementById("routeAvoidTolls").fire("change");
    assert.equal(changed, false);
    assert.equal(document.getElementById("routeAvoidTolls").checked, false);
    assert.match(document.getElementById("routeOptimizeFeedback").textContent, /could not be saved/);
});

for (const avoidTolls of [true, false]) {
    test(`saved ${avoidTolls ? "ON" : "OFF"} reaches actual browser, server validation, address resolution, and Google vehicle JSON`, async () => {
        const storage = memoryStorage();
        settings.writeAvoidTolls(storage, avoidTolls);
        const initial = await prepared(storage, false);
        assert.equal(initial.snapshot.avoidTolls, avoidTolls);
        assert.equal(initial.snapshot.timing, undefined);
        const googleBodies = [];
        const googleFetch = async (url, options = {}) => {
            if (url === server.METADATA_TOKEN_URL) return { ok: true, json: async () => ({ access_token: "test-runtime-token" }) };
            if (url.startsWith(server.GOOGLE_GEOCODE_ENDPOINT)) return { ok: true, json: async () => ({ results: [{ location: { latitude: 35.6, longitude: -99.6 } }] }) };
            googleBodies.push(JSON.parse(options.body));
            return { ok: true, json: async () => ({ routes: [{ visits: [{ shipmentLabel: "b" }, { shipmentLabel: "a" }], metrics: { travelDistanceMeters: 1234, travelDuration: "1800s" } }] }) };
        };
        const handler = server.createRequestHandler({ optimize: (request) => server.callGoogleOptimizeTours(request, { fetchImpl: googleFetch, projectId: "test-project" }) });
        const result = await browser.optimizeWithGoogle({
            snapshot: initial.snapshot, idToken: "test-identity", id: "toll-test",
            fetchImpl: async (url, options) => {
                assert.match(url, /\/optimize$/);
                const request = Readable.from([Buffer.from(options.body)]);
                request.url = "/optimize";
                request.method = "POST";
                request.headers = options.headers;
                let responseBody;
                let status;
                await handler(request, { writeHead: (code) => status = code, end: (body) => responseBody = JSON.parse(body) });
                return { ok: status === 200, status, json: async () => responseBody };
            },
        });
        assert.equal(result.request.avoidTolls, avoidTolls);
        assert.equal(result.response.avoidTolls, avoidTolls);
        assert.deepEqual(result.response.orderedStopIds, ["b", "a"]);
        assert.equal(googleBodies.length, 1);
        assert.deepEqual(googleBodies[0].model.vehicles[0].routeModifiers, { avoidTolls });
        assert.deepEqual(googleBodies[0].model.shipments.map((x) => x.label), ["a", "b"]);
        assert.deepEqual(googleBodies[0].model.shipments[1].deliveries[0].arrivalLocation, { latitude: 35.5, longitude: -99.5 });
    });
}

test("timed preparation and provider requests carry the same persisted toll preference", async () => {
    for (const choice of [true, false]) {
        const storage = memoryStorage();
        settings.writeAvoidTolls(storage, choice);
        const value = await prepared(storage, true);
        assert.equal(value.snapshot.avoidTolls, choice);
        const request = browser.buildBrowserRequest(value.snapshot, "timed-tolls");
        const resolved = await server.resolveGoogleRouteRequest(request, { geocode: async () => ({ latitude: 35.6, longitude: -99.6 }) });
        const google = provider.buildGoogleOptimizeToursRequest(resolved);
        assert.equal(google.model.vehicles[0].routeModifiers.avoidTolls, choice);
        assert.equal(google.model.vehicles[0].startTimeWindows[0].startTime, request.timing.departureTime);
    }
});

test("invalid choices and unacknowledged or mismatched backend results fail before route application", async () => {
    const request = browser.buildBrowserRequest({ home, stops, avoidTolls: true }, "toll-test");
    for (const value of [null, "false", 0, {}, []]) {
        assert.throws(() => contract.buildBackendRequest({ ...request, avoidTolls: value }), { code: "INVALID_TOLL_PREFERENCE" });
    }
    for (const acknowledgement of [undefined, false, "true"]) {
        await assert.rejects(browser.optimizeWithGoogle({
            snapshot: { home, stops, avoidTolls: true }, id: "toll-test", idToken: "test-identity",
            fetchImpl: async () => ({ ok: true, json: async () => ({ requestId: "toll-test", orderedStopIds: ["b", "a"], avoidTolls: acknowledgement }) }),
        }), { code: "TOLL_PREFERENCE_NOT_CONFIRMED" });
    }
    const legacy = browser.buildBrowserRequest({ home, stops }, "legacy-request");
    assert.equal(Object.hasOwn(legacy, "avoidTolls"), false);
    assert.deepEqual(contract.validateBackendResponse(legacy, { requestId: legacy.requestId, orderedStopIds: ["a", "b"] }).orderedStopIds, ["a", "b"]);
});

test("changing the toll choice during optimization rejects the result and changes schedule freshness", async () => {
    const storage = memoryStorage();
    settings.writeAvoidTolls(storage, true);
    const before = await prepared(storage, false);
    settings.writeAvoidTolls(storage, false);
    const after = await prepared(storage, false);
    assert.throws(() => browser.assertPreparedContextCurrent(before, after), { code: "STALE_ROUTE" });
    const basis = { routeIds: ["a", "b"], home, serviceByStopId: { a: 300, b: 300 } };
    assert.notEqual(browser.buildScheduleBasisKey({ ...basis, avoidTolls: true }), browser.buildScheduleBasisKey({ ...basis, avoidTolls: false }));
});

test("all map sections and first/next/Home navigation carry ON or OFF without changing stop order", () => {
    const list = Array.from({ length: 22 }, (_, i) => ({ id: String(i), address: `${100+i} Example Lane` }));
    for (const choice of [true, false]) {
        const options = { avoidTolls: choice };
        const plain = routing.buildGoogleMapsRouteSections(home, list);
        const sections = routing.buildGoogleMapsRouteSections(home, list, 9, options);
        assert.equal(sections.length, plain.length);
        for (let i = 0; i < sections.length; i++) {
            const url = new URL(sections[i].url);
            assert.equal(url.searchParams.get("avoid"), choice ? "tolls" : null);
            assert.deepEqual([sections[i].origin, ...sections[i].waypoints, sections[i].destination], [plain[i].origin, ...plain[i].waypoints, plain[i].destination]);
        }
        for (const stop of [list[0], list[1], home]) assert.equal(new URL(routing.buildGoogleMapsNavigationUrl(stop, options)).searchParams.get("avoid"), choice ? "tolls" : null);
        assert.equal(new URL(routing.buildGoogleMapsDirectionsUrl(home, list.slice(0, 2), options)).searchParams.get("avoid"), choice ? "tolls" : null);
    }
});
