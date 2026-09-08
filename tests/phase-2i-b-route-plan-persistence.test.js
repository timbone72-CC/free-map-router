"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const RouteHistory = require("../route-history.js");
const Backup = require("../backup.js");
const {
    GoogleRouteBrowserError,
    persistGoogleSchedule,
    readStoredGoogleSchedule,
    storedScheduleIsCurrent,
} = require("../google-route-browser.js");

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

function dayContext() {
    return {
        routeDate: "2026-09-08",
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function googleSchedule(routeIds = ["a", "b"]) {
    return {
        basisKey: "basis-2i-b",
        vehicleStartTime: "2026-09-08T13:00:00Z",
        vehicleEndTime: "2026-09-08T14:00:00Z",
        travelDurationSeconds: 900,
        totalServiceDurationSeconds: 1200,
        waitDurationSeconds: 0,
        visits: routeIds.map((stopId, index) => ({
            stopId,
            startTime: `2026-09-08T13:${String(index * 10 + 10).padStart(2, "0")}:00Z`,
        })),
    };
}

test("route-history v6 migrates to one canonical v7 Route Plan without duplicate top-level route slots", () => {
    const storage = memoryStorage();
    storage.setItem(
        RouteHistory.STORAGE_KEY,
        JSON.stringify({
            version: 6,
            dayContext: dayContext(),
            google: {
                routeIds: ["b", "a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
                optimizationStatus: "google_optimized",
                orderIdsByStopId: {
                    a: ["ORDER-A"],
                    b: ["ORDER-B"],
                },
                schedule: googleSchedule(["b", "a"]),
            },
            basic: {
                routeIds: ["a", "b"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
                optimizationStatus: "basic_optimized",
            },
            pending: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-09-08T13:00:00.000Z",
            },
        }),
    );

    const validIds = new Set(["a", "b"]);
    const migrated = RouteHistory.readRouteHistory(storage, validIds);
    assert.equal(migrated.version, 7);
    assert.deepEqual(migrated.google.routeIds, ["b", "a"]);
    assert.deepEqual(migrated.basic.routeIds, ["a", "b"]);
    assert.equal(migrated.dayContext.routeDate, "2026-09-08");
    assert.equal(migrated.google.schedule.basisKey, "basis-2i-b");
    assert.deepEqual(migrated.pending.routeIds, ["a"]);

    const written = RouteHistory.writeRouteHistory(
        storage,
        migrated,
        validIds,
    );
    const raw = JSON.parse(storage.raw(RouteHistory.STORAGE_KEY));
    assert.deepEqual(Object.keys(raw).sort(), ["activePlan", "pending", "version"]);
    assert.equal(raw.version, 7);
    assert.equal(Object.hasOwn(raw, "google"), false);
    assert.equal(Object.hasOwn(raw, "basic"), false);
    assert.equal(Object.hasOwn(raw, "dayContext"), false);
    assert.equal(written.activePlan.planId, migrated.activePlan.planId);
});

test("compatibility-style one-day mutations preserve stored plan identity, Workday context, and remaining physical stops", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    let history = RouteHistory.writeRouteHistory(
        storage,
        {
            dayContext: dayContext(),
            google: {
                routeIds: ["a", "b"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
                orderIdsByStopId: {
                    a: ["ORDER-A"],
                    b: ["ORDER-B"],
                },
            },
            basic: {
                routeIds: ["b", "a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
            },
        },
        validIds,
    );
    const planId = history.activePlan.planId;
    const revision = history.activePlan.revision;

    const compatibilityMutation = RouteHistory.normalizeRouteHistory(
        {
            version: 7,
            google: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
                orderIdsByStopId: { a: ["ORDER-A"] },
            },
            basic: history.basic,
            pending: null,
        },
        validIds,
    );
    history = RouteHistory.writeRouteHistory(
        storage,
        compatibilityMutation,
        validIds,
    );

    assert.equal(history.activePlan.planId, planId);
    assert.ok(history.activePlan.revision > revision);
    assert.equal(history.dayContext.routeDate, "2026-09-08");
    assert.deepEqual(history.google.routeIds, ["a"]);
    assert.deepEqual(history.basic.routeIds, ["b", "a"]);
    assert.equal(
        history.activePlan.standaloneStops.some((stop) => stop.stopId === "b"),
        true,
    );
});

test("canonical plan writes reject stale revisions", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    const original = RouteHistory.writeRouteHistory(
        storage,
        { google: { routeIds: ["a", "b"] } },
        validIds,
    );
    const stale = original;
    const reordered = RouteHistory.replaceRoute(
        original,
        "google",
        ["b", "a"],
        validIds,
    );
    RouteHistory.writeRouteHistory(storage, reordered, validIds);

    assert.throws(
        () => RouteHistory.writeRouteHistory(storage, stale, validIds),
        /revision conflict/,
    );
});

test("Google schedules are written inside the active Day and stale route order fails closed", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    RouteHistory.writeRouteHistory(
        storage,
        {
            dayContext: dayContext(),
            google: {
                routeIds: ["a", "b"],
                optimizationStatus: "google_optimized",
            },
            basic: { routeIds: ["a", "b"] },
        },
        validIds,
    );

    const saved = RouteHistory.writeGoogleSchedule(
        storage,
        googleSchedule(["a", "b"]),
        "basis-2i-b",
        ["a", "b"],
        validIds,
    );
    assert.equal(saved.basisKey, "basis-2i-b");
    assert.equal(
        RouteHistory.readGoogleSchedule(storage, validIds).basisKey,
        "basis-2i-b",
    );

    const raw = JSON.parse(storage.raw(RouteHistory.STORAGE_KEY));
    const activeDay = raw.activePlan.days.find(
        (day) => day.dayId === raw.activePlan.activeDayId,
    );
    assert.equal(activeDay.google.schedule.basisKey, "basis-2i-b");
    assert.equal(Object.hasOwn(raw, "google"), false);

    assert.throws(
        () =>
            RouteHistory.writeGoogleSchedule(
                storage,
                googleSchedule(["b", "a"]),
                "basis-stale",
                ["b", "a"],
                validIds,
            ),
        /changed while optimization/,
    );
});

test("pending workbook work remains pending and Start New Route creates a fresh one-day plan with no inherited timing", () => {
    const validIds = new Set(["a", "b"]);
    const staged = RouteHistory.stageWorkbookRoute(
        {
            google: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
            },
            dayContext: dayContext(),
        },
        ["b"],
        "2026-09-08T13:00:00.000Z",
        validIds,
        { b: ["ORDER-B"] },
    );
    assert.equal(staged.result, "newer");
    assert.deepEqual(staged.history.google.routeIds, ["a"]);
    assert.deepEqual(staged.history.pending.routeIds, ["b"]);

    const started = RouteHistory.startPendingRoute(staged.history, validIds);
    assert.equal(started.result, "started");
    assert.deepEqual(started.history.google.routeIds, ["b"]);
    assert.deepEqual(started.history.basic.routeIds, ["b"]);
    assert.equal(started.history.dayContext, null);
    assert.equal(started.history.pending, null);
});

