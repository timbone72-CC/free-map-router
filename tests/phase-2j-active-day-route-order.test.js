"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RouteHistory = require("../route-history.js");
const RoutePlanDays = require("../route-plan-days.js");
const RouteOrder = require("../route-order.js");
const GigHandoff = require("../gig-handoff.js");
const { createRouteOrderSendController } = require("../route-order-ui.js");
const {
    ACTIVE_DAY_ROUTE_ORDER_VERSION,
    ACTIVE_DAY_ROUTE_SCOPE,
    buildActiveDayWorkbookRouteOrder,
    manualGigIdCount,
    workbookOrderIdCount,
} = RouteOrder;

function dayContext(routeDate = "2026-09-09") {
    return {
        routeDate,
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function savedStops() {
    return [
        { id: "s1", address: "100 First St" },
        { id: "s2", address: "200 Second St" },
        { id: "s3", address: "300 Manual St" },
        { id: "s4", address: "400 App Only St" },
    ];
}

function stopsFor(routeIds) {
    const byId = new Map(savedStops().map((stop) => [stop.id, stop]));
    return routeIds.map((stopId) => ({ ...byId.get(stopId) }));
}

function multiDayHistory() {
    const oneDay = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: dayContext(),
        google: {
            routeIds: ["s1", "s4", "s3", "s2"],
            sourceUpdatedAt: "2026-09-09T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                s1: ["ORDER-A", "ORDER-B"],
                s2: ["ORDER-C"],
            },
            gigIdsByStopId: { s3: ["GIG-1"] },
            gigManagedStopIds: ["s3"],
        },
        basic: {
            routeIds: ["s3", "s4", "s1", "s2"],
            sourceUpdatedAt: "2026-09-09T12:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: {
                s1: ["ORDER-A", "ORDER-B"],
                s2: ["ORDER-C"],
            },
            gigIdsByStopId: { s3: ["GIG-1"] },
            gigManagedStopIds: ["s3"],
        },
    });
    const plan = RoutePlanDays.planFromAssignments({
        plan: oneDay.activePlan,
        dayContexts: RoutePlanDays.buildDayContexts(dayContext(), 2),
        assignmentByStopId: {
            s1: "2026-09-09",
            s2: "2026-09-10",
            s3: "2026-09-09",
            s4: "2026-09-09",
        },
        activeRouteDate: "2026-09-09",
        replaceIdentity: true,
        identitySeed: "phase-2j-producer",
        now: "2026-09-09T12:30:00.000Z",
    });
    return RouteHistory.normalizeRouteHistory(
        { version: 7, activePlan: plan, pending: null },
        new Set(savedStops().map((stop) => stop.id)),
    );
}

function buildFor(history, slot = "google", now = "2026-09-09T13:00:00.000Z") {
    const snapshot = history[slot];
    return buildActiveDayWorkbookRouteOrder({
        routeSlot: slot,
        routeHistory: history,
        routeStops: stopsFor(snapshot.routeIds),
        now,
    });
}

test("real multi-day Route Plan emits only the active Day with exact v2 metadata and visible numbering gaps", () => {
    const history = multiDayHistory();
    const routeOrder = buildFor(history);

    assert.equal(routeOrder.routeOrderVersion, ACTIVE_DAY_ROUTE_ORDER_VERSION);
    assert.equal(routeOrder.routeOrderVersion, 2);
    assert.equal(routeOrder.routeScope, ACTIVE_DAY_ROUTE_SCOPE);
    assert.equal(routeOrder.routeScope, "active_day");
    assert.equal(routeOrder.routeSlot, "google");
    assert.equal(routeOrder.optimizationStatus, history.google.optimizationStatus);
    assert.equal(routeOrder.optimizationStatus, "not_optimized");
    assert.equal(routeOrder.sourceUpdatedAt, "2026-09-09T12:00:00.000Z");
    assert.deepEqual(routeOrder.routePlan, {
        planId: history.activePlan.planId,
        planRevision: history.activePlan.revision,
        dayId: history.activePlan.days[0].dayId,
        dayRevision: history.activePlan.days[0].revision,
        dayNumber: 1,
        dayCount: 2,
        routeDate: "2026-09-09",
    });
    assert.deepEqual(routeOrder.stops, [
        {
            stopNumber: 1,
            address: "100 First St",
            orderIds: ["ORDER-A", "ORDER-B"],
        },
        {
            stopNumber: 3,
            address: "300 Manual St",
            orderIds: [],
            gigIds: ["GIG-1"],
        },
    ]);
    assert.equal(workbookOrderIdCount(routeOrder), 2);
    assert.equal(manualGigIdCount(routeOrder), 1);
    assert.equal(JSON.stringify(routeOrder).includes("ORDER-C"), false);
});

