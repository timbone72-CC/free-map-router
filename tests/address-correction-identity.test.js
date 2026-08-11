const test = require("node:test");
const assert = require("node:assert/strict");

const { applyStopEdit } = require("../contract.js");
const { applyAddressInbox, parseAddressInbox } = require("../inbox.js");
const {
    remapRouteStopIds,
    stageWorkbookRoute,
    startPendingRoute,
} = require("../route-history.js");
const { buildWorkbookRouteOrder } = require("../route-order.js");

test("RR correction keeps one workbook stop through resend and route return", () => {
    const existingStops = [
        {
            id: "corrected-manual",
            address: "11202 N 2020 RD, Elk City, OK 73644",
            latitude: 35.455,
            longitude: -99.51,
            pinStatus: "manual",
        },
        {
            id: "workbook-rr",
            address: "RR1 BOX 3240, Elk City, OK 73644",
            source: "DCFS",
        },
    ];
    const existingHistory = {
        google: {
            routeIds: ["workbook-rr"],
            sourceUpdatedAt: "2026-08-11T15:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { "workbook-rr": ["112310949"] },
        },
        basic: {
            routeIds: ["workbook-rr"],
            sourceUpdatedAt: "2026-08-11T15:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: { "workbook-rr": ["112310949"] },
        },
        pending: null,
    };

    const edited = applyStopEdit(existingStops, "workbook-rr", {
        address: "11202 N 2020 RD, Elk City, OK 73644",
        label: "",
        notes: "",
    });
    const afterEditHistory = remapRouteStopIds(
        existingHistory,
        edited.idRemap,
        new Set(edited.stops.map((stop) => stop.id)),
    );

    assert.equal(edited.stops.length, 1);
    assert.equal(edited.stops[0].id, "workbook-rr");
    assert.equal(edited.stops[0].source, "DCFS");
    assert.equal(edited.stops[0].pinStatus, "manual");
    assert.deepEqual(afterEditHistory.google.orderIdsByStopId, {
        "workbook-rr": ["112310949"],
    });

    const inbox = parseAddressInbox(
        JSON.stringify({
            app: "free-map-router",
            inboxVersion: 1,
            source: "InspectorADE Repeat Job Predictor - LIVE",
            updatedAt: "2026-08-11T16:00:00.000Z",
            addresses: [
                {
                    address: "RR1 BOX 3240, Elk City, OK 73644",
                    source: "DCFS",
                    orderIds: ["112310949"],
                },
            ],
        }),
    );
    const imported = applyAddressInbox(edited.stops, inbox);
    const staged = stageWorkbookRoute(
        afterEditHistory,
        imported.routeIds,
        inbox.updatedAt,
        new Set(imported.stops.map((stop) => stop.id)),
        imported.orderIdsByStopId,
    );
    const started = startPendingRoute(
        staged.history,
        new Set(imported.stops.map((stop) => stop.id)),
    );
    const routeStops = started.history.google.routeIds.map((id) =>
        imported.stops.find((stop) => stop.id === id),
    );
    const routeOrder = buildWorkbookRouteOrder({
        routeSlot: "google",
        routeSnapshot: started.history.google,
        routeStops,
        now: new Date("2026-08-11T16:30:00.000Z"),
    });

    assert.equal(imported.stops.length, 1);
    assert.equal(imported.stops[0].id, "workbook-rr");
    assert.equal(
        imported.stops[0].address,
        "11202 N 2020 RD, Elk City, OK 73644",
    );
    assert.equal(imported.stops[0].source, "DCFS");
    assert.deepEqual(imported.routeIds, ["workbook-rr"]);
    assert.deepEqual(routeOrder.stops, [
        {
            stopNumber: 1,
            address: "11202 N 2020 RD, Elk City, OK 73644",
            orderIds: ["112310949"],
        },
    ]);
});
