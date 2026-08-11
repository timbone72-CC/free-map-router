const test = require("node:test");
const assert = require("node:assert/strict");

const {
    applyAddressInbox,
    formatInboxImportStatus,
    isAddressInboxExportedToday,
    parseAddressInbox,
} = require("../inbox.js");

function inboxText(addresses) {
    return JSON.stringify({
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-07-30T18:00:00.000Z",
        addresses,
    });
}

test("valid workbook inbox is parsed in print order", () => {
    const inbox = parseAddressInbox(
        inboxText([
            { address: "300 Third St, Elk City, OK 73644" },
            { address: "100 First St, Weatherford, OK 73096" },
        ]),
    );

    assert.deepEqual(
        inbox.addresses.map((stop) => stop.address),
        [
            "300 Third St, Elk City, OK 73644",
            "100 First St, Weatherford, OK 73096",
        ],
    );
});

test("workbook Order IDs stay attached to their physical route stop", () => {
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "300 Third St, Elk City, OK 73644",
                orderIds: ["GIS-301", "GIS-302", "GIS-301", ""],
            },
            {
                address: " 300 Third St,  Elk City, OK 73644 ",
                orderIds: ["GIS-303"],
            },
        ]),
    );
    const result = applyAddressInbox([], inbox);
    const stopId = result.routeIds[0];

    assert.equal(result.routeIds.length, 1);
    assert.deepEqual(result.orderIdsByStopId[stopId], [
        "GIS-301",
        "GIS-302",
        "GIS-303",
    ]);
    assert.equal(Object.hasOwn(result.stops[0], "orderIds"), false);
});

test("inbox status shows export time, source, job count, and import result", () => {
    const inbox = parseAddressInbox(
        inboxText([
            { address: "300 Third St, Elk City, OK 73644" },
            { address: "100 First St, Weatherford, OK 73096" },
        ]),
    );

    assert.equal(
        formatInboxImportStatus(
            inbox,
            2,
            (date) => date.toISOString(),
        ),
        "Import successful — 2 of 2 jobs. Source: InspectorADE Repeat Job Predictor - LIVE. Updated: 2026-07-30T18:00:00.000Z.",
    );
});

test("empty inbox status is explicit without inventing an export time", () => {
    const inbox = parseAddressInbox(
        JSON.stringify({
            app: "free-map-router",
            inboxVersion: 1,
            source: "InspectorADE Repeat Job Predictor - LIVE",
            updatedAt: null,
            addresses: [],
        }),
    );

    assert.equal(
        formatInboxImportStatus(inbox, 0),
        "Inbox ready — 0 jobs. Source: InspectorADE Repeat Job Predictor - LIVE. Updated: not yet exported. Import status: no jobs to import.",
    );
});

test("nonempty inbox without a valid export time is rejected", () => {
    for (const updatedAt of [null, "not-a-date"]) {
        assert.throws(
            () =>
                parseAddressInbox(
                    JSON.stringify({
                        app: "free-map-router",
                        inboxVersion: 1,
                        source: "InspectorADE Repeat Job Predictor - LIVE",
                        updatedAt,
                        addresses: [
                            { address: "300 Third St, Elk City, OK 73644" },
                        ],
                    }),
                ),
            /valid export time/,
        );
    }
});

test("inbox freshness uses the operator's local calendar date", () => {
    const now = new Date(2026, 7, 2, 0, 1);
    const exportedToday = {
        updatedAt: new Date(2026, 7, 2, 23, 59).toISOString(),
    };
    const exportedYesterday = {
        updatedAt: new Date(2026, 7, 1, 23, 59).toISOString(),
    };
    const exportedTomorrow = {
        updatedAt: new Date(2026, 7, 3, 0, 1).toISOString(),
    };

    assert.equal(isAddressInboxExportedToday(exportedToday, now), true);
    assert.equal(isAddressInboxExportedToday(exportedYesterday, now), false);
    assert.equal(isAddressInboxExportedToday(exportedTomorrow, now), false);
});

test("inbox adds new addresses and replaces only the route selection", () => {
    const existing = [
        {
            id: "saved-1",
            address: "207 Sycamore Ave, Elk City, OK 73644",
            latitude: 35.4,
            longitude: -99.4,
            pinStatus: "geocoded",
        },
        {
            id: "manual-1",
            address: "2204 N Van Buren Ave, Enid, OK 73703",
            latitude: 36.4,
            longitude: -97.9,
            pinStatus: "manual",
        },
    ];
    const inbox = parseAddressInbox(
        inboxText([
            { address: "2204 N Van Buren Ave, Enid, OK 73703" },
            { address: "400 N 6th St, Weatherford, OK 73096" },
        ]),
    );
    const result = applyAddressInbox(existing, inbox);

    assert.equal(result.stops.length, 3);
    assert.equal(result.importedCount, 2);
    assert.equal(result.routeIds[0], "manual-1");
    assert.equal(
        result.stops.find((stop) => stop.id === "manual-1").pinStatus,
        "manual",
    );
    assert.equal(
        result.stops.find((stop) => stop.id === "saved-1").address,
        "207 Sycamore Ave, Elk City, OK 73644",
    );
});

