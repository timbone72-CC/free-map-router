const test = require("node:test");
const assert = require("node:assert/strict");

const {
    MANUAL_WORK_VERSION,
    advanceTemplateDue,
    dueState,
    emptyLibrary,
    findPropertyForStop,
    mergeManualWorkLibraries,
    normalizeLibrary,
    parseManualWorkRecord,
    restoreLibraryPropertiesToStops,
    setPropertyArchived,
    templateForProperty,
    upsertPropertyFromStop,
    upsertRepeatTemplate,
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

function propertyLibrary(overrides = {}) {
    return normalizeLibrary({
        updatedAt: "2026-08-22T12:00:00Z",
        properties: [{
            propertyId: "property-one",
            address: "100 Main St, Elk City, OK 73644",
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
            ...overrides,
        }],
        templates: [],
    });
}

function scheduledLibrary(overrides = {}, options = {}) {
    return upsertRepeatTemplate(
        propertyLibrary(),
        "property-one",
        {
            source: "HNP",
            expectedPay: "18",
            notes: "Repeat inspection",
            recurrenceCount: 30,
            recurrenceUnit: "days",
            nextDueDate: "2026-09-18",
            ...overrides,
        },
        {
            now: options.now || new Date("2026-08-22T12:10:00Z"),
            idFactory: options.idFactory || (() => "template-one"),
        },
    );
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

test("version 1 Manual Work Library migrates to version 2 without losing properties", () => {
    const migrated = parseManualWorkRecord(JSON.stringify({
        app: "free-map-router",
        manualWorkVersion: 1,
        updatedAt: "2026-08-22T12:00:00Z",
        properties: [{
            propertyId: "property-legacy",
            address: "123 Anywhere Dr, Elk City, OK 73644",
            addressAliases: ["123 Anywhere Drive, Elk City, OK 73644"],
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
    }));

    assert.equal(migrated.manualWorkVersion, MANUAL_WORK_VERSION);
    assert.equal(migrated.properties.length, 1);
    assert.equal(migrated.properties[0].propertyId, "property-legacy");
    assert.deepEqual(migrated.properties[0].addressAliases, [
        "123 Anywhere Drive, Elk City, OK 73644",
    ]);
    assert.deepEqual(migrated.templates, []);
});

test("repeat schedule keeps one stable template ID per property", () => {
    const first = scheduledLibrary({}, { idFactory: () => "template-original" });
    const edited = upsertRepeatTemplate(
        first,
        "property-one",
        {
            source: "HNP",
            expectedPay: 22,
            notes: "Updated repeat",
            recurrenceCount: 2,
            recurrenceUnit: "weeks",
            nextDueDate: "2026-09-25",
        },
        {
            now: new Date("2026-08-22T12:20:00Z"),
            idFactory: () => "template-should-not-replace",
        },
    );

    assert.equal(edited.templates.length, 1);
    assert.equal(edited.templates[0].templateId, "template-original");
    assert.equal(edited.templates[0].expectedPay, 22);
    assert.equal(edited.templates[0].recurrenceCount, 2);
    assert.equal(edited.templates[0].recurrenceUnit, "weeks");
    assert.equal(edited.templates[0].alertLeadDays, 4);
});

test("repeat schedule rejects invalid cadence, date, and expected pay", () => {
    assert.throws(
        () => scheduledLibrary({ recurrenceCount: 0 }),
        /whole number from 1 through 365/,
    );
    assert.throws(
        () => scheduledLibrary({ recurrenceCount: 1.5 }),
        /whole number from 1 through 365/,
    );
    assert.throws(
        () => scheduledLibrary({ recurrenceUnit: "years" }),
        /days, weeks, or months/,
    );
    assert.throws(
        () => scheduledLibrary({ nextDueDate: "2026-02-31" }),
        /valid calendar date/,
    );
    assert.throws(
        () => scheduledLibrary({ expectedPay: -1 }),
        /nonnegative number/,
    );
});

test("due status uses exact four-day local-calendar boundaries", () => {
    const template = scheduledLibrary().templates[0];

    assert.equal(dueState(template, "2026-09-13").code, "upcoming");
    assert.equal(dueState(template, "2026-09-14").code, "due-soon");
    assert.equal(dueState(template, "2026-09-14").label, "Due in 4 days");
    assert.equal(dueState(template, "2026-09-17").label, "Due in 1 day");
    assert.equal(dueState(template, "2026-09-18").code, "due-today");
    assert.equal(dueState(template, "2026-09-19").code, "overdue");
    assert.equal(dueState(template, "2026-09-20").label, "Overdue by 2 days");
});

test("daily cadence advances from scheduled due date instead of the action date", () => {
    const library = scheduledLibrary({
        recurrenceCount: 30,
        recurrenceUnit: "days",
        nextDueDate: "2026-09-18",
    });

    const early = advanceTemplateDue(library, "template-one", "2026-09-14");
    assert.equal(templateForProperty(early, "property-one").nextDueDate, "2026-10-18");

    const late = advanceTemplateDue(library, "template-one", "2026-11-01");
    assert.equal(templateForProperty(late, "property-one").nextDueDate, "2026-11-17");
});

test("weekly cadence skips missed periods to the first future scheduled date", () => {
    const library = scheduledLibrary({
        recurrenceCount: 2,
        recurrenceUnit: "weeks",
        nextDueDate: "2026-09-01",
    });
    const advanced = advanceTemplateDue(library, "template-one", "2026-10-01");
    assert.equal(templateForProperty(advanced, "property-one").nextDueDate, "2026-10-13");
});

test("monthly cadence preserves its scheduled day across short months", () => {
    const january = scheduledLibrary({
        recurrenceCount: 1,
        recurrenceUnit: "months",
        nextDueDate: "2027-01-31",
    });
    const february = advanceTemplateDue(january, "template-one", "2027-01-31");
    assert.equal(templateForProperty(february, "property-one").nextDueDate, "2027-02-28");
    const march = advanceTemplateDue(february, "template-one", "2027-02-28");
    assert.equal(templateForProperty(march, "property-one").nextDueDate, "2027-03-31");
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

test("newer repeat schedule wins stale-safe merge", () => {
    const oldSchedule = scheduledLibrary(
        { nextDueDate: "2026-09-18" },
        { now: new Date("2026-08-22T12:10:00Z") },
    );
    const newSchedule = upsertRepeatTemplate(
        oldSchedule,
        "property-one",
        {
            source: "HNP",
            expectedPay: 18,
            notes: "Repeat inspection",
            recurrenceCount: 30,
            recurrenceUnit: "days",
            nextDueDate: "2026-10-18",
        },
        { now: new Date("2026-08-22T12:20:00Z") },
    );

    const merged = mergeManualWorkLibraries(oldSchedule, newSchedule);
    assert.equal(templateForProperty(merged, "property-one").nextDueDate, "2026-10-18");
    assert.equal(
        templateForProperty(merged, "property-one").updatedAt,
        "2026-08-22T12:20:00.000Z",
    );
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
    assert.throws(
        () => parseManualWorkRecord(JSON.stringify({
            app: "free-map-router",
            manualWorkVersion: 2,
            properties: [],
        })),
        /unexpected structure/,
    );
});