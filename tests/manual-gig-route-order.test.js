const test = require("node:test");
const assert = require("node:assert/strict");

const { buildWorkbookRouteOrder } = require("../route-order.js");

test("manual gig route metadata is returned by exact Gig ID without inventing Order IDs", () => {
    const routeOrder = buildWorkbookRouteOrder({
        routeSlot: "google",
        routeSnapshot: {
            routeIds: ["manual", "workbook"],
            sourceUpdatedAt: "2026-08-22T18:00:00.000Z",
            optimizationStatus: "manually_changed",
            orderIdsByStopId: {
                workbook: ["ORDER-1"],
            },
            gigIdsByStopId: {
                manual: ["gig_1"],
                workbook: ["gig_2"],
            },
        },
        routeStops: [
            { id: "manual", address: "100 Manual St" },
            { id: "workbook", address: "200 Workbook St" },
        ],
        now: new Date("2026-08-22T19:00:00.000Z"),
    });

    assert.deepEqual(routeOrder.stops, [
        {
            stopNumber: 1,
            address: "100 Manual St",
            orderIds: [],
            gigIds: ["gig_1"],
        },
        {
            stopNumber: 2,
            address: "200 Workbook St",
            orderIds: ["ORDER-1"],
            gigIds: ["gig_2"],
        },
    ]);
});

test("one Gig ID cannot identify two physical route stops", () => {
    assert.throws(
        () =>
            buildWorkbookRouteOrder({
                routeSnapshot: {
                    gigIdsByStopId: {
                        a: ["gig_1"],
                        b: ["gig_1"],
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
