const test = require("node:test");
const assert = require("node:assert/strict");

const { BACKUP_VERSION, createBackup, parseBackup } = require("../backup.js");

test("version 2 backup preserves manual gigs beside existing routes", () => {
    const backup = createBackup({
        home: { id: "home", address: "Home" },
        stops: [
            { id: "stop_1", address: "100 Main St" },
            { id: "stop_2", address: "200 Main St" },
        ],
        gigs: [
            {
                id: "gig_1",
                stopId: "stop_1",
                source: "HNP",
                workOrderId: "WO-1",
                expectedPay: 18,
                notes: "Gate code",
                routeIncluded: true,
                dueDate: "2026-08-25",
                completedDate: "2026-08-23",
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
        ],
        routes: {
            google: { routeIds: ["stop_1", "stop_2"] },
            basic: { routeIds: ["stop_2", "stop_1"] },
            pending: null,
        },
    });

    assert.equal(BACKUP_VERSION, 2);
    assert.equal(backup.backupVersion, 2);
    assert.equal(backup.gigs.length, 1);

    const restored = parseBackup(JSON.stringify(backup));
    assert.equal(restored.gigs.length, 1);
    assert.equal(restored.gigs[0].id, "gig_1");
    assert.equal(restored.gigs[0].stopId, "stop_1");
    assert.equal(restored.gigs[0].expectedPay, 18);
    assert.equal(restored.gigs[0].dueDate, "2026-08-25");
    assert.equal(restored.gigs[0].completedDate, "2026-08-23");
    assert.deepEqual(restored.routes.google.routeIds, ["stop_1", "stop_2"]);
    assert.deepEqual(restored.routes.basic.routeIds, ["stop_2", "stop_1"]);
});

test("a version 2 backup migrates embedded version 1 gigs without changing Gig ID", () => {
    const restored = parseBackup(JSON.stringify({
        app: "free-map-router",
        backupVersion: 2,
        home: null,
        stops: [{ id: "stop_1", address: "100 Main St" }],
        routeIds: ["stop_1"],
        gigs: [{
            schemaVersion: 1,
            id: "gig_legacy_backup",
            stopId: "stop_1",
            source: "HNP",
            routeIncluded: true,
            createdAt: "2026-08-22T18:00:00.000Z",
            updatedAt: "2026-08-22T18:00:00.000Z",
        }],
    }));
    assert.equal(restored.gigs[0].id, "gig_legacy_backup");
    assert.equal(restored.gigs[0].schemaVersion, 2);
    assert.equal(restored.gigs[0].dueDate, null);
    assert.equal(restored.gigs[0].completedDate, null);
});

test("legacy version 1 backup remains restorable with an empty gig collection", () => {
    const legacy = {
        app: "free-map-router",
        backupVersion: 1,
        home: { id: "home", address: "Home" },
        stops: [{ id: "stop_1", address: "100 Main St" }],
        routeIds: ["stop_1"],
        routes: {
            current: { routeIds: ["stop_1"] },
            previous: null,
        },
    };

    const restored = parseBackup(JSON.stringify(legacy));
    assert.deepEqual(restored.gigs, []);
    assert.deepEqual(restored.routeIds, ["stop_1"]);
    assert.equal(restored.home.address, "Home");
});

test("malformed or orphan gig rows are omitted without damaging valid backup data", () => {
    const payload = {
        app: "free-map-router",
        backupVersion: 2,
        home: { id: "home", address: "Home" },
        stops: [{ id: "stop_1", address: "100 Main St" }],
        routeIds: ["stop_1"],
        routes: { google: { routeIds: ["stop_1"] } },
        gigs: [
            {
                id: "gig_keep",
                stopId: "stop_1",
                source: "HNP",
                expectedPay: 20,
                routeIncluded: true,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
            {
                id: "gig_orphan",
                stopId: "missing",
                source: "HNP",
                routeIncluded: true,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
            {
                id: "gig_bad_pay",
                stopId: "stop_1",
                source: "HNP",
                expectedPay: -5,
                routeIncluded: true,
                createdAt: "2026-08-22T18:00:00.000Z",
                updatedAt: "2026-08-22T18:00:00.000Z",
            },
        ],
    };

    const restored = parseBackup(JSON.stringify(payload));
    assert.equal(restored.home.address, "Home");
    assert.equal(restored.stops.length, 1);
    assert.deepEqual(restored.routeIds, ["stop_1"]);
    assert.deepEqual(restored.gigs.map((gig) => gig.id), ["gig_keep"]);
});
