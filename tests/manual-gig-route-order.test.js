const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { buildWorkbookRouteOrder } = require("../route-order.js");
const {
    setGigRouteMembership,
    stageWorkbookRoute,
    startPendingRoute,
} = require("../route-history.js");

const indexHtml = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
);

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

test("real workbook-start route state reaches the route-order artifact with the routed Gig ID", () => {
    const validIds = new Set(["workbook", "manual"]);
    const staged = stageWorkbookRoute(
        { version: 5, google: null, basic: null, pending: null },
        ["workbook"],
        "2026-08-26T02:34:00.525Z",
        validIds,
        { workbook: ["112008694"] },
        null,
    );

    assert.equal(staged.result, "newer");

    const started = startPendingRoute(staged.history, validIds);
    assert.equal(started.result, "started");

    const historyWithGig = setGigRouteMembership(
        started.history,
        { id: "gig_1", stopId: "manual" },
        true,
        validIds,
    );

    const routeOrder = buildWorkbookRouteOrder({
        routeSlot: "google",
        routeSnapshot: historyWithGig.google,
        routeStops: [
            { id: "workbook", address: "927 SW 35TH ST, Lawton, OK 73505" },
            { id: "manual", address: "413 NW 57TH ST, Lawton, OK 73505" },
        ],
        now: new Date("2026-08-26T02:35:34.122Z"),
    });

    assert.deepEqual(routeOrder.stops, [
        {
            stopNumber: 1,
            address: "927 SW 35TH ST, Lawton, OK 73505",
            orderIds: ["112008694"],
        },
        {
            stopNumber: 2,
            address: "413 NW 57TH ST, Lawton, OK 73505",
            orderIds: [],
            gigIds: ["gig_1"],
        },
    ]);
});

test("the live page cache-busts the Phase 2E route-order module", () => {
    assert.match(indexHtml, /route-order\.js\?v=1\.1\.0/);
    assert.doesNotMatch(indexHtml, /route-order\.js\?v=1\.0\.0/);
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
