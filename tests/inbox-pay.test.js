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
        updatedAt: "2026-08-24T12:00:00.000Z",
        addresses,
    });
}

test("legacy version-1 inbox without pay metadata remains valid", () => {
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "100 Main St, Elk City, OK 73644",
                orderIds: ["ADE-1"],
            },
        ]),
    );
    const imported = applyAddressInbox([], inbox);

    assert.equal(inbox.addresses[0].expectedPay, undefined);
    assert.equal(inbox.addresses[0].expectedPayComplete, undefined);
    assert.deepEqual(imported.workbookPayByStopId, {});
});

test("known workbook pay maps to the resolved physical stop", () => {
    const existing = [
        {
            id: "saved-stop",
            address: "100 Main St, Elk City, OK 73644",
            pinStatus: "manual",
            latitude: 35.4,
            longitude: -99.4,
        },
    ];
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "100 Main St, Elk City, OK 73644",
                orderIds: ["ADE-1", "ADE-2"],
                expectedPay: 27.5,
                expectedPayComplete: true,
            },
        ]),
    );
    const imported = applyAddressInbox(existing, inbox);

    assert.deepEqual(imported.routeIds, ["saved-stop"]);
    assert.deepEqual(imported.workbookPayByStopId, {
        "saved-stop": {
            expectedPay: 27.5,
            expectedPayComplete: true,
        },
    });
});

test("incomplete workbook pay preserves known subtotal and completeness flag", () => {
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "200 Main St, Elk City, OK 73644",
                orderIds: ["ADE-3", "ADE-4"],
                expectedPay: 18,
                expectedPayComplete: false,
            },
        ]),
    );
    const imported = applyAddressInbox([], inbox);
    const stopId = imported.routeIds[0];

    assert.deepEqual(imported.workbookPayByStopId[stopId], {
        expectedPay: 18,
        expectedPayComplete: false,
    });
});

test("duplicate physical inbox addresses combine pay once per entry and AND completeness", () => {
    const inbox = parseAddressInbox(
        inboxText([
            {
                address: "300 Main St, Elk City, OK 73644",
                orderIds: ["ADE-5"],
                expectedPay: 10,
                expectedPayComplete: true,
            },
            {
                address: " 300 Main St,  Elk City, OK 73644 ",
                orderIds: ["ADE-6"],
                expectedPay: 7.25,
                expectedPayComplete: false,
            },
        ]),
    );
    const imported = applyAddressInbox([], inbox);
    const stopId = imported.routeIds[0];

    assert.equal(imported.routeIds.length, 1);
    assert.deepEqual(imported.orderIdsByStopId[stopId], ["ADE-5", "ADE-6"]);
    assert.deepEqual(imported.workbookPayByStopId[stopId], {
        expectedPay: 17.25,
        expectedPayComplete: false,
    });
});

test("malformed optional pay metadata fails closed", () => {
    const invalidEntries = [
        {
            address: "100 Main St, Elk City, OK 73644",
            expectedPay: -1,
            expectedPayComplete: true,
        },
        {
            address: "100 Main St, Elk City, OK 73644",
            expectedPay: 10,
        },
        {
            address: "100 Main St, Elk City, OK 73644",
            expectedPayComplete: false,
        },
        {
            address: "100 Main St, Elk City, OK 73644",
            expectedPay: 10,
            expectedPayComplete: "yes",
        },
        {
            address: "100 Main St, Elk City, OK 73644",
            expectedPay: "not-money",
            expectedPayComplete: false,
        },
    ];

    for (const entry of invalidEntries) {
        assert.throws(
            () => parseAddressInbox(inboxText([entry])),
            /expected-pay|completeness/,
        );
    }
});
