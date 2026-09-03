const test = require("node:test");
const assert = require("node:assert/strict");

const {
    BACKUP_VERSION,
    createBackup,
    parseBackup,
    takeParsedPlanningForRestore,
} = require("../backup.js");
const { createPlanningRecord } = require("../work-item-planning.js");

function routeSet() {
    return {
        google: { routeIds: ["stop_1"] },
        basic: { routeIds: ["stop_1"] },
        pending: null,
    };
}

test("version 3 backup preserves exact work-item planning records", () => {
    const workbookPlan = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 8,
        assignedDate: "2026-09-04",
        lockedDay: true,
    }, { now: "2026-09-03T12:00:00.000Z" });
    const gigPlan = createPlanningRecord({
        kind: "gig",
        workItemId: "gig_1",
        serviceMinutes: 15,
    }, { now: "2026-09-03T12:05:00.000Z" });

    const backup = createBackup({
        home: { id: "home", address: "Home" },
        stops: [{ id: "stop_1", address: "A" }],
        planning: [workbookPlan, gigPlan],
        routes: routeSet(),
    });

    assert.equal(backup.backupVersion, BACKUP_VERSION);
    assert.equal(BACKUP_VERSION, 3);
    assert.deepEqual(
        backup.planning.map((record) => `${record.kind}:${record.workItemId}`),
        ["workbook:ORDER-1", "gig:gig_1"],
    );

    const restored = parseBackup(JSON.stringify(backup));
    assert.deepEqual(restored.planning, backup.planning);
    assert.equal(restored.planning[0].assignedDate, "2026-09-04");
    assert.equal(restored.planning[0].lockedDay, true);
});

test("version 1 and version 2 backups remain valid with an empty planning collection", () => {
    for (const backupVersion of [1, 2]) {
        const restored = parseBackup(JSON.stringify({
            app: "free-map-router",
            backupVersion,
            home: { id: "home", address: "Home" },
            stops: [{ id: "stop_1", address: "A" }],
            gigs: [],
            routeIds: ["stop_1"],
            routes: routeSet(),
        }));
        assert.deepEqual(restored.planning, []);
    }
});

test("damaged planning rows are isolated without damaging the rest of a valid backup", () => {
    const good = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-GOOD",
        serviceMinutes: 5,
    }, { now: "2026-09-03T12:00:00.000Z" });

    const restored = parseBackup(JSON.stringify({
        app: "free-map-router",
        backupVersion: 3,
        home: { id: "home", address: "Home" },
        stops: [{ id: "stop_1", address: "A" }],
        gigs: [],
        planning: [
            good,
            { ...good, workItemId: "ORDER-BAD", assignedDate: "09/04/2026" },
        ],
        routeIds: ["stop_1"],
        routes: routeSet(),
    }));

    assert.equal(restored.home.address, "Home");
    assert.equal(restored.stops.length, 1);
    assert.deepEqual(restored.planning.map((record) => record.workItemId), ["ORDER-GOOD"]);
});

test("parsed planning restore handoff is one-shot", () => {
    const planning = [createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
    }, { now: "2026-09-03T12:00:00.000Z" })];

    parseBackup(JSON.stringify({
        app: "free-map-router",
        backupVersion: 3,
        home: { id: "home", address: "Home" },
        stops: [{ id: "stop_1", address: "A" }],
        gigs: [],
        planning,
        routeIds: ["stop_1"],
        routes: routeSet(),
    }));

    assert.deepEqual(takeParsedPlanningForRestore(), planning);
    assert.equal(takeParsedPlanningForRestore(), null);
});