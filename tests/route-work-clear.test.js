const test = require("node:test");
const assert = require("node:assert/strict");

const {
    clearInspectorAdeRouteWork,
    clearManualGigRouteWork,
} = require("../route-work-clear.js");
const { normalizeRouteHistory } = require("../route-history.js");

const validIds = new Set(["ade", "gig", "shared", "manual", "pending"]);

function mixedHistory() {
    return {
        version: 5,
        google: {
            routeIds: ["ade", "gig", "shared", "manual"],
            sourceUpdatedAt: "2026-08-22T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                ade: ["ADE-1"],
                shared: ["ADE-2"],
            },
            workbookPayByStopId: {
                ade: { expectedPay: 18, expectedPayComplete: true },
                shared: { expectedPay: 9, expectedPayComplete: false },
            },
            gigIdsByStopId: {
                gig: ["gig_1"],
                shared: ["gig_2"],
            },
            gigManagedStopIds: ["gig"],
        },
        basic: {
            routeIds: ["manual", "shared", "gig", "ade"],
            sourceUpdatedAt: "2026-08-22T12:00:00.000Z",
            optimizationStatus: "not_optimized",
            orderIdsByStopId: {
                ade: ["ADE-1"],
                shared: ["ADE-2"],
            },
            workbookPayByStopId: {
                ade: { expectedPay: 18, expectedPayComplete: true },
                shared: { expectedPay: 9, expectedPayComplete: false },
            },
            gigIdsByStopId: {
                gig: ["gig_1"],
                shared: ["gig_2"],
            },
            gigManagedStopIds: ["gig"],
        },
        pending: {
            routeIds: ["pending"],
            sourceUpdatedAt: "2026-08-22T13:00:00.000Z",
            optimizationStatus: "not_optimized",
            orderIdsByStopId: { pending: ["ADE-P"] },
            workbookPayByStopId: {
                pending: { expectedPay: 21, expectedPayComplete: true },
            },
        },
    };
}

test("Clear InspectorADE Jobs removes ADE-only stops but keeps gig and app-only work", () => {
    const before = normalizeRouteHistory(mixedHistory(), validIds);
    const result = clearInspectorAdeRouteWork(before, validIds);

    assert.deepEqual(result.history.google.routeIds, ["gig", "shared", "manual"]);
    assert.deepEqual(result.history.basic.routeIds, ["manual", "shared", "gig"]);
    assert.deepEqual(result.history.google.orderIdsByStopId, {});
    assert.deepEqual(result.history.basic.orderIdsByStopId, {});
    assert.deepEqual(result.history.google.workbookPayByStopId, {});
    assert.deepEqual(result.history.basic.workbookPayByStopId, {});
    assert.deepEqual(result.history.google.gigIdsByStopId, {
        gig: ["gig_1"],
        shared: ["gig_2"],
    });
    assert.deepEqual(result.history.google.gigManagedStopIds, ["gig"]);
    assert.equal(result.history.google.optimizationStatus, "manually_changed");
    assert.equal(result.history.basic.optimizationStatus, "not_optimized");
    assert.deepEqual(result.history.pending, before.pending);
    assert.equal(result.removedOrderIdCount, 4);
    assert.equal(result.removedStopCount, 2);
});

test("Clear InspectorADE Jobs preserves optimizer status when shared stops stay visible", () => {
    const history = {
        version: 5,
        google: {
            routeIds: ["shared"],
            sourceUpdatedAt: "2026-08-22T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { shared: ["ADE-2"] },
            workbookPayByStopId: {
                shared: { expectedPay: 9, expectedPayComplete: true },
            },
            gigIdsByStopId: { shared: ["gig_2"] },
            gigManagedStopIds: [],
        },
        basic: null,
        pending: null,
    };

    const result = clearInspectorAdeRouteWork(history, validIds);
    assert.deepEqual(result.history.google.routeIds, ["shared"]);
    assert.deepEqual(result.history.google.orderIdsByStopId, {});
    assert.deepEqual(result.history.google.workbookPayByStopId, {});
    assert.equal(result.history.google.optimizationStatus, "google_optimized");
    assert.equal(result.removedStopCount, 0);
});

test("Clear Manual Gig Work removes only gig-managed gig-only stops", () => {
    const before = normalizeRouteHistory(mixedHistory(), validIds);
    const result = clearManualGigRouteWork(before, validIds);

    assert.deepEqual(result.history.google.routeIds, ["ade", "shared", "manual"]);
    assert.deepEqual(result.history.basic.routeIds, ["manual", "shared", "ade"]);
    assert.deepEqual(result.history.google.gigIdsByStopId, {});
    assert.deepEqual(result.history.basic.gigIdsByStopId, {});
    assert.deepEqual(result.history.google.gigManagedStopIds, []);
    assert.deepEqual(result.history.google.orderIdsByStopId, {
        ade: ["ADE-1"],
        shared: ["ADE-2"],
    });
    assert.deepEqual(result.history.google.workbookPayByStopId, {
        ade: { expectedPay: 18, expectedPayComplete: true },
        shared: { expectedPay: 9, expectedPayComplete: false },
    });
    assert.equal(result.history.google.optimizationStatus, "manually_changed");
    assert.equal(result.history.basic.optimizationStatus, "not_optimized");
    assert.deepEqual(result.history.pending, before.pending);
    assert.equal(result.removedGigIdCount, 4);
    assert.equal(result.removedStopCount, 2);
});

test("Clear Manual Gig Work keeps shared and pre-existing stops when route membership does not change", () => {
    const history = {
        version: 5,
        google: {
            routeIds: ["shared", "manual"],
            sourceUpdatedAt: null,
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { shared: ["ADE-2"] },
            workbookPayByStopId: {
                shared: { expectedPay: 9, expectedPayComplete: true },
            },
            gigIdsByStopId: {
                shared: ["gig_2"],
                manual: ["gig_3"],
            },
            gigManagedStopIds: [],
        },
        basic: null,
        pending: null,
    };

    const result = clearManualGigRouteWork(history, validIds);
    assert.deepEqual(result.history.google.routeIds, ["shared", "manual"]);
    assert.deepEqual(result.history.google.gigIdsByStopId, {});
    assert.deepEqual(result.history.google.orderIdsByStopId, {
        shared: ["ADE-2"],
    });
    assert.deepEqual(result.history.google.workbookPayByStopId, {
        shared: { expectedPay: 9, expectedPayComplete: true },
    });
    assert.equal(result.history.google.optimizationStatus, "google_optimized");
    assert.equal(result.removedStopCount, 0);
});
