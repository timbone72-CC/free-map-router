const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildWorkbookRouteOrder,
    workbookOrderIdCount,
} = require("../route-order.js");

test("displayed Google route becomes workbook stop numbers by real Order ID", () => {
    const payload = buildWorkbookRouteOrder({
        routeSlot: "google",
        routeSnapshot: {
            sourceUpdatedAt: "2026-08-11T14:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                a: ["GIS-101"],
                b: ["DCFS-202", "DCFS-203"],
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
                stopNumber: 3,
                address: "100 First St",
                orderIds: ["GIS-101"],
            },
        ],
    });
    assert.equal(workbookOrderIdCount(payload), 3);
});

test("selected Basic route is identified without renumbering manual gaps", () => {
    const payload = buildWorkbookRouteOrder({
        routeSlot: "basic",
        routeSnapshot: {
            optimizationStatus: "manually_changed",
            orderIdsByStopId: { a: ["ORDER-1"] },
        },
        routeStops: [
            { id: "manual", address: "Manual Stop" },
            { id: "a", address: "Workbook Stop" },
        ],
        now: "2026-08-11T15:30:00.000Z",
    });

    assert.equal(payload.routeSlot, "basic");
    assert.equal(payload.optimizationStatus, "manually_changed");
    assert.equal(payload.stops[0].stopNumber, 2);
});

test("a route without workbook Order IDs is not sent", () => {
    assert.throws(
        () =>
            buildWorkbookRouteOrder({
                routeSlot: "google",
                routeSnapshot: {},
                routeStops: [{ id: "manual", address: "Manual Stop" }],
            }),
        /no workbook Order IDs/,
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
