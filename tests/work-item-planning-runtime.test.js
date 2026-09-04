const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const planningContract = require("../work-item-planning.js");
const routePlanningContract = require("../route-work-planning.js");
const runtimeSource = fs.readFileSync(
    path.join(__dirname, "..", "work-item-planning-runtime.js"),
    "utf8",
);

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
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

function loadRuntime({
    storage,
    restoredPlanning = null,
    routePlanning = routePlanningContract,
}) {
    let domReady = null;
    let handoff = restoredPlanning;
    let restoreCalls = 0;
    const context = {
        FMRWorkItemPlanning: planningContract,
        FMRRouteWorkPlanning: routePlanning,
        FMRBackup: {
            takeParsedPlanningForRestore() {
                const value = handoff;
                handoff = null;
                return value;
            },
        },
        localStorage: storage,
        restoreRoutes(routes) {
            restoreCalls += 1;
            return routes;
        },
        document: {
            addEventListener(name, callback) {
                if (name === "DOMContentLoaded") domReady = callback;
            },
        },
    };
    context.globalThis = context;
    vm.runInNewContext(runtimeSource, context, {
        filename: "work-item-planning-runtime.js",
    });
    assert.equal(typeof domReady, "function");
    domReady();
    return {
        context,
        restoreCalls: () => restoreCalls,
    };
}

function planningRecord(kind, workItemId, values = {}, revision = 1) {
    return {
        schemaVersion: planningContract.PLANNING_SCHEMA_VERSION,
        kind,
        workItemId,
        serviceMinutes: values.serviceMinutes ?? null,
        assignedDate: values.assignedDate ?? null,
        lockedDay: values.lockedDay === true,
        revision,
        updatedAt: values.updatedAt || "2026-09-03T20:00:00.000Z",
    };
}

test("runtime initializes and normalizes planning storage without UI state", () => {
    const good = planningContract.createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 7,
    }, { now: "2026-09-03T12:00:00.000Z" });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([
            good,
            { ...good, workItemId: "ORDER-BAD", assignedDate: "bad-date" },
        ]),
    });

    const { context } = loadRuntime({ storage });
    assert.deepEqual(
        context.FMRWorkItemPlanningRuntime.list().map((record) => record.workItemId),
        ["ORDER-1"],
    );
    assert.match(storage.raw(planningContract.PLANNING_STORAGE_KEY), /ORDER-1/);
    assert.doesNotMatch(storage.raw(planningContract.PLANNING_STORAGE_KEY), /ORDER-BAD/);
});

test("runtime backup hook restores planning after the normal route restore path", () => {
    const restored = [planningContract.createPlanningRecord({
        kind: "gig",
        workItemId: "gig_restore",
        serviceMinutes: 11,
    }, { now: "2026-09-03T12:00:00.000Z" })];
    const storage = memoryStorage();
    const loaded = loadRuntime({ storage, restoredPlanning: restored });

    const routes = { google: { routeIds: [] } };
    assert.equal(loaded.context.restoreRoutes(routes), routes);
    assert.equal(loaded.restoreCalls(), 1);
    assert.deepEqual(
        planningContract.readPlanningRecords(storage).map((record) => record.workItemId),
        ["gig_restore"],
    );
});

test("runtime list and get return copies instead of mutable internal planning records", () => {
    const record = planningContract.createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 5,
    }, { now: "2026-09-03T12:00:00.000Z" });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([record]),
    });
    const { context } = loadRuntime({ storage });

    const copy = context.FMRWorkItemPlanningRuntime.list();
    copy[0].serviceMinutes = 99;
    const exact = context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-1");
    exact.serviceMinutes = 88;

    assert.equal(context.FMRWorkItemPlanningRuntime.list()[0].serviceMinutes, 5);
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-1").serviceMinutes,
        5,
    );
});

test("per-work-item save creates only the exact requested identity at revision one", () => {
    const storage = memoryStorage();
    const { context } = loadRuntime({ storage });

    const created = context.FMRWorkItemPlanningRuntime.save(
        "workbook",
        "ORDER-100",
        {
            serviceMinutes: 9,
            assignedDate: "2026-09-05",
            lockedDay: true,
        },
        {
            expectedRevision: 0,
            now: "2026-09-03T21:00:00.000Z",
        },
    );

    assert.equal(created.kind, "workbook");
    assert.equal(created.workItemId, "ORDER-100");
    assert.equal(created.serviceMinutes, 9);
    assert.equal(created.assignedDate, "2026-09-05");
    assert.equal(created.lockedDay, true);
    assert.equal(created.revision, 1);
    assert.equal(created.updatedAt, "2026-09-03T21:00:00.000Z");
    assert.equal(context.FMRWorkItemPlanningRuntime.list().length, 1);
});

