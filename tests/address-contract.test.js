const test = require("node:test");
const assert = require("node:assert/strict");
const contract = require("../contract.js");

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        dump() {
            return Object.fromEntries(data);
        },
    };
}

function sequentialIds() {
    let value = 0;
    return () => `stop_test_${++value}`;
}

test("an arbitrary address is valid without a company or label", () => {
    const stop = contract.normalizeStop(
        { address: " 100 Main St, Elk City, OK 73644 " },
        { idFactory: sequentialIds() },
    );

    assert.equal(stop.address, "100 Main St, Elk City, OK 73644");
    assert.equal(stop.label, "");
    assert.equal(stop.pinStatus, "unverified");
});

test("company never changes address identity", () => {
    const stops = contract.normalizeStopList(
        [
            { company: "GIS", address: "100 Main St, Elk City, OK" },
            { company: "DCFS", address: " 100 Main St,  Elk City, OK " },
        ],
        { idFactory: sequentialIds() },
    );

    assert.equal(stops.length, 1);
    assert.equal(stops[0].addressKey, "100 main st,elk city,ok");
});

test("legacy jobs migrate without deleting the legacy backup", () => {
    const legacy = [
        {
            id: "legacy_1",
            company: "GIS",
            address: "100 Main St, Elk City, OK",
            latitude: 35.4119,
            longitude: -99.4043,
            notes: "Gate on west side",
        },
    ];
    const storage = memoryStorage({
        [contract.LEGACY_JOBS_STORAGE_KEY]: JSON.stringify(legacy),
    });

    const result = contract.readStops(storage, {
        idFactory: sequentialIds(),
    });
    const saved = storage.dump();

    assert.equal(result.migrated, true);
    assert.equal(result.stops.length, 1);
    assert.equal(result.stops[0].label, "GIS");
    assert.equal(result.stops[0].notes, "Gate on west side");
    assert.equal(
        saved[contract.LEGACY_JOBS_STORAGE_KEY],
        JSON.stringify(legacy),
    );
    assert.ok(saved[contract.STOPS_STORAGE_KEY]);
    assert.ok(saved[contract.MIGRATION_MARKER_KEY]);
});

test("manual pins win when duplicate legacy records are merged", () => {
    const stops = contract.normalizeStopList(
        [
            {
                address: "100 Main St, Elk City, OK",
                latitude: 35.4,
                longitude: -99.4,
                pinStatus: "geocoded",
            },
            {
                address: "100 Main St, Elk City, OK",
                latitude: 35.401,
                longitude: -99.401,
                pinStatus: "manual",
            },
        ],
        { idFactory: sequentialIds() },
    );

    assert.equal(stops.length, 1);
    assert.equal(stops[0].latitude, 35.401);
    assert.equal(stops[0].longitude, -99.401);
    assert.equal(stops[0].pinStatus, "manual");
});

test("a partial or out-of-range coordinate pair is rejected", () => {
    assert.deepEqual(contract.normalizeCoordinates(35.4, null), {
        latitude: null,
        longitude: null,
    });
    assert.deepEqual(contract.normalizeCoordinates(95, -99.4), {
        latitude: null,
        longitude: null,
    });
});
