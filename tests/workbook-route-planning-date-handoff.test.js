"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAddressInbox, applyAddressInbox } = require("../inbox.js");
const RouteHistory = require("../route-history.js");
const { buildActiveDayWorkbookRouteOrder } = require("../route-order.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
    };
}

function defaultDayContext() {
    return {
        routeDate: "2026-11-19",
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function inboxText(planningDate) {
    const inbox = {
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-11-20T04:13:50.162Z",
        addresses: [{
            address: "112 BLUE RIDGE DRIVE, Elk City, OK 73644",
            source: "GIS",
            orderIds: ["114247973"],
        }],
    };
    if (planningDate !== undefined) inbox.planningDate = planningDate;
    return JSON.stringify(inbox);
}

test("selected workbook planning day survives the real inbox/pending/start/return path", () => {
    const incoming = parseAddressInbox(inboxText("2026-11-20"));
    const imported = applyAddressInbox([], incoming);
    const validIds = new Set(imported.stops.map((stop) => stop.id));
    const storage = memoryStorage();

    const staged = RouteHistory.stageWorkbookRoute(
        RouteHistory.normalizeRouteHistory({
            version: 7,
            activePlan: null,
            pending: null,
        }),
        imported.routeIds,
        incoming.updatedAt,
        validIds,
        imported.orderIdsByStopId,
        imported.workbookPayByStopId,
        incoming.planningDate,
    );
    assert.equal(staged.result, "newer");
    assert.equal(staged.history.pending.planningDate, "2026-11-20");

    const savedPending = RouteHistory.writeRouteHistory(storage, staged.history, validIds);
    assert.equal(savedPending.pending.planningDate, "2026-11-20");
    assert.equal(RouteHistory.readRouteHistory(storage, validIds).pending.planningDate, "2026-11-20");

    const started = RouteHistory.startPendingRoute(
        RouteHistory.readRouteHistory(storage, validIds),
        validIds,
        defaultDayContext(),
    );
    const history = RouteHistory.writeRouteHistory(storage, started.history, validIds);
    assert.equal(history.pending, null);
    assert.equal(history.activePlan.days[0].dayContext.routeDate, "2026-11-20");

    const routeOrder = buildActiveDayWorkbookRouteOrder({
        routeSlot: "google",
        routeHistory: history,
        routeStops: imported.stops.filter((stop) => history.google.routeIds.includes(stop.id)),
        now: "2026-11-20T04:23:38.363Z",
    });
    assert.equal(routeOrder.sourceUpdatedAt, incoming.updatedAt);
    assert.equal(routeOrder.routePlan.routeDate, "2026-11-20");
    assert.deepEqual(routeOrder.stops[0].orderIds, ["114247973"]);
    assert.equal(routeOrder.routeOrderVersion, 2);
});

test("older inboxes remain valid and an invalid explicit date is rejected", () => {
    const legacy = parseAddressInbox(inboxText());
    assert.equal(Object.hasOwn(legacy, "planningDate"), false);
    for (const date of ["2026-11-31", "2026-02-29", "11/20/2026", "", null]) {
        assert.throws(() => parseAddressInbox(inboxText(date)), /invalid planning date/);
    }
});