test("workbook and gig records with the same ID text remain separate write targets", () => {
    const storage = memoryStorage();
    const { context } = loadRuntime({ storage });

    context.FMRWorkItemPlanningRuntime.save(
        "workbook",
        "123",
        { serviceMinutes: 5 },
        { expectedRevision: 0, now: "2026-09-03T21:00:00.000Z" },
    );
    context.FMRWorkItemPlanningRuntime.save(
        "gig",
        "123",
        { serviceMinutes: 15 },
        { expectedRevision: 0, now: "2026-09-03T21:01:00.000Z" },
    );

    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "123").serviceMinutes,
        5,
    );
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("gig", "123").serviceMinutes,
        15,
    );
    assert.equal(context.FMRWorkItemPlanningRuntime.list().length, 2);
});

test("editing one work item increments only its revision and preserves every other record", () => {
    const first = planningRecord("workbook", "ORDER-1", {
        serviceMinutes: 5,
        assignedDate: "2026-09-04",
    });
    const second = planningRecord("workbook", "ORDER-2", {
        serviceMinutes: 7,
    });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([first, second]),
    });
    const { context } = loadRuntime({ storage });

    const edited = context.FMRWorkItemPlanningRuntime.save(
        "workbook",
        "ORDER-1",
        {
            serviceMinutes: 12,
            kind: "gig",
            workItemId: "SHOULD-NOT-REPLACE-IDENTITY",
        },
        {
            expectedRevision: 1,
            now: "2026-09-03T22:00:00.000Z",
        },
    );

    assert.equal(edited.kind, "workbook");
    assert.equal(edited.workItemId, "ORDER-1");
    assert.equal(edited.serviceMinutes, 12);
    assert.equal(edited.assignedDate, "2026-09-04");
    assert.equal(edited.revision, 2);
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-2").serviceMinutes,
        7,
    );
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-2").revision,
        1,
    );
});

test("exact fields can be cleared without changing identity", () => {
    const existing = planningRecord("gig", "gig_clear", {
        serviceMinutes: 14,
        assignedDate: "2026-09-05",
        lockedDay: true,
    });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([existing]),
    });
    const { context } = loadRuntime({ storage });

    const cleared = context.FMRWorkItemPlanningRuntime.save(
        "gig",
        "gig_clear",
        {
            serviceMinutes: null,
            assignedDate: "",
            lockedDay: false,
        },
        {
            expectedRevision: 1,
            now: "2026-09-03T22:00:00.000Z",
        },
    );

    assert.equal(cleared.kind, "gig");
    assert.equal(cleared.workItemId, "gig_clear");
    assert.equal(cleared.serviceMinutes, null);
    assert.equal(cleared.assignedDate, null);
    assert.equal(cleared.lockedDay, false);
    assert.equal(cleared.revision, 2);
});

test("same-value save is a no-op and does not create revision churn", () => {
    const existing = planningRecord("workbook", "ORDER-1", {
        serviceMinutes: 5,
        assignedDate: "2026-09-04",
        lockedDay: false,
    });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([existing]),
    });
    const { context } = loadRuntime({ storage });

    const unchanged = context.FMRWorkItemPlanningRuntime.save(
        "workbook",
        "ORDER-1",
        { serviceMinutes: "5" },
        {
            expectedRevision: 1,
            now: "2026-09-03T23:00:00.000Z",
        },
    );

    assert.equal(unchanged.revision, 1);
    assert.equal(unchanged.updatedAt, "2026-09-03T20:00:00.000Z");
});

