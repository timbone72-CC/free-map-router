const test = require("node:test");
const assert = require("node:assert/strict");

const { buildWorkbookRouteOrder } = require("../route-order.js");

test("manual gig route metadata never invents workbook Order IDs", () => {
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
            stopNumber: 2,
            address: "200 Workbook St",
            orderIds: ["ORDER-1"],
        },
    ]);
    assert.equal(JSON.stringify(routeOrder).includes("gig_1"), false);
    assert.equal(JSON.stringify(routeOrder).includes("gig_2"), false);
});