test("activating Day 2 emits only Day 2 while the complete two-Day plan remains intact", () => {
    const history = multiDayHistory();
    const originalDayIds = history.activePlan.days.map((day) => day.dayId);
    const day2Plan = RoutePlanDays.activateDay(
        history.activePlan,
        history.activePlan.days[1].dayId,
        { now: "2026-09-09T13:15:00.000Z" },
    );
    const day2History = RouteHistory.normalizeRouteHistory(
        { version: 7, activePlan: day2Plan, pending: null },
        new Set(savedStops().map((stop) => stop.id)),
    );
    const routeOrder = buildFor(
        day2History,
        "google",
        "2026-09-09T13:30:00.000Z",
    );

    assert.equal(routeOrder.routePlan.dayNumber, 2);
    assert.equal(routeOrder.routePlan.dayCount, 2);
    assert.equal(routeOrder.routePlan.routeDate, "2026-09-10");
    assert.deepEqual(routeOrder.stops, [
        {
            stopNumber: 1,
            address: "200 Second St",
            orderIds: ["ORDER-C"],
        },
    ]);
    assert.equal(JSON.stringify(routeOrder).includes("ORDER-A"), false);
    assert.equal(JSON.stringify(routeOrder).includes("GIG-1"), false);
    assert.deepEqual(
        day2History.activePlan.days.map((day) => day.dayId),
        originalDayIds,
    );
    assert.equal(day2History.activePlan.days.length, 2);
});

test("active-Day Basic return uses the Basic snapshot order and status", () => {
    const history = multiDayHistory();
    const routeOrder = buildFor(history, "basic");

    assert.equal(routeOrder.routeSlot, "basic");
    assert.equal(routeOrder.optimizationStatus, history.basic.optimizationStatus);
    assert.equal(routeOrder.optimizationStatus, "not_optimized");
    assert.deepEqual(routeOrder.stops, [
        {
            stopNumber: 1,
            address: "300 Manual St",
            orderIds: [],
            gigIds: ["GIG-1"],
        },
        {
            stopNumber: 3,
            address: "100 First St",
            orderIds: ["ORDER-A", "ORDER-B"],
        },
    ]);
});

test("active-Day producer refuses omitted, reordered, or inactive displayed stops before creating an artifact", () => {
    const history = multiDayHistory();
    const exact = stopsFor(history.google.routeIds);

    assert.throws(
        () =>
            buildActiveDayWorkbookRouteOrder({
                routeSlot: "google",
                routeHistory: history,
                routeStops: exact.slice(0, -1),
            }),
        /displayed route no longer matches the active Route Plan Day/,
    );
    assert.throws(
        () =>
            buildActiveDayWorkbookRouteOrder({
                routeSlot: "google",
                routeHistory: history,
                routeStops: [exact[1], exact[0], ...exact.slice(2)],
            }),
        /displayed route no longer matches the active Route Plan Day/,
    );
    assert.throws(
        () =>
            buildActiveDayWorkbookRouteOrder({
                routeSlot: "google",
                routeHistory: history,
                routeStops: [...exact, { id: "s2", address: "200 Second St" }],
            }),
        /displayed route no longer matches the active Route Plan Day/,
    );
});

test("InspectorADE active-Day return requires source time and cannot predate its source snapshot", () => {
    const missingSource = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: dayContext(),
        google: {
            routeIds: ["s1"],
            orderIdsByStopId: { s1: ["ORDER-A"] },
        },
        basic: {
            routeIds: ["s1"],
            orderIdsByStopId: { s1: ["ORDER-A"] },
        },
    });
    assert.throws(
        () =>
            buildActiveDayWorkbookRouteOrder({
                routeSlot: "google",
                routeHistory: missingSource,
                routeStops: [{ id: "s1", address: "100 First St" }],
                now: "2026-09-09T13:00:00.000Z",
            }),
        /has no current workbook source time/,
    );

    const history = multiDayHistory();
    assert.throws(
        () =>
            buildActiveDayWorkbookRouteOrder({
                routeSlot: "google",
                routeHistory: history,
                routeStops: stopsFor(history.google.routeIds),
                now: "2026-09-09T11:59:59.000Z",
            }),
        /cannot predate the active Day's workbook source snapshot/,
    );
});

test("manual-gig-only migrated active Day may omit source time and preserve null route date", () => {
    const history = RouteHistory.normalizeRouteHistory({
        version: 6,
        dayContext: null,
        google: {
            routeIds: ["s3"],
            gigIdsByStopId: { s3: ["GIG-1"] },
            gigManagedStopIds: ["s3"],
        },
        basic: {
            routeIds: ["s3"],
            gigIdsByStopId: { s3: ["GIG-1"] },
            gigManagedStopIds: ["s3"],
        },
    });
    const routeOrder = buildActiveDayWorkbookRouteOrder({
        routeSlot: "google",
        routeHistory: history,
        routeStops: [{ id: "s3", address: "300 Manual St" }],
        now: "2026-09-09T13:00:00.000Z",
    });

    assert.equal(routeOrder.sourceUpdatedAt, null);
    assert.equal(routeOrder.routePlan.routeDate, null);
    assert.equal(workbookOrderIdCount(routeOrder), 0);
    assert.equal(manualGigIdCount(routeOrder), 1);
});

