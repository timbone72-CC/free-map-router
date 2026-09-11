"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const GigHandoff = require("../gig-handoff.js");
const { createRouteOrderSendController } = require("../route-order-ui.js");

function makeHarness({ routeGigIds = ["GIG-1"], currentGigs, failGigSave = false } = {}) {
    const stops = [{ id: "s1", address: "100 Manual St" }];
    const status = { textContent: "" };
    const sendButton = { dataset: {}, disabled: false, addEventListener() {} };
    const storage = {};
    const calls = [];
    let manualProviderCalls = 0;
    let tokenCalls = 0;

    const routeOrderApi = {
        buildActiveDayWorkbookRouteOrder({ routeSlot, now }) {
            return {
                app: "free-map-router",
                routeOrderVersion: 2,
                routeScope: "active_day",
                target: "InspectorADE Repeat Job Predictor - LIVE",
                updatedAt: new Date(now).toISOString(),
                routeSlot,
                optimizationStatus: "not_optimized",
                sourceUpdatedAt: null,
                routePlan: {
                    planId: "plan-1",
                    planRevision: 1,
                    dayId: "day-1",
                    dayRevision: 1,
                    dayNumber: 1,
                    dayCount: 1,
                    routeDate: "2026-09-11",
                },
                stops: [
                    {
                        stopNumber: 1,
                        address: "100 Manual St",
                        orderIds: routeGigIds.length ? [] : ["ORDER-1"],
                        ...(routeGigIds.length ? { gigIds: routeGigIds } : {}),
                    },
                ],
            };
        },
        workbookOrderIdCount(routeOrder) {
            return routeOrder.stops.reduce(
                (count, stop) => count + (Array.isArray(stop.orderIds) ? stop.orderIds.length : 0),
                0,
            );
        },
        manualGigIdCount(routeOrder) {
            return routeOrder.stops.reduce(
                (count, stop) => count + (Array.isArray(stop.gigIds) ? stop.gigIds.length : 0),
                0,
            );
        },
    };

    const controller = createRouteOrderSendController({
        contractApi: {
            readStops(receivedStorage) {
                assert.equal(receivedStorage, storage);
                return { stops };
            },
        },
        routeHistoryApi: {
            readRouteHistory(receivedStorage) {
                assert.equal(receivedStorage, storage);
                return {};
            },
        },
        routeOrderApi,
        driveApi: {
            async requestDriveToken() {
                tokenCalls += 1;
                return "token";
            },
            async saveRouteOrderToDrive(token, routeOrder) {
                calls.push({ kind: "route", token, updatedAt: routeOrder.updatedAt });
            },
        },
        gigHandoffApi: {
            ...GigHandoff,
            async saveGigHandoffToDrive(token, handoff) {
                calls.push({ kind: "gig", token, updatedAt: handoff.updatedAt });
                if (failGigSave) throw new Error("gig handoff write failed");
            },
        },
        manualGigsProvider() {
            manualProviderCalls += 1;
            return currentGigs === undefined
                ? [
                      {
                          id: "GIG-1",
                          stopId: "s1",
                          source: "HNP",
                          workOrderId: "HNP-1",
                          expectedPay: 18,
                          dueDate: null,
                          completedDate: null,
                          notes: "",
                          updatedAt: "2026-09-11T12:00:00.000Z",
                      },
                  ]
                : currentGigs;
        },
        storage,
        documentRef: {
            getElementById(id) {
                return {
                    sendRouteOrder: sendButton,
                    workbookRouteOrderStatus: status,
                    routeChoice: { value: "google" },
                }[id] || null;
            },
            querySelectorAll(selector) {
                assert.equal(selector, "#routeList > li[data-stop-id]");
                return [{ dataset: { stopId: "s1" } }];
            },
        },
        now: () => new Date("2026-09-11T13:00:00.000Z"),
    });

    return {
        controller,
        calls,
        status,
        getManualProviderCalls: () => manualProviderCalls,
        getTokenCalls: () => tokenCalls,
    };
}

test("route send with manual work writes same-timestamp gig handoff before route order", async () => {
    const harness = makeHarness();
    const result = await harness.controller.send();

    assert.ok(result);
    assert.deepEqual(harness.calls.map((call) => call.kind), ["gig", "route"]);
    assert.equal(harness.calls[0].updatedAt, "2026-09-11T13:00:00.000Z");
    assert.equal(harness.calls[1].updatedAt, harness.calls[0].updatedAt);
    assert.equal(harness.getManualProviderCalls(), 1);
    assert.equal(harness.getTokenCalls(), 1);
});

test("routed Gig_ID missing from current manual gigs fails before Drive authorization or publication", async () => {
    const harness = makeHarness({ currentGigs: [] });
    const result = await harness.controller.send();

    assert.equal(result, null);
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.getTokenCalls(), 0);
    assert.match(harness.status.textContent, /Routed Gig_ID GIG-1 is no longer in the current manual gig list/);
});

test("gig handoff write failure prevents route-order publication", async () => {
    const harness = makeHarness({ failGigSave: true });
    const result = await harness.controller.send();

    assert.equal(result, null);
    assert.deepEqual(harness.calls.map((call) => call.kind), ["gig"]);
    assert.equal(harness.getTokenCalls(), 1);
    assert.match(harness.status.textContent, /gig handoff write failed/);
});

test("route with no manual gigs preserves the route-order-only send path", async () => {
    const harness = makeHarness({ routeGigIds: [] });
    const result = await harness.controller.send();

    assert.ok(result);
    assert.deepEqual(harness.calls.map((call) => call.kind), ["route"]);
    assert.equal(harness.getManualProviderCalls(), 0);
    assert.equal(harness.getTokenCalls(), 1);
});