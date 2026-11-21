"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const RouteHistory = require("../route-history.js");
const RouteOrder = require("../route-order.js");
const RoutePlanDays = require("../route-plan-days.js");
const GoogleBrowser = require("../google-route-browser.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const browserSource = fs.readFileSync(path.join(__dirname, "..", "google-route-browser.js"), "utf8");

const ids = new Set(["s1", "s2", "s3", "new"]);

function memoryStorage() {
    const values = new Map();
    let writes = 0;
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { writes++; values.set(key, String(value)); },
        count() { return writes; },
    };
}

function context(date = "2026-11-20") {
    return {
        routeDate: date,
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function setup() {
    const storage = memoryStorage();
    const seeded = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: context(),
        google: {
            routeIds: ["s1", "s2", "s3"],
            sourceUpdatedAt: "2026-11-20T14:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { s1: ["ORDER-1"], s2: ["ORDER-2"] },
            gigIdsByStopId: { s3: ["GIG-3"] },
        },
        basic: {
            routeIds: ["s3", "s2", "s1"],
            sourceUpdatedAt: "2026-11-20T14:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: { s1: ["ORDER-1"], s2: ["ORDER-2"] },
            gigIdsByStopId: { s3: ["GIG-3"] },
        },
    }, ids);
    RouteHistory.writeRouteHistory(storage, seeded, ids);
    const current = () => RouteHistory.readRouteHistory(storage, ids);
    const expected = current();
    const insertion = (override = {}) => ({
        planId: expected.activePlan.planId,
        planRevision: expected.activePlan.revision,
        dayId: expected.activePlan.activeDayId,
        originalIds: ["s1", "s2", "s3"],
        newStopId: "new",
        orderedIds: ["s1", "new", "s2", "s3"],
        ...override,
    });
    return { storage, current, insertion };
}

test("one inserted saved address preserves old order, exact work IDs, Basic and route return, with a single write", () => {
    const harness = setup();
    const before = harness.current();
    assert.equal(RouteHistory.canInsertSavedStop(before, "new"), true);
    const beforeWrites = harness.storage.count();
    const result = RouteHistory.commitGoogleInsertion(
        harness.storage, harness.insertion(), ids,
    );
    assert.equal(harness.storage.count(), beforeWrites + 1);
    assert.deepEqual(result.google.routeIds, ["s1", "new", "s2", "s3"]);
    assert.equal(result.google.optimizationStatus, "google_optimized");
    assert.equal(result.google.schedule, null);
    assert.deepEqual(result.basic, before.basic);
    assert.deepEqual(result.google.orderIdsByStopId.s1, ["ORDER-1"]);
    assert.deepEqual(result.google.orderIdsByStopId.s2, ["ORDER-2"]);
    assert.deepEqual(result.google.gigIdsByStopId.s3, ["GIG-3"]);
    assert.equal(result.activePlan.standaloneStops.some((x) => x.stopId === "new"), true);
    const stops = {
        s1: { id: "s1", address: "100 First St" },
        s2: { id: "s2", address: "200 Second St" },
        s3: { id: "s3", address: "300 Third St" },
        new: { id: "new", address: "150 New Ave" },
    };
    const artifact = RouteOrder.buildActiveDayWorkbookRouteOrder({
        routeSlot: "google",
        routeHistory: harness.current(),
        routeStops: result.google.routeIds.map((id) => stops[id]),
        now: "2026-11-20T18:00:00.000Z",
    });
    assert.deepEqual(artifact.stops.map((s) => s.address), [
        "100 First St", "150 New Ave", "200 Second St", "300 Third St",
    ]);
    assert.deepEqual(artifact.stops[0].orderIds, ["ORDER-1"]);
    assert.deepEqual(artifact.stops[1].orderIds, []);
    assert.deepEqual(artifact.stops[3].gigIds, ["GIG-3"]);
});

test("insertion is rejected atomically if Google reorders old stops or repeats the new one", () => {
    const h = setup();
    const before = h.storage.getItem(RouteHistory.STORAGE_KEY);
    for (const orderedIds of [
        ["s2", "new", "s1", "s3"],
        ["s1", "new", "s2", "new"],
        ["s1", "s2", "s3"],
    ]) {
        assert.throws(
            () => RouteHistory.commitGoogleInsertion(h.storage, h.insertion({ orderedIds }), ids),
            /order|route was changed/i,
        );
        assert.equal(h.storage.getItem(RouteHistory.STORAGE_KEY), before);
    }
});