test("malformed canonical active-Day identity fails closed instead of being silently de-duplicated", () => {
    const history = multiDayHistory();
    history.activePlan.days[0].google.orderIdsByStopId.s1 = [
        "ORDER-A",
        "ORDER-A",
    ];

    assert.throws(
        () =>
            buildActiveDayWorkbookRouteOrder({
                routeSlot: "google",
                routeHistory: history,
                routeStops: stopsFor(history.google.routeIds),
            }),
        /Workbook Order ID ORDER-A is duplicated/,
    );
});

test("actual Send control path writes the same-send gig handoff before the active-Day route artifact and reports all counts", async () => {
    const history = multiDayHistory();
    const status = { textContent: "" };
    const routeChoice = { value: "google" };
    const sendButton = {
        dataset: {},
        disabled: false,
        handler: null,
        addEventListener(type, handler, capture) {
            assert.equal(type, "click");
            assert.equal(capture, true);
            this.handler = handler;
        },
    };
    const visibleNodes = history.google.routeIds.map((stopId) => ({
        dataset: { stopId },
    }));
    const documentRef = {
        getElementById(id) {
            return {
                sendRouteOrder: sendButton,
                workbookRouteOrderStatus: status,
                routeChoice,
            }[id] || null;
        },
        querySelectorAll(selector) {
            assert.equal(selector, "#routeList > li[data-stop-id]");
            return visibleNodes;
        },
    };
    const saved = savedStops();
    const storage = {};
    const writes = [];
    const controller = createRouteOrderSendController({
        contractApi: {
            readStops(receivedStorage) {
                assert.equal(receivedStorage, storage);
                return { stops: saved };
            },
        },
        routeHistoryApi: {
            readRouteHistory(receivedStorage, validIds) {
                assert.equal(receivedStorage, storage);
                assert.deepEqual([...validIds].sort(), ["s1", "s2", "s3", "s4"]);
                return history;
            },
        },
        routeOrderApi: RouteOrder,
        driveApi: {
            async requestDriveToken() {
                return "drive-token";
            },
            async saveRouteOrderToDrive(token, routeOrder) {
                writes.push({ kind: "route", token, routeOrder });
            },
        },
        gigHandoffApi: {
            ...GigHandoff,
            async saveGigHandoffToDrive(token, handoff) {
                writes.push({ kind: "gig", token, handoff });
            },
        },
        manualGigsProvider() {
            return [
                {
                    id: "GIG-1",
                    stopId: "s3",
                    source: "HNP",
                    workOrderId: "HNP-100",
                    expectedPay: 25,
                    dueDate: "2026-09-09",
                    completedDate: null,
                    notes: "Manual route work",
                    updatedAt: "2026-09-09T12:45:00.000Z",
                },
            ];
        },
        storage,
        documentRef,
        now: () => new Date("2026-09-09T13:00:00.000Z"),
    });

    assert.equal(controller.attach(), true);
    let prevented = false;
    let stopped = false;
    sendButton.handler({
        preventDefault() {
            prevented = true;
        },
        stopImmediatePropagation() {
            stopped = true;
        },
    });
    await controller.whenIdle();

    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].kind, "gig");
    assert.equal(writes[1].kind, "route");
    assert.equal(writes[0].token, "drive-token");
    assert.equal(writes[1].token, "drive-token");
    assert.equal(writes[0].handoff.updatedAt, "2026-09-09T13:00:00.000Z");
    assert.equal(writes[1].routeOrder.updatedAt, writes[0].handoff.updatedAt);
    assert.deepEqual(writes[0].handoff.gigs.map((gig) => gig.gigId), ["GIG-1"]);
    assert.equal(writes[1].routeOrder.routeOrderVersion, 2);
    assert.equal(writes[1].routeOrder.routePlan.dayNumber, 1);
    assert.match(status.textContent, /2 InspectorADE jobs/);
    assert.match(status.textContent, /1 manual gig/);
    assert.match(status.textContent, /3 total work items/);

    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const routeOrderIndex = html.indexOf("route-order.js?v=1.2.0");
    const routeOrderUiIndex = html.indexOf("route-order-ui.js?v=1.0.0");
    const appIndex = html.indexOf("app.js?v=3.33.0");
    assert.ok(routeOrderIndex >= 0);
    assert.ok(routeOrderUiIndex > routeOrderIndex);
    assert.ok(appIndex > routeOrderUiIndex);
});