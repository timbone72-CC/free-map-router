"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    applyCorrectionsToInbox,
    createCorrectionRecord,
    mergeCorrectionRecords,
    parseCorrectionRecord,
} = require("../address-corrections.js");

const RR_ADDRESS = "RR1 BOX 3240, Elk City, OK 73644";
const STREET_ADDRESS = "11202 N 2020 RD, Elk City, OK 73644";

test("correction record keeps the RR alias, dedicated source, and manual pin", () => {
    const record = createCorrectionRecord(
        [
            {
                address: STREET_ADDRESS,
                addressAliases: [RR_ADDRESS],
                source: "DCFS",
                latitude: 35.455,
                longitude: -99.51,
                pinStatus: "manual",
            },
        ],
        new Date("2026-08-11T20:00:00.000Z"),
    );

    assert.equal(record.corrections.length, 1);
    assert.deepEqual(record.corrections[0], {
        originalAddress: RR_ADDRESS,
        originalAddressKey: "rr1 box 3240,elk city,ok 73644",
        correctedAddress: STREET_ADDRESS,
        correctedAddressKey: "11202 n 2020 rd,elk city,ok 73644",
        source: "DCFS",
        latitude: 35.455,
        longitude: -99.51,
        placeId: "",
        pinStatus: "manual",
    });
});

test("damaged or foreign correction records are rejected", () => {
    assert.throws(
        () => parseCorrectionRecord("not json"),
        /corrections file is damaged/,
    );
    assert.throws(
        () => parseCorrectionRecord('{"app":"other","corrections":[]}'),
        /unexpected structure/,
    );
});

test("new local correction keeps an existing Drive source when it is absent locally", () => {
    const remote = parseCorrectionRecord(
        JSON.stringify({
            app: "free-map-router",
            correctionsVersion: 1,
            updatedAt: "2026-08-10T20:00:00.000Z",
            corrections: [
                {
                    originalAddress: RR_ADDRESS,
                    correctedAddress: STREET_ADDRESS,
                    source: "DCFS",
                },
            ],
        }),
    );
    const local = parseCorrectionRecord(
        JSON.stringify({
            app: "free-map-router",
            correctionsVersion: 1,
            updatedAt: "2026-08-11T20:00:00.000Z",
            corrections: [
                {
                    originalAddress: RR_ADDRESS,
                    correctedAddress: "11202 N 2020 ROAD, Elk City, OK 73644",
                    source: "",
                },
            ],
        }),
    );

    const merged = mergeCorrectionRecords(
        remote,
        local,
        new Date("2026-08-11T20:05:00.000Z"),
    );

    assert.equal(merged.corrections.length, 1);
    assert.equal(merged.corrections[0].source, "DCFS");
    assert.equal(
        merged.corrections[0].correctedAddress,
        "11202 N 2020 ROAD, Elk City, OK 73644",
    );
});

test("permanent correction changes only an exact raw workbook address", () => {
    const record = createCorrectionRecord([
        {
            address: STREET_ADDRESS,
            addressAliases: [RR_ADDRESS],
            source: "DCFS",
            latitude: 35.455,
            longitude: -99.51,
            pinStatus: "manual",
        },
    ]);
    const corrected = applyCorrectionsToInbox(
        {
            addresses: [
                {
                    address: RR_ADDRESS,
                    source: "GIS",
                    orderIds: ["112310949"],
                    latitude: null,
                    longitude: null,
                    pinStatus: "unverified",
                },
                {
                    address: "RR1 BOX 3241, Elk City, OK 73644",
                    source: "DCFS",
                },
            ],
        },
        record,
    );

    assert.equal(corrected.addresses[0].address, STREET_ADDRESS);
    assert.equal(corrected.addresses[0].source, "GIS");
    assert.equal(corrected.addresses[0].originalAddress, RR_ADDRESS);
    assert.equal(corrected.addresses[0].latitude, 35.455);
    assert.equal(corrected.addresses[0].pinStatus, "manual");
    assert.equal(
        corrected.addresses[1].address,
        "RR1 BOX 3241, Elk City, OK 73644",
    );
});