test("concurrent route editing and a changed active Day reject stale results without overwriting state", () => {
    const h = setup();
    const old = h.insertion();
    const changed = RouteHistory.replaceRoute(h.current(), "google", ["s3", "s2", "s1"], ids);
    RouteHistory.writeRouteHistory(h.storage, changed, ids);
    const afterChange = h.storage.getItem(RouteHistory.STORAGE_KEY);
    assert.throws(
        () => RouteHistory.commitGoogleInsertion(h.storage, old, ids),
        /route changed during calculation/,
    );
    assert.equal(h.storage.getItem(RouteHistory.STORAGE_KEY), afterChange);
});

test("a stop assigned to another Day is not eligible for insertion", () => {
    const h = setup();
    const current = h.current();
    const plan = RoutePlanDays.planFromAssignments({
        plan: current.activePlan,
        dayContexts: RoutePlanDays.buildDayContexts(context(), 2),
        assignmentByStopId: {
            s1: "2026-11-20",
            s2: "2026-11-21",
            s3: "2026-11-20",
        },
        activeRouteDate: "2026-11-20",
        replaceIdentity: true,
        identitySeed: "insert-fixture",
        now: "2026-11-20T18:00:00.000Z",
    });
    const second = plan.days[1];
    const newSecond = {
        ...second,
        google: {
            ...(second.google || {}),
            routeIds: [...(second.google?.routeIds || []), "new"],
        },
    };
    const otherDayPlan = RouteHistory.normalizeRouteHistory({
        version: 7,
        activePlan: {
            ...plan,
            standaloneStops: [
                ...plan.standaloneStops,
                { stopId: "new", assignedDate: "2026-11-21", lockedDay: true },
            ],
            days: [plan.days[0], newSecond],
        },
        pending: null,
    }, ids);
    assert.equal(RouteHistory.canInsertSavedStop(otherDayPlan, "new"), false);
});

test("insertion with a valid timed Google schedule saves it in the same atomic route write", () => {
    const h = setup();
    const ordered = h.insertion().orderedIds;
    const service = { s1: 300, s2: 300, s3: 300, new: 0 };
    const schedule = {
        basisKey: GoogleBrowser.buildScheduleBasisKey({
            routeIds: ordered,
            home: { address: "Home", latitude: 35, longitude: -99 },
            serviceByStopId: service,
            timing: {
                departureTime: "2026-11-20T14:00:00Z",
                homeByTime: "2026-11-20T23:00:00Z",
            },
        }),
        vehicleStartTime: "2026-11-20T14:00:00Z",
        vehicleEndTime: "2026-11-20T16:00:00Z",
        travelDurationSeconds: 3600,
        totalServiceDurationSeconds: 900,
        waitDurationSeconds: 0,
        visits: ordered.map((stopId, index) => ({
            stopId, startTime: `2026-11-20T1${4 + Math.floor(index / 2)}:${index % 2 ? "30" : "00"}:00Z`,
        })),
    };
    const before = h.storage.count();
    const result = RouteHistory.commitGoogleInsertion(
        h.storage, h.insertion({ schedule }), ids,
    );
    assert.equal(h.storage.count(), before + 1);
    assert.deepEqual(result.google.schedule.visits.map((v) => v.stopId), ordered);
    assert.equal(result.basic.schedule, null);
    assert.equal(h.current().google.schedule.basisKey, schedule.basisKey);
});

