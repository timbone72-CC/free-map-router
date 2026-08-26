const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildWorkbookRouteOrder,
    workbookOrderIdCount,
    manualGigIdCount,
} = require("../route-order.js");

test("displayed Google route becomes workbook stop numbers by real work identity", () => {
    const payload = buildWorkbookRouteOrder({
        routeSlot: "google",
        routeSnapshot: {
            sourceUpdatedAt: "2026-08-11T14:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                a: ["GIS-101"],
                b: ["DCFS-202", "DCFS-203"],
            },
            gigIdsByStopId: {
                manual: ["gig_1"],
            },
        },
        routeStops: [
            { id: "b", address: "200 Second St" },
            { id: "manual", address: "250 Manual Stop" },
            { id: "a", address: "100 First St" },
        ],
        now: new Date("2026-08-11T15:00:00.000Z"),
    });

    assert.deepEqual(payload, {
        app: "free-map-router",
        routeOrderVersion: 1,
        target: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-08-11T15:00:00.000Z",
        routeSlot: "google",
        optimizationStatus: "google_optimized",
        sourceUpdatedAt: "2026-08-11T14:00:00.000Z",
        stops: [
            {
                stopNumber: 1,
                address: "200 Second St",
                orderIds: ["DCFS-202", "DCFS-203"],
            },
            {
                stopNumber: 2,
                address: "250 Manual Stop",
                orderIds: [],
                gigIds: ["gig_1"],
            },
            {
                stopNumber: 3,
                address: "100 First St",
                orderIds: ["GIS-101"],
            },
        ],
    });
    assert.equal(workbookOrderIdCount(payload), 3);
    assert.equal(manualGigIdCount(payload), 1);
});

test("selected Basic route keeps visible numbering gaps", () => {
    const payload = buildWorkbookRouteOrder({
        routeSlot: "basic",
        routeSnapshot: {
            optimizationStatus: "manually_changed",
            orderIdsByStopId: { a: ["ORDER-1"] },
        },
        routeStops: [
            { id: "plain", address: "Plain App Stop" },
            { id: "a", address: "Workbook Stop" },
        ],
        now: "2026-08-11T15:30:00.000Z",
    });

    assert.equal(payload.routeSlot, "basic");
    assert.equal(payload.optimizationStatus, "manually_changed");
    assert.equal(payload.stops[0].stopNumber, 2);
});

test("a route with only manual gigs can be sent without workbook source time", () => {
    const payload = buildWorkbookRouteOrder({
        routeSlot: "google",
        routeSnapshot: {
            gigIdsByStopId: { manual: ["gig_1"] },
        },
        routeStops: [{ id: "manual", address: "Manual Stop" }],
        now: "2026-08-11T15:30:00.000Z",
    });

    assert.equal(payload.sourceUpdatedAt, null);
    assert.deepEqual(payload.stops[0].orderIds, []);
    assert.deepEqual(payload.stops[0].gigIds, ["gig_1"]);
});

test("a route without workbook or gig work is not sent", () => {
    assert.throws(
        () =>
            buildWorkbookRouteOrder({
                routeSlot: "google",
                routeSnapshot: {},
                routeStops: [{ id: "plain", address: "Plain Stop" }],
            }),
        /no workbook jobs or manual gigs/,
    );
});

test("one Order ID cannot identify two physical route stops", () => {
    assert.throws(
        () =>
            buildWorkbookRouteOrder({
                routeSnapshot: {
                    orderIdsByStopId: {
                        a: ["ORDER-1"],
                        b: ["ORDER-1"],
                    },
                },
                routeStops: [
                    { id: "a", address: "First" },
                    { id: "b", address: "Second" },
                ],
            }),
        /belongs to more than one route stop/,
    );
});
