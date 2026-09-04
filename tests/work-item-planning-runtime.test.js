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

test("runtime list returns copies instead of mutable internal planning records", () => {
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
    assert.equal(context.FMRWorkItemPlanningRuntime.list()[0].serviceMinutes, 5);
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
