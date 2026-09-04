"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const routeHistory = require("../route-history.js");
const browser = require("../google-route-browser.js");
const backup = require("../backup.js");

function memoryStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}

function baseHistory() {
    return {
        version: routeHistory.ROUTE_HISTORY_VERSION,
        dayContext: {
            routeDate: "2026-09-05",
            departureTime: "08:00",
            preferredFinishTime: "15:00",
            homeByTime: "17:00",
            timeZone: "America/Chicago",
        },
        google: {
            routeIds: ["a", "b"],
            sourceUpdatedAt: "2026-09-04T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                a: ["order-a"],
                b: ["order-b"],
            },
            workbookPayByStopId: {},
            gigIdsByStopId: {},
            gigManagedStopIds: [],
            schedule: null,
        },
        basic: {
            routeIds: ["a", "b"],
            sourceUpdatedAt: "2026-09-04T12:00:00.000Z",
            optimizationStatus: "not_optimized",
            orderIdsByStopId: {
                a: ["order-a"],
                b: ["order-b"],
            },
            workbookPayByStopId: {},
            gigIdsByStopId: {},
            gigManagedStopIds: [],
            schedule: null,
        },
        pending: null,
    };
}

function routeStops() {
    return [
        { id: "a", address: "100 Main St, Elk City, OK" },
        { id: "b", address: "200 Main St, Elk City, OK" },
        { id: "pending", address: "300 Main St, Elk City, OK" },
    ];
}

function persistedSchedule(storage) {
    const routeIds = ["a", "b"];
    const home = {
        address: "1 Home Rd, Elk City, OK",
        latitude: 35.41,
        longitude: -99.4,
    };
    const serviceByStopId = { a: 300, b: 300 };
    const timing = {
        departureTime: "2026-09-05T13:00:00Z",
        homeByTime: "2026-09-05T22:00:00Z",
    };
    const basisKey = browser.buildScheduleBasisKey({
        routeIds,
        home,
        serviceByStopId,
        timing,
    });

    browser.persistGoogleSchedule(
        storage,
        routeHistory,
        {
            vehicleStartTime: "2026-09-05T13:00:00Z",
            vehicleEndTime: "2026-09-05T15:00:00Z",
            travelDurationSeconds: 6000,
            totalServiceDurationSeconds: 600,
            waitDurationSeconds: 0,
            visits: [
                { stopId: "a", startTime: "2026-09-05T13:30:00Z" },
                { stopId: "b", startTime: "2026-09-05T14:20:00Z" },
            ],
        },
        basisKey,
        routeIds,
    );

    return basisKey;
}

test("ordinary route-history writes preserve an accepted Google schedule and backup keeps it", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b", "pending"]);
    routeHistory.writeRouteHistory(storage, baseHistory(), validIds);
    const basisKey = persistedSchedule(storage);

    const staleCallerHistory = baseHistory();
    const staged = routeHistory.stageWorkbookRoute(
        staleCallerHistory,
        ["pending"],
        "2026-09-04T13:00:00.000Z",
        validIds,
        { pending: ["order-pending"] },
        {},
    );
    assert.equal(staged.result, "newer");

    routeHistory.writeRouteHistory(storage, staged.history, validIds);

    const reread = routeHistory.readRouteHistory(storage, validIds);
    assert.equal(reread.google.schedule.basisKey, basisKey);
    assert.equal(reread.basic.schedule, null);
    assert.deepEqual(reread.pending.routeIds, ["pending"]);

    const previousLocalStorage = globalThis.localStorage;
    globalThis.localStorage = storage;
    try {
        const created = backup.createBackup({
            home: {
                address: "1 Home Rd, Elk City, OK",
                latitude: 35.41,
                longitude: -99.4,
            },
            stops: routeStops(),
            routes: staged.history,
        });
        assert.equal(created.routes.google.schedule.basisKey, basisKey);
        assert.equal(created.routes.basic.schedule, null);
    } finally {
        globalThis.localStorage = previousLocalStorage;
    }
});

test("changing Google route order invalidates the stored schedule without changing Basic", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    routeHistory.writeRouteHistory(storage, baseHistory(), validIds);
    persistedSchedule(storage);

    const current = routeHistory.readRouteHistory(storage, validIds);
    const changed = routeHistory.replaceRoute(
        current,
        "google",
        ["b", "a"],
        validIds,
    );
    routeHistory.writeRouteHistory(storage, changed, validIds);

    const reread = routeHistory.readRouteHistory(storage, validIds);
    assert.deepEqual(reread.google.routeIds, ["b", "a"]);
    assert.equal(reread.google.schedule, null);
    assert.deepEqual(reread.basic.routeIds, ["a", "b"]);
    assert.equal(reread.basic.schedule, null);
});

test("Preferred Finish alone keeps Google schedule but Departure change invalidates it", () => {
    const storage = memoryStorage();
    const validIds = new Set(["a", "b"]);
    routeHistory.writeRouteHistory(storage, baseHistory(), validIds);
    const basisKey = persistedSchedule(storage);

    routeHistory.writeDayContext(
        storage,
        {
            routeDate: "2026-09-05",
            departureTime: "08:00",
            preferredFinishTime: "16:00",
            homeByTime: "17:00",
            timeZone: "America/Chicago",
        },
        validIds,
    );
    assert.equal(
        routeHistory.readRouteHistory(storage, validIds).google.schedule.basisKey,
        basisKey,
    );

    routeHistory.writeDayContext(
        storage,
        {
            routeDate: "2026-09-05",
            departureTime: "08:30",
            preferredFinishTime: "16:00",
            homeByTime: "17:00",
            timeZone: "America/Chicago",
        },
        validIds,
    );
    assert.equal(
        routeHistory.readRouteHistory(storage, validIds).google.schedule,
        null,
    );
});