test("the existing Google optimize action is separate and the new saved-stop control is in Route Builder", () => {
    assert.match(html, /id="googleOptimizeRoute"/);
    assert.match(html, /id="googleInsertStopChoice"/);
    assert.match(html, /id="googleInsertStop"/);
    assert.ok(html.indexOf('id="googleInsertStopChoice"') < html.indexOf('id="routeOptimizeFeedback"'));
    assert.match(app, /function googleInsertionContext\(newStopId\)/);
    assert.match(app, /commitGoogleInsertion\(/);
    assert.match(app, /function renderGoogleInsertionChoices\(/);
    assert.match(browserSource, /insertionStopId: newStopId/);
    assert.match(browserSource, /assertPreparedContextCurrent\(prepared, currentPrepared\)/);
    assert.match(browserSource, /newStopButton\.addEventListener\("click"/);
});

async function runAuthenticatedInsertion({
    changeDuringCalculation = false,
    changeDuringPreview = false,
    decision = "continue",
    assumedStopId = "s2",
} = {}) {
    let authorize = null;
    let insertClick = null;
    let applied = null;
    let request = null;
    let status = "";
    let guard = "unchanged";
    let previewSnapshot = null;
    const actionHandlers = new Map();
    const reviewButton = (name) => ({
        addEventListener(event, fn) {
            if (event === "click") actionHandlers.set(name, fn);
        },
        removeEventListener(event, fn) {
            if (event === "click" && actionHandlers.get(name) === fn) actionHandlers.delete(name);
        },
    });
    const previewDialog = {
        open: false,
        handlers: new Map(),
        addEventListener(event, fn) { this.handlers.set(event, fn); },
        removeEventListener(event, fn) {
            if (this.handlers.get(event) === fn) this.handlers.delete(event);
        },
        showModal() {
            this.open = true;
            previewSnapshot = {
                address: elements.googleInsertionPreviewAddress.textContent,
                position: elements.googleInsertionPreviewPosition.textContent,
                map: elements.googleInsertionPreviewMap.textContent,
                backtrack: elements.googleInsertionPreviewBacktrack.textContent,
            };
            assert.equal(applied, null, "opening the preview must not commit a route");
            if (changeDuringPreview) guard = "changed";
            actionHandlers.get(decision === "cancel" ? "cancel" : "continue")();
        },
        close() { this.open = false; },
    };
    const button = (record) => ({
        disabled: true,
        addEventListener(event, fn) {
            if (event === "click" && record === "insert") insertClick = fn;
        },
    });
    const newStopButton = button("insert");
    const newStopSelect = { value: "new", disabled: false, addEventListener() {} };
    const elements = {
        googleRouteSignIn: { hidden: false },
        googleOptimizeRoute: button("regular"),
        googleInsertStop: newStopButton,
        googleInsertStopChoice: newStopSelect,
        googleRouteAuthStatus: { textContent: "" },
        googleInsertionPreviewDialog: previewDialog,
        googleInsertionPreviewAddress: { textContent: "" },
        googleInsertionPreviewPosition: { textContent: "" },
        googleInsertionPreviewMap: { textContent: "" },
        googleInsertionPreviewBacktrack: { textContent: "", dataset: {} },
        googleInsertionPreviewContinue: reviewButton("continue"),
        googleInsertionPreviewCancel: reviewButton("cancel"),
    };
    const dayContext = context();
    const history = {
        google: { routeIds: ["s1", "s2"] },
        dayContext,
    };
    const root = {
        document: {
            readyState: "complete",
            visibilityState: "hidden",
            getElementById(id) { return elements[id] || null; },
            addEventListener() {},
        },
        localStorage: { getItem() { return null; } },
        addEventListener() {},
        FMRRouting: require("../routing.js"),
        FMRAssumedRouteLocation: {
            read() { return assumedStopId ? { stopId: assumedStopId } : null; },
        },
        FMRRouteHistory: {
            readRouteHistory() { return history; },
            validateDayContext(value) {
                return { ok: true, dayContext: value };
            },
        },
        FMRWorkItemPlanningRuntime: {
            projectRoute() {
                return {
                    complete: true,
                    stops: [
                        { stopId: "s1", serviceMinutes: 5, items: [] },
                        { stopId: "s2", serviceMinutes: 5, items: [] },
                    ],
                };
            },
        },
        FMRWorkdayContext: {
            homeByRestrictionEnabled() { return false; },
        },
        FMRRouteBridge: {
            setRouteStatus() {},
            setOptimizerFeedback(text) { status = text; },
            setGoogleInsertionBusy(value) { newStopSelect.disabled = value; },
            googleInsertionContext(newStopId) {
                return {
                    planId: "plan",
                    planRevision: 1,
                    dayId: "day",
                    originalIds: ["s1", "s2"],
                    newStopId,
                    guard,
                };
            },
            async prepareGoogleInsertionSnapshot(newStopId) {
                return {
                    home: { address: "Home Base", latitude: 35, longitude: -99 },
                    stops: [
                        { id: "s1", address: "100 Main St" },
                        { id: "s2", address: "200 Main St" },
                        { id: newStopId, address: "150 New Ave" },
                    ],
                    insertion: { newStopId },
                };
            },
            applyGoogleInsertionResult(value) {
                if (guard !== value.expected.guard) {
                    throw new Error("The route changed while the preview was open. Nothing was inserted.");
                }
                applied = value;
            },
        },
        google: {
            accounts: {
                id: {
                    initialize(options) { authorize = options.callback; },
                    renderButton() {},
                },
            },
        },
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        assert.match(url, /\/optimize$/);
        request = JSON.parse(options.body);
        if (changeDuringCalculation) guard = "changed";
        return {
            ok: true,
            status: 200,
            async json() {
                return {
                    requestId: request.requestId,
                    orderedStopIds: ["s1", "new", "s2"],
                    skippedStopIds: [],
                    totalDistanceMeters: 16093,
                    totalDurationSeconds: 1800,
                };
            },
        };
    };
    try {
        assert.equal(GoogleBrowser.initializeBrowserUi(root), true);
        await authorize({ credential: "approved-test-token" });
        await insertClick();
    } finally {
        globalThis.fetch = originalFetch;
    }
    return { applied, request, status, preview: previewSnapshot };
}

test("signed-in insertion sends the unchanged two-stop chain plus new address and applies only the validated answer", async () => {
    const result = await runAuthenticatedInsertion();
    assert.deepEqual(result.request.stops.map((stop) => stop.id), ["s1", "s2", "new"]);
    assert.deepEqual(result.request.insertion, { newStopId: "new" });
    assert.equal(result.request.stops[2].serviceDurationSeconds, 0);
    assert.deepEqual(result.applied.response.orderedStopIds, ["s1", "new", "s2"]);
    assert.equal(result.applied.schedule, null);
    assert.match(result.preview.address, /150 New Ave/);
    assert.match(result.preview.position, /After: 100 Main St[\s\S]*Before: 200 Main St/);
    assert.match(result.preview.map, /Proposed Map 1 of 1/);
    assert.match(result.preview.backtrack, /Possible backtracking/);
    assert.match(result.status, /New stop inserted. All previous stops kept their order/);
});

test("signed-in insertion refuses a stale route changed during the Google request", async () => {
    const result = await runAuthenticatedInsertion({ changeDuringCalculation: true });
    assert.equal(result.applied, null);
    assert.match(result.status, /Nothing was inserted/);
});

test("Cancel does not write the previewed new stop", async () => {
    const result = await runAuthenticatedInsertion({ decision: "cancel" });
    assert.equal(result.applied, null);
    assert.match(result.preview.map, /Proposed Map/);
    assert.match(result.status, /cancelled.*unchanged/i);
});

test("Continue rejects stale route edits made while the preview is open", async () => {
    const result = await runAuthenticatedInsertion({ changeDuringPreview: true });
    assert.equal(result.applied, null);
    assert.match(result.status, /route changed.*Nothing was inserted/i);
});

test("preview uses existing map sections and compares order to Heading Here, not GPS", () => {
    const home = { address: "Home Base" };
    const old = Array.from({ length: 19 }, (_, i) => ({
        id: `s${i}`, address: `${100 + i} Main St`,
    }));
    const newStop = { id: "new", address: "152 New Ave" };
    const ordered = old.map((stop) => stop.id);
    ordered.splice(13, 0, "new");
    const preview = GoogleBrowser.buildGoogleInsertionPreview(
        { home, stops: [...old, newStop] },
        ordered, "new", "s15", require("../routing.js"),
    );
    assert.match(preview.mapSection, /Proposed Map 2 of 3/);
    assert.match(preview.backtrackingMessage, /Possible backtracking/);
    assert.equal(preview.backtracking, true);
    const withoutPosition = GoogleBrowser.buildGoogleInsertionPreview(
        { home, stops: [...old, newStop] },
        ordered, "new", "", require("../routing.js"),
    );
    assert.equal(withoutPosition.backtracking, null);
    assert.match(withoutPosition.backtrackingMessage, /check unavailable/);
    assert.throws(() => GoogleBrowser.buildGoogleInsertionPreview(
        { home, stops: [...old, newStop] },
        ["s1", "s0", ...ordered.slice(2)],
        "new", "s15", require("../routing.js"),
    ), /preserve the existing stop order/);
});

test("new stop review requires Continue and Cancel controls before a route write", () => {
    for (const id of [
        "googleInsertionPreviewDialog", "googleInsertionPreviewAddress",
        "googleInsertionPreviewPosition", "googleInsertionPreviewMap",
        "googleInsertionPreviewBacktrack", "googleInsertionPreviewContinue",
        "googleInsertionPreviewCancel",
    ]) {
        assert.match(html, new RegExp('id="' + id + '"'));
    }
    assert.match(html, /google-route-browser\.js\?v=1\.9\.3/);
});


test("actual Send Route Order serializes the inserted address-only stop without changing work IDs", async () => {
    const { createRouteOrderSendController } = require("../route-order-ui.js");
    const GigHandoff = require("../gig-handoff.js");
    const h = setup();
    RouteHistory.commitGoogleInsertion(h.storage, h.insertion(), ids);
    const addressById = {
        s1: "100 First St",
        s2: "200 Second St",
        s3: "300 Third St",
        new: "150 New Ave",
    };
    const current = h.current();
    const displayed = current.google.routeIds.map((stopId) => ({
        dataset: { stopId },
    }));
    const button = { dataset: {}, disabled: false, addEventListener(type, handler) {
        if (type === "click") this.handler = handler;
    } };
    const status = { textContent: "" };
    const writes = [];
    const controller = createRouteOrderSendController({
        contractApi: {
            readStops() {
                return {
                    stops: Object.entries(addressById).map(([id, address]) => ({
                        id, address,
                    })),
                };
            },
        },
        routeHistoryApi: RouteHistory,
        routeOrderApi: RouteOrder,
        gigHandoffApi: {
            ...GigHandoff,
            async saveGigHandoffToDrive(token, handoff) {
                writes.push({ type: "gig", content: JSON.stringify(handoff) });
            },
        },
        manualGigsProvider() {
            return [{
                id: "GIG-3",
                stopId: "s3",
                source: "HNP",
                workOrderId: "WORK-3",
                expectedPay: 25,
                dueDate: "2026-11-20",
                completedDate: null,
                notes: "",
                updatedAt: "2026-11-20T15:00:00.000Z",
            }];
        },
        driveApi: {
            async requestDriveToken() { return "fake-local-token"; },
            async saveRouteOrderToDrive(token, routeOrder) {
                writes.push({ type: "route", content: JSON.stringify(routeOrder) });
            },
        },
        storage: h.storage,
        documentRef: {
            getElementById(id) {
                return {
                    sendRouteOrder: button,
                    workbookRouteOrderStatus: status,
                    routeChoice: { value: "google" },
                }[id] || null;
            },
            querySelectorAll(selector) {
                assert.equal(selector, "#routeList > li[data-stop-id]");
                return displayed;
            },
        },
        now: () => new Date("2026-11-20T18:00:00.000Z"),
    });
    assert.equal(controller.attach(), true);
    button.handler({
        preventDefault() {},
        stopImmediatePropagation() {},
    });
    await controller.whenIdle();
    assert.deepEqual(writes.map((item) => item.type), ["gig", "route"]);
    const handoff = JSON.parse(writes[0].content);
    const sent = JSON.parse(writes[1].content);
    assert.equal(sent.routeOrderVersion, 2);
    assert.equal(sent.routeScope, "active_day");
    assert.equal(sent.routeSlot, "google");
    assert.equal(sent.sourceUpdatedAt, "2026-11-20T14:00:00.000Z");
    assert.equal(sent.updatedAt, handoff.updatedAt);
    assert.equal(sent.routePlan.routeDate, "2026-11-20");
    assert.deepEqual(sent.stops, [
        { stopNumber: 1, address: "100 First St", orderIds: ["ORDER-1"] },
        { stopNumber: 2, address: "150 New Ave", orderIds: [] },
        { stopNumber: 3, address: "200 Second St", orderIds: ["ORDER-2"] },
        { stopNumber: 4, address: "300 Third St", orderIds: [], gigIds: ["GIG-3"] },
    ]);
    assert.deepEqual(handoff.gigs.map((item) => item.gigId), ["GIG-3"]);
    assert.match(status.textContent, /2 InspectorADE jobs/);
    assert.match(status.textContent, /1 manual gig/);
    assert.match(status.textContent, /4 physical stops \(1 address-only\)/);
    assert.deepEqual(h.current().basic.routeIds, ["s3", "s2", "s1"]);
    assert.equal(h.current().pending, null);
    // The Drive stubs capture payloads in memory only; no shared handoff is written.
});
