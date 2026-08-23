const test = require("node:test");
const assert = require("node:assert/strict");

const {
    emptyLibrary,
    findPropertyForStop,
    mergeManualWorkLibraries,
    normalizeLibrary,
    parseManualWorkRecord,
    restoreLibraryPropertiesToStops,
    setPropertyArchived,
    upsertPropertyFromStop,
} = require("../manual-work-library.js");

function stop(overrides = {}) {
    return {
        id: "stop-1",
        address: "11270 NE Jere Layne, Elgin, OK 73538",
        addressAliases: [],
        latitude: 34.777,
        longitude: -98.292,
        pinStatus: "manual",
        ...overrides,
    };
}

test("Manual Work Library creates one stable property for one physical stop", () => {
    const first = upsertPropertyFromStop(emptyLibrary(), stop(), {
        now: new Date("2026-08-22T12:00:00Z"),
        idFactory: () => "property-one",
    });
    const second = upsertPropertyFromStop(first, stop(), {
        now: new Date("2026-08-22T12:01:00Z"),
        idFactory: () => "property-two",
    });

    assert.equal(second.properties.length, 1);
    assert.equal(second.properties[0].propertyId, "property-one");
    assert.equal(second.properties[0].pinStatus, "manual");
});

test("property correction keeps property identity and remembers the prior exact address", () => {
    const first = upsertPropertyFromStop(emptyLibrary(), stop({
        address: "RR1 BOX 3240, Elk City, OK 73644",
    }), {
        now: new Date("2026-08-22T12:00:00Z"),
        idFactory: () => "property-rural",
    });
    const corrected = upsertPropertyFromStop(first, stop({
        address: "11202 N 2020 RD, Elk City, OK 73644",
        addressAliases: ["RR1 BOX 3240, Elk City, OK 73644"],
    }), {
        now: new Date("2026-08-22T12:05:00Z"),
    });

    assert.equal(corrected.properties.length, 1);
    assert.equal(corrected.properties[0].propertyId, "property-rural");
    assert.equal(
        corrected.properties[0].address,
        "11202 N 2020 RD, Elk City, OK 73644",
    );
    assert.deepEqual(corrected.properties[0].addressAliases, [
        "RR1 BOX 3240, Elk City, OK 73644",
    ]);
    assert.equal(
        findPropertyForStop(corrected, stop({
            address: "RR1 BOX 3240, Elk City, OK 73644",
        })).propertyId,
        "property-rural",
    );
});

test("newer remote or local property wins stale-safe merge by updatedAt", () => {
    const remote = normalizeLibrary({
        updatedAt: "2026-08-22T12:10:00Z",
        properties: [{
            propertyId: "property-one",
            address: "100 Main St, Elk City, OK 73644",
            archived: false,
            updatedAt: "2026-08-22T12:10:00Z",
        }],
    });
    const local = normalizeLibrary({
        updatedAt: "2026-08-22T12:00:00Z",
        properties: [{
            propertyId: "property-one",
            address: "100 Main St, Elk City, OK 73644",
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
    });

    const merged = mergeManualWorkLibraries(
        remote,
        local,
        new Date("2026-08-22T12:11:00Z"),
    );
    assert.equal(merged.properties[0].updatedAt, "2026-08-22T12:10:00.000Z");
});

test("newer archive is not resurrected by an older active device copy", () => {
    const active = normalizeLibrary({
        properties: [{
            propertyId: "property-one",
            address: "100 Main St, Elk City, OK 73644",
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
    });
    const archived = setPropertyArchived(
        active,
        "property-one",
        true,
        new Date("2026-08-22T12:10:00Z"),
    );

    const merged = mergeManualWorkLibraries(archived, active);
    assert.equal(merged.properties[0].archived, true);
});

test("sync restoration adds a missing active property once without route metadata or ADE source", () => {
    const library = normalizeLibrary({
        properties: [{
            propertyId: "property-one",
            address: "100 Main St, Elk City, OK 73644",
            latitude: 35.0,
            longitude: -99.0,
            pinStatus: "manual",
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
    });

    const first = restoreLibraryPropertiesToStops(library, []);
    const second = restoreLibraryPropertiesToStops(library, first.stops);
    assert.equal(first.restoredCount, 1);
    assert.equal(second.restoredCount, 0);
    assert.equal(second.stops.length, 1);
    assert.equal(second.stops[0].source, "");
    assert.equal(second.stops[0].label, "");
    assert.equal(second.stops[0].pinStatus, "manual");
});

test("archived property is not restored to saved addresses", () => {
    const library = normalizeLibrary({
        properties: [{
            propertyId: "property-one",
            address: "100 Main St, Elk City, OK 73644",
            archived: true,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
    });
    const result = restoreLibraryPropertiesToStops(library, []);
    assert.equal(result.restoredCount, 0);
    assert.deepEqual(result.stops, []);
});

test("Manual Work Library parser rejects damaged or unexpected records", () => {
    assert.throws(() => parseManualWorkRecord("not json"), /damaged/);
    assert.throws(
        () => parseManualWorkRecord(JSON.stringify({ app: "other", properties: [] })),
        /unexpected structure/,
    );
});