test("stale edit cannot overwrite a newer saved revision", () => {
    const existing = planningRecord("workbook", "ORDER-1", {
        serviceMinutes: 5,
    });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([existing]),
    });
    const { context } = loadRuntime({ storage });

    const firstEdit = context.FMRWorkItemPlanningRuntime.save(
        "workbook",
        "ORDER-1",
        { serviceMinutes: 10 },
        {
            expectedRevision: 1,
            now: "2026-09-03T21:00:00.000Z",
        },
    );
    assert.equal(firstEdit.revision, 2);

    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { serviceMinutes: 20 },
            {
                expectedRevision: 1,
                now: "2026-09-03T22:00:00.000Z",
            },
        ),
        /changed since it was loaded/,
    );
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-1").serviceMinutes,
        10,
    );
});

test("save re-reads storage and rejects an edit made stale by another writer", () => {
    const revisionOne = planningRecord("workbook", "ORDER-1", {
        serviceMinutes: 5,
    });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([revisionOne]),
    });
    const { context } = loadRuntime({ storage });

    const externalRevisionTwo = {
        ...revisionOne,
        serviceMinutes: 11,
        revision: 2,
        updatedAt: "2026-09-03T21:30:00.000Z",
    };
    storage.setItem(
        planningContract.PLANNING_STORAGE_KEY,
        JSON.stringify([externalRevisionTwo]),
    );

    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { serviceMinutes: 20 },
            {
                expectedRevision: 1,
                now: "2026-09-03T22:00:00.000Z",
            },
        ),
        /changed since it was loaded/,
    );
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-1").serviceMinutes,
        11,
    );
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-1").revision,
        2,
    );
});

test("create-only revision zero refuses to overwrite an existing identity", () => {
    const existing = planningRecord("workbook", "ORDER-1", {
        serviceMinutes: 5,
    });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([existing]),
    });
    const { context } = loadRuntime({ storage });

    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { serviceMinutes: 99 },
            { expectedRevision: 0 },
        ),
        /changed since it was loaded/,
    );
    assert.equal(
        context.FMRWorkItemPlanningRuntime.get("workbook", "ORDER-1").serviceMinutes,
        5,
    );
});

test("save refuses missing revision, unsupported-only drafts, and invalid planning values", () => {
    const storage = memoryStorage();
    const { context } = loadRuntime({ storage });

    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { serviceMinutes: 5 },
        ),
        /Expected planning revision/,
    );
    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { address: "not planning identity" },
            { expectedRevision: 0 },
        ),
        /must include service minutes, assigned date, or locked day/,
    );
    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { serviceMinutes: 0 },
            { expectedRevision: 0 },
        ),
        /positive number/,
    );
    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.save(
            "workbook",
            "ORDER-1",
            { assignedDate: "09\/05\/2026" },
            { expectedRevision: 0 },
        ),
        /valid local calendar date/,
    );
});

test("runtime exposes exact mutation methods but no whole-collection replace API", () => {
    const storage = memoryStorage();
    const { context } = loadRuntime({ storage });

    assert.equal(typeof context.FMRWorkItemPlanningRuntime.get, "function");
    assert.equal(typeof context.FMRWorkItemPlanningRuntime.save, "function");
    assert.equal(context.FMRWorkItemPlanningRuntime.replace, undefined);
});

test("runtime projects a route from its current saved planning records", () => {
    const record = planningContract.createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-2",
        serviceMinutes: 20,
        assignedDate: "2026-09-04",
        lockedDay: true,
    }, { now: "2026-09-03T20:00:00.000Z" });
    const storage = memoryStorage({
        [planningContract.PLANNING_STORAGE_KEY]: JSON.stringify([record]),
    });
    const { context } = loadRuntime({ storage });

    const projection = context.FMRWorkItemPlanningRuntime.projectRoute({
        routeIds: ["stop_1"],
        orderIdsByStopId: {
            stop_1: ["ORDER-1", "ORDER-2"],
        },
    });

    assert.equal(projection.routeStopCount, 1);
    assert.equal(projection.workItemCount, 2);
    assert.equal(projection.serviceMinutes, 25);
    assert.equal(projection.stops[0].items[1].assignedDate, "2026-09-04");
    assert.equal(projection.stops[0].items[1].lockedDay, true);
});

test("missing route projection module does not break existing planning startup", () => {
    const storage = memoryStorage();
    const { context } = loadRuntime({ storage, routePlanning: null });

    assert.deepEqual(context.FMRWorkItemPlanningRuntime.list(), []);
    assert.throws(
        () => context.FMRWorkItemPlanningRuntime.projectRoute({ routeIds: [] }),
        /route work planning is not loaded yet/,
    );
});