test("stop-ID remap preserves exact work identity inside the active plan", () => {
    const original = RouteHistory.normalizeRouteHistory({
        google: {
            routeIds: ["old", "next"],
            orderIdsByStopId: { old: ["ORDER-1"] },
        },
        basic: { routeIds: ["old"] },
    });
    const planId = original.activePlan.planId;

    const remapped = RouteHistory.remapRouteStopIds(
        original,
        { old: "kept" },
        new Set(["kept", "next"]),
    );
    assert.equal(remapped.activePlan.planId, planId);
    assert.deepEqual(remapped.google.routeIds, ["kept", "next"]);
    assert.equal(
        remapped.activePlan.workItems.find(
            (item) => item.workItemId === "ORDER-1",
        ).stopId,
        "kept",
    );
});

test("backup v5 round-trip preserves canonical Route Plan identity and Google schedule", () => {
    const backup = Backup.createBackup({
        home: { address: "Home" },
        stops: [{ id: "a", address: "A" }],
        routes: {
            version: 6,
            dayContext: dayContext(),
            google: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
                orderIdsByStopId: { a: ["ORDER-A"] },
                schedule: googleSchedule(["a"]),
            },
            basic: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
            },
        },
    });

    assert.equal(backup.backupVersion, 5);
    assert.equal(backup.routes.version, 7);
    assert.ok(backup.routes.activePlan);
    assert.equal(Object.hasOwn(backup.routes, "google"), false);

    const restored = Backup.parseBackup(JSON.stringify(backup));
    assert.deepEqual(restored.routes.google.routeIds, ["a"]);
    assert.equal(restored.routes.google.schedule.basisKey, "basis-2i-b");
    assert.equal(
        restored.routes.activePlan.planId,
        backup.routes.activePlan.planId,
    );
});

