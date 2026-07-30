const test = require("node:test");
const assert = require("node:assert/strict");

const {
    applyAddressInbox,
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