test("duplicate inbox addresses select one saved stop", () => {
    const inbox = parseAddressInbox(
        inboxText([
            { address: "100 Main St, Elk City, OK 73644" },
            { address: " 100 Main St,  Elk City, OK 73644 " },
        ]),
    );
    const result = applyAddressInbox([], inbox);

    assert.equal(result.stops.length, 1);
    assert.equal(result.routeIds.length, 1);
});

test("damaged or unrelated inbox files are rejected", () => {
    assert.throws(
        () => parseAddressInbox("{bad"),
        /damaged JSON/,
    );
    assert.throws(
        () =>
            parseAddressInbox(
                JSON.stringify({
                    app: "something-else",
                    inboxVersion: 1,
                    source: "InspectorADE Repeat Job Predictor - LIVE",
                    addresses: [],
                }),
            ),
        /unexpected structure/,
    );
});

test("corrected workbook address migrates the saved stop without losing its pin", () => {
    const existing = [
        {
            id: "manual-granite",
            address: "420 NWGRANITE AVE, Cache, OK 73527",
            label: "MCS",
            notes: "Gate is on the east side",
            latitude: 34.63615,
            longitude: -98.624558,
            pinStatus: "manual",
        },
    ];
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "420 NW GRANITE AVE, Cache, OK 73527",
                originalAddress: "420 NWGRANITE AVE, Cache, OK 73527",
                source: "GIS",
            },
        ]),
    );
    const result = applyAddressInbox(existing, inbox);

    assert.equal(result.stops.length, 1);
    assert.equal(result.importedCount, 1);
    assert.deepEqual(result.routeIds, ["manual-granite"]);
    assert.deepEqual(
        {
            id: result.stops[0].id,
            address: result.stops[0].address,
            label: result.stops[0].label,
            source: result.stops[0].source,
            notes: result.stops[0].notes,
            latitude: result.stops[0].latitude,
            longitude: result.stops[0].longitude,
            pinStatus: result.stops[0].pinStatus,
        },
        {
            id: "manual-granite",
            address: "420 NW GRANITE AVE, Cache, OK 73527",
            label: "MCS",
            source: "GIS",
            notes: "Gate is on the east side",
            latitude: 34.63615,
            longitude: -98.624558,
            pinStatus: "manual",
        },
    );
});

test("raw workbook resend resolves through a saved correction alias", () => {
    const existing = [
        {
            id: "workbook-rr",
            address: "11202 N 2020 RD, Elk City, OK 73644",
            addressAliases: ["RR1 BOX 3240, Elk City, OK 73644"],
            source: "DCFS",
            latitude: 35.455,
            longitude: -99.51,
            pinStatus: "manual",
        },
    ];
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "RR1 BOX 3240, Elk City, OK 73644",
                source: "DCFS",
                orderIds: ["112310949"],
            },
        ]),
    );
    const result = applyAddressInbox(existing, inbox);

    assert.equal(result.stops.length, 1);
    assert.equal(result.stops[0].id, "workbook-rr");
    assert.equal(
        result.stops[0].address,
        "11202 N 2020 RD, Elk City, OK 73644",
    );
    assert.equal(result.stops[0].source, "DCFS");
    assert.equal(result.stops[0].pinStatus, "manual");
    assert.deepEqual(result.stops[0].addressAliases, [
        "RR1 BOX 3240, Elk City, OK 73644",
    ]);
    assert.deepEqual(result.routeIds, ["workbook-rr"]);
    assert.deepEqual(result.orderIdsByStopId, {
        "workbook-rr": ["112310949"],
    });
});

test("all original aliases migrate into one corrected saved stop", () => {
    const existing = [
        {
            id: "manual-allen",
            address: "5503NWALAN A DALE LN, Lawton, OK 73505",
            latitude: 34.5958677,
            longitude: -98.4000154,
            pinStatus: "manual",
        },
        {
            id: "old-allen",
            address: "5503 NW ALLEN A DALE LN, Lawton, OK 73505",
            latitude: 34.5958,
            longitude: -98.4,
            pinStatus: "geocoded",
        },
    ];
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "5503 ALLEN-A-DALE LN, Lawton, OK 73505",
                originalAddress: "5503NWALAN A DALE LN, Lawton, OK 73505",
                source: "DCFS",
            },
            {
                address: "5503 ALLEN-A-DALE LN, Lawton, OK 73505",
                originalAddress: "5503 NW ALLEN A DALE LN, Lawton, OK 73505",
                source: "DCFS",
            },
        ]),
    );
    const result = applyAddressInbox(existing, inbox);

    assert.equal(result.stops.length, 1);
    assert.equal(result.importedCount, 1);
    assert.deepEqual(result.routeIds, ["manual-allen"]);
    assert.equal(result.stops[0].address, "5503 ALLEN-A-DALE LN, Lawton, OK 73505");
    assert.equal(result.stops[0].source, "DCFS");
    assert.equal(result.stops[0].pinStatus, "manual");
    assert.equal(result.stops[0].latitude, 34.5958677);
    assert.equal(result.stops[0].longitude, -98.4000154);
});