test("backup v4 restores into one-day v7 without fabricating or losing Workday state", () => {
    const v4 = {
        app: "free-map-router",
        backupVersion: 4,
        home: { address: "Home" },
        stops: [{ id: "a", address: "A" }],
        gigs: [],
        planning: [],
        routeIds: ["a"],
        routes: {
            version: 6,
            dayContext: dayContext(),
            google: {
                routeIds: ["a"],
                sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
                schedule: googleSchedule(["a"]),
            },
            basic: { routeIds: ["a"] },
            pending: null,
        },
    };

    const restored = Backup.parseBackup(JSON.stringify(v4));
    assert.equal(restored.routes.version, 7);
    assert.equal(restored.routes.activePlan.days.length, 1);
    assert.equal(restored.routes.dayContext.routeDate, "2026-09-08");
    assert.equal(restored.routes.google.schedule.basisKey, "basis-2i-b");
});

test("legacy backup v1 remains restorable through the v7 migration", () => {
    const legacy = {
        app: "free-map-router",
        backupVersion: 1,
        home: { address: "Home" },
        stops: [{ id: "a", address: "A" }],
        routeIds: ["a"],
        routes: { current: { routeIds: ["a"] } },
    };

    const restored = Backup.parseBackup(JSON.stringify(legacy));
    assert.deepEqual(restored.routes.google.routeIds, ["a"]);
    assert.deepEqual(restored.routes.basic.routeIds, ["a"]);
    assert.equal(restored.routes.version, 7);
});

test("invalid v5 Day timing fails restore instead of being silently repaired", () => {
    const good = Backup.createBackup({
        home: {},
        stops: [{ id: "a" }],
        routes: { google: { routeIds: ["a"] } },
    });
    const damaged = JSON.parse(JSON.stringify(good));
    const activeDay = damaged.routes.activePlan.days.find(
        (day) => day.dayId === damaged.routes.activePlan.activeDayId,
    );
    activeDay.dayContext = {
        routeDate: "2026-09-08",
        departureTime: "18:00",
        preferredFinishTime: "19:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };

    assert.throws(
        () => Backup.parseBackup(JSON.stringify(damaged)),
        /invalid route timing/,
    );
});

test("Google browser schedule adapter delegates persistence to route-history and never edits raw storage", () => {
    const calls = [];
    const storage = {
        getItem() {
            throw new Error("raw route-history read forbidden");
        },
        setItem() {
            throw new Error("raw route-history write forbidden");
        },
    };
    const routeHistoryContract = {
        writeGoogleSchedule(passedStorage, schedule, basisKey, routeIds) {
            calls.push(["write", passedStorage, schedule, basisKey, routeIds]);
            return { ...schedule, basisKey };
        },
        readGoogleSchedule(passedStorage) {
            calls.push(["read", passedStorage]);
            return { basisKey: "basis-2i-b" };
        },
    };

    const saved = persistGoogleSchedule(
        storage,
        routeHistoryContract,
        googleSchedule(["a"]),
        "basis-2i-b",
        ["a"],
    );
    assert.equal(saved.basisKey, "basis-2i-b");
    assert.equal(
        readStoredGoogleSchedule(storage, routeHistoryContract).basisKey,
        "basis-2i-b",
    );
    assert.equal(
        storedScheduleIsCurrent(storage, routeHistoryContract, "basis-2i-b"),
        true,
    );
    assert.deepEqual(
        calls.map((call) => call[0]),
        ["write", "read", "read"],
    );
});

test("Google browser adapter preserves the existing stale-route error code", () => {
    const routeHistoryContract = {
        writeGoogleSchedule() {
            throw new Error(
                "The Google route changed while optimization was finishing. The new schedule was not saved.",
            );
        },
    };

    assert.throws(
        () =>
            persistGoogleSchedule(
                {},
                routeHistoryContract,
                googleSchedule(["a"]),
                "basis-2i-b",
                ["a"],
            ),
        (error) =>
            error instanceof GoogleRouteBrowserError &&
            error.code === "STALE_ROUTE",
    );
});
