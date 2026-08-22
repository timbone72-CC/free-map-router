const test = require("node:test");
const assert = require("node:assert/strict");

const {
    GIGS_STORAGE_KEY,
    applyGigEdit,
    createGig,
    normalizeExpectedPay,
    readGigs,
    remapGigStopIds,
    writeGigs,
} = require("../gig-contract.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        raw(key) {
            return values.get(key);
        },
    };
}

test("two manual gigs at one physical stop keep distinct immutable Gig IDs", () => {
    const validStopIds = new Set(["stop_1"]);
    let nextId = 1;
    const options = {
        validStopIds,
        idFactory: () => `gig_test_${nextId++}`,
        now: "2026-08-22T18:00:00.000Z",
    };

    const first = createGig(
        {
            stopId: "stop_1",
            source: "HNP",
            workOrderId: "WO-1",
            expectedPay: 18,
            routeIncluded: true,
        },
        options,
    );
    const second = createGig(
        {
            stopId: "stop_1",
            source: "HNP",
            workOrderId: "WO-2",
            expectedPay: 22,
            routeIncluded: true,
        },
        options,
    );

    assert.notEqual(first.id, second.id);
    assert.equal(first.stopId, second.stopId);
    assert.equal(first.workOrderId, "WO-1");
    assert.equal(second.workOrderId, "WO-2");
});

test("expected pay accepts nonnegative money and rejects invalid values", () => {
    assert.equal(normalizeExpectedPay("18.125"), 18.13);
    assert.equal(normalizeExpectedPay(0), 0);
    assert.equal(normalizeExpectedPay(""), null);
    assert.throws(() => normalizeExpectedPay(-1), /nonnegative/);
    assert.throws(() => normalizeExpectedPay("abc"), /nonnegative/);
});

test("gig storage preserves valid gigs and filters orphan records", () => {
    const storage = memoryStorage();
    const validStopIds = new Set(["stop_1"]);
    const saved = writeGigs(
        storage,
        [
            {
                schemaVersion: 1,
                id: "gig_keep",
                stopId: "stop_1",
                source: "hnp",
                expectedPay: 15,
                routeIncluded: true,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
            {
                schemaVersion: 1,
                id: "gig_orphan",
                stopId: "missing",
                source: "OTHER",
                routeIncluded: false,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
        ],
        validStopIds,
    );

    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, "gig_keep");
    assert.equal(saved[0].source, "HNP");
    assert.equal(readGigs(storage, validStopIds).length, 1);
    assert.match(storage.raw(GIGS_STORAGE_KEY), /gig_keep/);
    assert.doesNotMatch(storage.raw(GIGS_STORAGE_KEY), /gig_orphan/);
});

test("malformed stored gig JSON fails closed to an empty collection", () => {
    const storage = memoryStorage();
    storage.setItem(GIGS_STORAGE_KEY, "{damaged");
    assert.deepEqual(readGigs(storage, new Set(["stop_1"])), []);
});

test("editing a gig preserves identity and creation time while updating fields", () => {
    const original = createGig(
        {
            stopId: "stop_1",
            source: "HNP",
            workOrderId: "WO-OLD",
            expectedPay: 10,
            notes: "old",
            routeIncluded: true,
        },
        {
            validStopIds: new Set(["stop_1"]),
            idFactory: () => "gig_fixed",
            now: "2026-08-22T18:00:00.000Z",
        },
    );

    const edited = applyGigEdit(
        [original],
        "gig_fixed",
        {
            workOrderId: "WO-NEW",
            expectedPay: 12.5,
            notes: "new",
        },
        {
            validStopIds: new Set(["stop_1"]),
            now: "2026-08-22T19:00:00.000Z",
        },
    )[0];

    assert.equal(edited.id, "gig_fixed");
    assert.equal(edited.createdAt, "2026-08-22T18:00:00.000Z");
    assert.equal(edited.updatedAt, "2026-08-22T19:00:00.000Z");
    assert.equal(edited.workOrderId, "WO-NEW");
    assert.equal(edited.expectedPay, 12.5);
    assert.equal(edited.notes, "new");
});

test("stop ID remap keeps a gig attached after a physical-stop merge", () => {
    const remapped = remapGigStopIds(
        [
            {
                id: "gig_1",
                stopId: "old_stop",
                source: "HNP",
                routeIncluded: true,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
        ],
        { old_stop: "retained_stop" },
        new Set(["retained_stop"]),
    );

    assert.equal(remapped.length, 1);
    assert.equal(remapped[0].id, "gig_1");
    assert.equal(remapped[0].stopId, "retained_stop");
});

test("work-order ID remains metadata and does not deduplicate gigs", () => {
    const storage = memoryStorage();
    const saved = writeGigs(
        storage,
        [
            {
                id: "gig_a",
                stopId: "stop_1",
                source: "HNP",
                workOrderId: "SAME-WO",
                routeIncluded: false,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
            {
                id: "gig_b",
                stopId: "stop_1",
                source: "HNP",
                workOrderId: "SAME-WO",
                routeIncluded: false,
                createdAt: "2026-08-22T18:01:00.000Z",
                updatedAt: "2026-08-22T18:01:00.000Z",
            },
        ],
        new Set(["stop_1"]),
    );

    assert.deepEqual(saved.map((gig) => gig.id), ["gig_a", "gig_b"]);
});

test("a new manual gig cannot be created without a saved physical stop", () => {
    assert.throws(
        () =>
            createGig(
                { stopId: "missing", source: "HNP" },
                {
                    validStopIds: new Set(["stop_1"]),
                    idFactory: () => "gig_bad",
                    now: "2026-08-22T18:00:00.000Z",
                },
            ),
        /attached to a saved address/,
    );
});