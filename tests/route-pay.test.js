const test = require("node:test");
const assert = require("node:assert/strict");

const {
    ROUTE_HISTORY_VERSION,
    normalizeRouteHistory,
    remapRouteStopIds,
    replaceRoute,
    stageWorkbookRoute,
    startPendingRoute,
    summarizeRouteExpectedPay,
} = require("../route-history.js");

test("route history migrates version 4 safely without inventing workbook pay", () => {
    const migrated = normalizeRouteHistory(
        {
            version: 4,
            google: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-08-23T12:00:00.000Z",
                optimizationStatus: "google_optimized",
                orderIdsByStopId: { a: ["ADE-1"] },
                gigIdsByStopId: { a: ["gig-1"] },
            },
            basic: null,
            pending: null,
        },
        new Set(["a"]),
    );

    assert.equal(ROUTE_HISTORY_VERSION, 5);
    assert.equal(migrated.version, 5);
    assert.deepEqual(migrated.google.routeIds, ["a"]);
    assert.deepEqual(migrated.google.orderIdsByStopId, { a: ["ADE-1"] });
    assert.deepEqual(migrated.google.gigIdsByStopId, { a: ["gig-1"] });
    assert.deepEqual(migrated.google.workbookPayByStopId, {});

    const summary = summarizeRouteExpectedPay(migrated.google, [
        { id: "gig-1", expectedPay: 12.5 },
    ]);
    assert.equal(summary.inspectorAdeExpectedPay, 0);
    assert.equal(summary.manualGigExpectedPay, 12.5);
    assert.equal(summary.totalKnownExpectedPay, 12.5);
    assert.equal(summary.payIncomplete, true);
});

test("workbook pay stays with pending and both started route variants", () => {
    const staged = stageWorkbookRoute(
        { google: null, basic: null, pending: null },
        ["a", "b"],
        "2026-08-24T12:00:00.000Z",
        new Set(["a", "b"]),
        { a: ["ADE-1"], b: ["ADE-2"] },
        {
            a: { expectedPay: 18, expectedPayComplete: true },
            b: { expectedPay: 9.5, expectedPayComplete: false },
        },
    ).history;

    assert.deepEqual(staged.pending.workbookPayByStopId, {
        a: { expectedPay: 18, expectedPayComplete: true },
        b: { expectedPay: 9.5, expectedPayComplete: false },
    });

    const started = startPendingRoute(staged, new Set(["a", "b"])).history;
    assert.deepEqual(started.google.workbookPayByStopId, staged.pending.workbookPayByStopId);
    assert.deepEqual(started.basic.workbookPayByStopId, staged.pending.workbookPayByStopId);
});

test("combined route pay counts InspectorADE stop subtotals and distinct manual gigs", () => {
    const snapshot = {
        routeIds: ["ade", "shared", "manual", "plain"],
        orderIdsByStopId: {
            ade: ["ADE-1"],
            shared: ["ADE-2", "ADE-3"],
        },
        workbookPayByStopId: {
            ade: { expectedPay: 18, expectedPayComplete: true },
            shared: { expectedPay: 22.5, expectedPayComplete: true },
        },
        gigIdsByStopId: {
            shared: ["gig-1"],
            manual: ["gig-2", "gig-1"],
        },
    };

    const summary = summarizeRouteExpectedPay(snapshot, [
        { id: "gig-1", expectedPay: 15 },
        { id: "gig-2", expectedPay: 7.25 },
    ]);

    assert.deepEqual(summary, {
        inspectorAdeExpectedPay: 40.5,
        manualGigExpectedPay: 22.25,
        totalKnownExpectedPay: 62.75,
        payIncomplete: false,
        hasRepresentedWork: true,
    });
});

