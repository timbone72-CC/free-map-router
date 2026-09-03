const test = require("node:test");
const assert = require("node:assert/strict");

const {
    PLANNING_SCHEMA_VERSION,
    PLANNING_STORAGE_KEY,
    applyPlanningEdit,
    createPlanningRecord,
    mergePlanningRecord,
    normalizeCalendarDate,
    readPlanningRecords,
    resolveWorkItemServiceMinutes,
    summarizeStopServiceMinutes,
    workItemKey,
    writePlanningRecords,
} = require("../work-item-planning.js");

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

test("workbook and gig identities remain distinct even when their IDs have the same text", () => {
    assert.equal(workItemKey("workbook", "123"), "workbook:123");
    assert.equal(workItemKey("gig", "123"), "gig:123");
    assert.notEqual(workItemKey("workbook", "123"), workItemKey("gig", "123"));
});

test("ordinary workbook work resolves to five minutes without storing the default", () => {
    const records = [];
    assert.equal(resolveWorkItemServiceMinutes("workbook", "ORDER-1", records), 5);
    assert.deepEqual(records, []);
});

test("explicit service duration override wins over workbook defaults", () => {
    const record = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 12,
    }, { now: "2026-09-03T12:00:00.000Z" });

    assert.equal(resolveWorkItemServiceMinutes("workbook", "ORDER-1", [record]), 12);
    assert.equal(record.serviceMinutes, 12);
});

test("interior duration is used only when an explicit verified resolver says true", () => {
    const records = [];
    assert.equal(
        resolveWorkItemServiceMinutes("workbook", "UNKNOWN-CODE", records, {
            workCode: "INTERIOR",
        }),
        5,
    );
    assert.equal(
        resolveWorkItemServiceMinutes("workbook", "ORDER-INTERIOR", records, {
            isVerifiedInteriorWorkbookItem: (workItemId) => workItemId === "ORDER-INTERIOR",
        }),
        20,
    );
});

test("two workbook work items at one physical stop aggregate without merging identity", () => {
    const summary = summarizeStopServiceMinutes({
        orderIds: ["ORDER-OUTSIDE", "ORDER-INTERIOR"],
    }, [], {
        isVerifiedInteriorWorkbookItem: (workItemId) => workItemId === "ORDER-INTERIOR",
    });

    assert.equal(summary.workItemCount, 2);
    assert.equal(summary.serviceMinutes, 25);
    assert.equal(summary.complete, true);
    assert.deepEqual(summary.items, [
        { kind: "workbook", workItemId: "ORDER-OUTSIDE", serviceMinutes: 5 },
        { kind: "workbook", workItemId: "ORDER-INTERIOR", serviceMinutes: 20 },
    ]);
});

test("workbook and manual gig work aggregate at one stop without merging their identities", () => {
    const gigPlan = createPlanningRecord({
        kind: "gig",
        workItemId: "gig_1",
        serviceMinutes: 15,
    }, { now: "2026-09-03T12:00:00.000Z" });

    const summary = summarizeStopServiceMinutes({
        orderIds: ["ORDER-1"],
        gigIds: ["gig_1"],
    }, [gigPlan]);

    assert.equal(summary.workItemCount, 2);
    assert.equal(summary.serviceMinutes, 20);
    assert.deepEqual(summary.items.map((item) => `${item.kind}:${item.workItemId}`), [
        "workbook:ORDER-1",
        "gig:gig_1",
    ]);
});

test("manual gig duration remains unknown until an exact override exists", () => {
    const summary = summarizeStopServiceMinutes({ gigIds: ["gig_unknown"] }, []);
    assert.equal(summary.serviceMinutes, null);
    assert.equal(summary.knownServiceMinutes, 0);
    assert.equal(summary.complete, false);
    assert.equal(summary.items[0].serviceMinutes, null);
});

test("planning records persist exact identity, assigned local date, lock state, revision, and timestamp", () => {
    const storage = memoryStorage();
    const record = createPlanningRecord({
        kind: "workbook",
        workItemId: "  ORDER-9  ",
        serviceMinutes: 7.5,
        assignedDate: "2026-11-01",
        lockedDay: true,
    }, { now: "2026-09-03T12:00:00.000Z" });

    writePlanningRecords(storage, [record]);
    const [saved] = readPlanningRecords(storage);

    assert.equal(saved.schemaVersion, PLANNING_SCHEMA_VERSION);
    assert.equal(saved.kind, "workbook");
    assert.equal(saved.workItemId, "ORDER-9");
    assert.equal(saved.serviceMinutes, 7.5);
    assert.equal(saved.assignedDate, "2026-11-01");
    assert.equal(saved.lockedDay, true);
    assert.equal(saved.revision, 1);
    assert.equal(saved.updatedAt, "2026-09-03T12:00:00.000Z");
    assert.match(storage.raw(PLANNING_STORAGE_KEY), /ORDER-9/);
});

test("assigned dates are calendar strings and do not shift through timezone conversion", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "America/Chicago";
    try {
        assert.equal(normalizeCalendarDate("2026-11-01"), "2026-11-01");
        assert.equal(normalizeCalendarDate("2026-03-08"), "2026-03-08");
        assert.throws(
            () => normalizeCalendarDate("2026-02-30"),
            /valid local calendar date/,
        );
    } finally {
        process.env.TZ = previousTimezone;
    }
});

test("stale edits cannot overwrite a newer planning revision", () => {
    const original = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 5,
    }, { now: "2026-09-03T12:00:00.000Z" });

    const updated = applyPlanningEdit(
        [original],
        "workbook",
        "ORDER-1",
        { serviceMinutes: 10 },
        { expectedRevision: 1, now: "2026-09-03T13:00:00.000Z" },
    );
    assert.equal(updated[0].revision, 2);
    assert.equal(updated[0].serviceMinutes, 10);

    assert.throws(
        () => applyPlanningEdit(
            updated,
            "workbook",
            "ORDER-1",
            { serviceMinutes: 20 },
            { expectedRevision: 1, now: "2026-09-03T14:00:00.000Z" },
        ),
        /changed since it was loaded/,
    );
    assert.equal(updated[0].serviceMinutes, 10);
});

test("record merge rejects same-revision conflicts and refuses older values", () => {
    const newer = {
        schemaVersion: 1,
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 10,
        assignedDate: null,
        lockedDay: false,
        revision: 2,
        updatedAt: "2026-09-03T13:00:00.000Z",
    };
    const older = {
        ...newer,
        serviceMinutes: 5,
        revision: 1,
        updatedAt: "2026-09-03T12:00:00.000Z",
    };
    assert.deepEqual(mergePlanningRecord(newer, older), newer);

    assert.throws(
        () => mergePlanningRecord(newer, {
            ...newer,
            serviceMinutes: 20,
            updatedAt: "2026-09-03T14:00:00.000Z",
        }),
        /conflict at the same revision/,
    );
});

test("damaged planning storage fails separately to an empty collection", () => {
    const storage = memoryStorage();
    storage.setItem(PLANNING_STORAGE_KEY, "{damaged");
    assert.deepEqual(readPlanningRecords(storage), []);
});

test("a physical-stop correction is irrelevant to planning identity because planning stores no stop ID or address", () => {
    const record = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-777",
        serviceMinutes: 8,
        assignedDate: "2026-09-04",
    }, { now: "2026-09-03T12:00:00.000Z" });

    assert.equal(Object.hasOwn(record, "stopId"), false);
    assert.equal(Object.hasOwn(record, "address"), false);
    assert.equal(record.workItemId, "ORDER-777");
});
