const test = require("node:test");
const assert = require("node:assert/strict");

const {
    backupFilename,
    createBackup,
    parseBackup,
} = require("../backup.js");

test("backup preserves route data without adding the API key", () => {
    const backup = createBackup({
        home: { id: "home", address: "222 Blackburn Blvd" },
        stops: [{ id: "stop_1", address: "400 N 6th St" }],
        routeIds: ["stop_1"],
        geoapifyKey: "private-key",
    });
    const text = JSON.stringify(backup);

    assert.equal(backup.home.address, "222 Blackburn Blvd");
    assert.equal(backup.stops.length, 1);
    assert.deepEqual(backup.routeIds, ["stop_1"]);
    assert.deepEqual(backup.routes.google.routeIds, ["stop_1"]);
    assert.deepEqual(backup.routes.basic.routeIds, ["stop_1"]);
    assert.equal(backup.routes.pending, null);
    assert.doesNotMatch(text, /private-key/);
    assert.equal(Object.hasOwn(backup, "geoapifyKey"), false);
});

test("valid backup can be restored", () => {
    const original = createBackup({
        home: { id: "home", address: "222 Blackburn Blvd" },
        stops: [{ id: "stop_1", address: "400 N 6th St" }],
        routeIds: ["stop_1", "", 123],
    });

    const restored = parseBackup(JSON.stringify(original));
    assert.equal(restored.home.address, "222 Blackburn Blvd");
    assert.equal(restored.stops.length, 1);
    assert.deepEqual(restored.routeIds, ["stop_1"]);
    assert.deepEqual(restored.routes.google.routeIds, ["stop_1"]);
    assert.deepEqual(restored.routes.basic.routeIds, ["stop_1"]);
    assert.equal(restored.routes.pending, null);
});

test("backup preserves saved address correction aliases", () => {
    const original = createBackup({
        home: { id: "home", address: "222 Blackburn Blvd" },
        stops: [
            {
                id: "workbook-rr",
                address: "11202 N 2020 RD, Elk City, OK 73644",
                addressAliases: ["RR1 BOX 3240, Elk City, OK 73644"],
                source: "DCFS",
            },
        ],
        routeIds: ["workbook-rr"],
    });

    const restored = parseBackup(JSON.stringify(original));
    assert.deepEqual(restored.stops[0].addressAliases, [
        "RR1 BOX 3240, Elk City, OK 73644",
    ]);
    assert.equal(restored.stops[0].source, "DCFS");
});

test("backup preserves Google, Basic, and pending route snapshots", () => {
    const stops = [
        { id: "a", address: "A" },
        { id: "b", address: "B" },
        { id: "c", address: "C" },
    ];
    const backup = createBackup({
        home: { address: "Home" },
        stops,
        routes: {
            google: {
                routeIds: ["b", "a"],
                sourceUpdatedAt: "2026-08-10T14:00:00.000Z",
                optimizationStatus: "google_optimized",
                orderIdsByStopId: {
                    a: ["ORDER-A"],
                    b: ["ORDER-B"],
                },
            },
            basic: {
                routeIds: ["c"],
                sourceUpdatedAt: "2026-08-10T13:00:00.000Z",
                optimizationStatus: "manually_changed",
            },
            pending: {
                routeIds: ["a", "c"],
                sourceUpdatedAt: "2026-08-10T15:00:00.000Z",
                optimizationStatus: "not_optimized",
                orderIdsByStopId: {
                    a: ["NEW-A"],
                    c: ["NEW-C-1", "NEW-C-2"],
                },
            },
        },
    });
    const restored = parseBackup(JSON.stringify(backup));

    assert.deepEqual(restored.routes.google.routeIds, ["b", "a"]);
    assert.deepEqual(restored.routes.basic.routeIds, ["c"]);
    assert.deepEqual(restored.routes.pending.routeIds, ["a", "c"]);
    assert.equal(
        restored.routes.google.optimizationStatus,
        "google_optimized",
    );
    assert.equal(
        restored.routes.basic.optimizationStatus,
        "manually_changed",
    );
    assert.deepEqual(restored.routes.google.orderIdsByStopId, {
        a: ["ORDER-A"],
        b: ["ORDER-B"],
    });
    assert.deepEqual(restored.routes.pending.orderIdsByStopId, {
        a: ["NEW-A"],
        c: ["NEW-C-1", "NEW-C-2"],
    });
});

test("legacy Current and Previous backup data migrates without losing either route", () => {
    const legacy = {
        app: "free-map-router",
        backupVersion: 1,
        home: { address: "Home" },
        stops: [
            { id: "a", address: "A" },
            { id: "b", address: "B" },
        ],
        routeIds: ["a"],
        routes: {
            current: {
                routeIds: ["a"],
                optimizationStatus: "google_optimized",
            },
            previous: {
                routeIds: ["b"],
                optimizationStatus: "basic_optimized",
            },
        },
    };

    const restored = parseBackup(JSON.stringify(legacy));
    assert.deepEqual(restored.routes.google.routeIds, ["a"]);
    assert.deepEqual(restored.routes.basic.routeIds, ["b"]);
});

test("unrelated JSON is rejected", () => {
    assert.throws(
        () => parseBackup('{"app":"something-else"}'),
        /not a valid Free Map Router backup/,
    );
});

test("backup filename includes the date", () => {
    assert.equal(
        backupFilename(new Date("2026-07-30T12:00:00Z")),
        "free-map-router-backup-2026-07-30.json",
    );
});