test("blank or missing pay contributes known dollars only and marks the route incomplete", () => {
    const snapshot = {
        routeIds: ["ade-known", "ade-legacy", "manual"],
        orderIdsByStopId: {
            "ade-known": ["ADE-1", "ADE-2"],
            "ade-legacy": ["ADE-3"],
        },
        workbookPayByStopId: {
            "ade-known": { expectedPay: 18, expectedPayComplete: false },
        },
        gigIdsByStopId: {
            manual: ["gig-known", "gig-blank", "gig-missing"],
        },
    };

    const summary = summarizeRouteExpectedPay(snapshot, [
        { id: "gig-known", expectedPay: 10 },
        { id: "gig-blank", expectedPay: null },
    ]);

    assert.equal(summary.inspectorAdeExpectedPay, 18);
    assert.equal(summary.manualGigExpectedPay, 10);
    assert.equal(summary.totalKnownExpectedPay, 28);
    assert.equal(summary.payIncomplete, true);
    assert.equal(summary.hasRepresentedWork, true);
});

test("real zero pay is known zero rather than unknown", () => {
    const summary = summarizeRouteExpectedPay(
        {
            routeIds: ["a", "b"],
            orderIdsByStopId: { a: ["ADE-1"] },
            workbookPayByStopId: {
                a: { expectedPay: 0, expectedPayComplete: true },
            },
            gigIdsByStopId: { b: ["gig-zero"] },
        },
        [{ id: "gig-zero", expectedPay: 0 }],
    );

    assert.equal(summary.totalKnownExpectedPay, 0);
    assert.equal(summary.payIncomplete, false);
    assert.equal(summary.hasRepresentedWork, true);
});

test("removing a stop removes only that selected route's pay metadata", () => {
    const history = normalizeRouteHistory({
        google: {
            routeIds: ["a", "b"],
            orderIdsByStopId: { a: ["ADE-1"], b: ["ADE-2"] },
            workbookPayByStopId: {
                a: { expectedPay: 10, expectedPayComplete: true },
                b: { expectedPay: 20, expectedPayComplete: true },
            },
        },
        basic: {
            routeIds: ["a", "b"],
            orderIdsByStopId: { a: ["ADE-1"], b: ["ADE-2"] },
            workbookPayByStopId: {
                a: { expectedPay: 10, expectedPayComplete: true },
                b: { expectedPay: 20, expectedPayComplete: true },
            },
        },
    });

    const changed = replaceRoute(history, "google", ["b"]);
    assert.deepEqual(changed.google.workbookPayByStopId, {
        b: { expectedPay: 20, expectedPayComplete: true },
    });
    assert.deepEqual(changed.basic.workbookPayByStopId, {
        a: { expectedPay: 10, expectedPayComplete: true },
        b: { expectedPay: 20, expectedPayComplete: true },
    });
});

test("single complete workbook pay stays complete through a stop-ID remap", () => {
    const remapped = remapRouteStopIds(
        {
            google: {
                routeIds: ["old-a"],
                orderIdsByStopId: { "old-a": ["ADE-1"] },
                workbookPayByStopId: {
                    "old-a": { expectedPay: 10, expectedPayComplete: true },
                },
            },
        },
        { "old-a": "merged" },
        new Set(["merged"]),
    );

    assert.deepEqual(remapped.google.workbookPayByStopId, {
        merged: { expectedPay: 10, expectedPayComplete: true },
    });
});

test("stop-ID merge combines known workbook subtotals and completeness conservatively", () => {
    const remapped = remapRouteStopIds(
        {
            google: {
                routeIds: ["old-a", "old-b"],
                orderIdsByStopId: {
                    "old-a": ["ADE-1"],
                    "old-b": ["ADE-2"],
                },
                workbookPayByStopId: {
                    "old-a": { expectedPay: 10, expectedPayComplete: true },
                    "old-b": { expectedPay: 7.5, expectedPayComplete: false },
                },
            },
        },
        { "old-a": "merged", "old-b": "merged" },
        new Set(["merged"]),
    );

    assert.deepEqual(remapped.google.routeIds, ["merged"]);
    assert.deepEqual(remapped.google.orderIdsByStopId, {
        merged: ["ADE-1", "ADE-2"],
    });
    assert.deepEqual(remapped.google.workbookPayByStopId, {
        merged: { expectedPay: 17.5, expectedPayComplete: false },
    });
});
