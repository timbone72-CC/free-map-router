"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const routeHistory = require("../route-history.js");
const routeWorkPlanning = require("../route-work-planning.js");
const workItemPlanning = require("../work-item-planning.js");
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
            routeDate: "2026-09-10",
            departureTime: "08:00",
            preferredFinishTime: "15:00",
            homeByTime: "17:00",
            timeZone: "America/Chicago",
        },
        google: {
            routeIds: ["shared", "plain"],
            sourceUpdatedAt: "2026-09-04T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                shared: ["order-1"],
                plain: ["order-2"],
            },
            workbookPayByStopId: {},
            gigIdsByStopId: {
                shared: ["gig-1"],
            },
            gigManagedStopIds: [],
            schedule: null,
        },
        basic: {
            routeIds: ["shared", "plain"],
            sourceUpdatedAt: "2026-09-04T12:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: {
                shared: ["order-1"],
                plain: ["order-2"],
            },
            workbookPayByStopId: {},
            gigIdsByStopId: {
                shared: ["gig-1"],
            },
            gigManagedStopIds: [],
            schedule: null,
        },
        pending: null,
    };
}

function routeStops() {
    return [
        {
            id: "shared",
            address: "100 Main St, Elk City, OK",
            latitude: 35.4,
            longitude: -99.4,
            pinStatus: "manual",
        },
        {
            id: "plain",
            address: "200 Main St, Elk City, OK",
            latitude: null,
            longitude: null,
            pinStatus: "unverified",
        },
    ];
}

function planningRuntime(records) {
    return {
        projectRoute(snapshot) {
            return routeWorkPlanning.buildRoutePlanningProjection(
                snapshot,
                records,
            );
        },
    };
}

function workdayContext() {
    return {
        displayContext() {
            return {
                saved: false,
                context: {
                    routeDate: "2026-09-10",
                    departureTime: "08:00",
                    preferredFinishTime: "15:00",
                    homeByTime: "17:00",
                    timeZone: "America/Chicago",
                },
            };
        },
    };
}

function bridge() {
    return {
        async prepareSelectedRouteSnapshot() {
            return {
                home: {
                    address: "1 Home Rd, Elk City, OK",
                    latitude: 35.41,
                    longitude: -99.4,
                    pinStatus: "manual",
                },
                stops: routeStops(),
            };
        },
    };
}

function knownPlanningRecords() {
    return [
        workItemPlanning.createPlanningRecord(
            {
                kind: "gig",
                workItemId: "gig-1",
                serviceMinutes: 10,
                assignedDate: null,
                lockedDay: false,
            },
            { now: "2026-09-04T12:00:00.000Z" },
        ),
    ];
}

test("saved Chicago workday resolves to whole-second future route instants", () => {
    assert.equal(
        browser.resolveLocalRouteInstant(
            "2026-09-10",
            "08:00",
            "America/Chicago",
        ),
        "2026-09-10T13:00:00Z",
    );
    assert.equal(
        browser.resolveLocalRouteInstant(
            "2026-09-10",
            "17:00",
            "America/Chicago",
        ),
        "2026-09-10T22:00:00Z",
    );
});

test("nonexistent DST local time fails visibly instead of shifting", () => {
    assert.throws(
        () =>
            browser.resolveLocalRouteInstant(
                "2026-03-08",
                "02:30",
                "America/Chicago",
            ),
        (error) =>
            error instanceof browser.GoogleRouteBrowserError &&
            error.code === "INVALID_ROUTE_TIME",
    );
});

test("time-aware preparation aggregates two exact work items into one physical stop service duration", async () => {
    const storage = memoryStorage();
    routeHistory.writeRouteHistory(
        storage,
        baseHistory(),
        new Set(["shared", "plain"]),
    );

    const prepared = await browser.prepareTimeAwareSnapshot(bridge(), {
        storage,
        root: {
            localStorage: storage,
            FMRRouteHistory: routeHistory,
            FMRWorkItemPlanningRuntime: planningRuntime(knownPlanningRecords()),
            FMRWorkdayContext: workdayContext(),
        },
    });

    assert.deepEqual(prepared.snapshot.timing, {
        departureTime: "2026-09-10T13:00:00Z",
        homeByTime: "2026-09-10T22:00:00Z",
    });
    assert.equal(prepared.snapshot.stops[0].serviceDurationSeconds, 900);
    assert.equal(prepared.snapshot.stops[1].serviceDurationSeconds, 300);
    assert.equal(prepared.context.serviceByStopId.shared, 900);
    assert.equal(prepared.context.serviceByStopId.plain, 300);
});

test("unknown routed manual gig duration blocks before a Google network request can be built", async () => {
    const storage = memoryStorage();
    routeHistory.writeRouteHistory(
        storage,
        baseHistory(),
        new Set(["shared", "plain"]),
    );

    await assert.rejects(
        browser.prepareTimeAwareSnapshot(bridge(), {
            storage,
            root: {
                localStorage: storage,
                FMRRouteHistory: routeHistory,
                FMRWorkItemPlanningRuntime: planningRuntime([]),
                FMRWorkdayContext: workdayContext(),
            },
        }),
        (error) =>
            error instanceof browser.GoogleRouteBrowserError &&
            error.code === "MISSING_SERVICE_DURATION" &&
            error.message.includes("Gig gig-1"),
    );
});

test("browser request carries timing and service seconds for manual pins and written addresses", () => {
    const request = browser.buildBrowserRequest(
        {
            home: {
                latitude: 35.41,
                longitude: -99.4,
            },
            timing: {
                departureTime: "2026-09-10T13:00:00Z",
                homeByTime: "2026-09-10T22:00:00Z",
            },
            stops: [
                {
                    id: "manual",
                    address: "100 Main St",
                    latitude: 35.4,
                    longitude: -99.4,
                    pinStatus: "manual",
                    serviceDurationSeconds: 900,
                },
                {
                    id: "address",
                    address: "200 Main St",
                    pinStatus: "unverified",
                    serviceDurationSeconds: 300,
                },
            ],
        },
        "b2-request",
    );

    assert.deepEqual(request.timing, {
        departureTime: "2026-09-10T13:00:00Z",
        homeByTime: "2026-09-10T22:00:00Z",
    });
    assert.deepEqual(request.stops, [
        {
            id: "manual",
            latitude: 35.4,
            longitude: -99.4,
            serviceDurationSeconds: 900,
        },
        {
            id: "address",
            address: "200 Main St",
            serviceDurationSeconds: 300,
        },
    ]);
});

test("schedule persistence writes only Google schedule and basis changes make confidence stale", () => {
    const storage = memoryStorage();
    routeHistory.writeRouteHistory(
        storage,
        baseHistory(),
        new Set(["shared", "plain"]),
    );
    const serviceByStopId = { shared: 900, plain: 300 };
    const timing = {
        departureTime: "2026-09-10T13:00:00Z",
        homeByTime: "2026-09-10T22:00:00Z",
    };
    const home = {
        address: "1 Home Rd, Elk City, OK",
        latitude: 35.41,
        longitude: -99.4,
    };
    const routeIds = ["shared", "plain"];
    const basisKey = browser.buildScheduleBasisKey({
        routeIds,
        home,
        serviceByStopId,
        timing,
    });
    const schedule = {
        vehicleStartTime: "2026-09-10T13:00:00Z",
        vehicleEndTime: "2026-09-10T16:30:00Z",
        travelDurationSeconds: 7200,
        totalServiceDurationSeconds: 1200,
        waitDurationSeconds: 0,
        visits: [
            { stopId: "shared", startTime: "2026-09-10T14:00:00Z" },
            { stopId: "plain", startTime: "2026-09-10T15:30:00Z" },
        ],
    };

    browser.persistGoogleSchedule(
        storage,
        routeHistory,
        schedule,
        basisKey,
        routeIds,
    );

    const raw = JSON.parse(storage.getItem(routeHistory.STORAGE_KEY));
    assert.equal(raw.google.schedule.basisKey, basisKey);
    assert.equal(raw.basic.schedule, null);
    assert.equal(
        browser.storedScheduleIsCurrent(storage, routeHistory, basisKey),
        true,
    );

    const changedServiceBasis = browser.buildScheduleBasisKey({
        routeIds,
        home,
        serviceByStopId: { shared: 960, plain: 300 },
        timing,
    });
    assert.equal(
        browser.storedScheduleIsCurrent(
            storage,
            routeHistory,
            changedServiceBasis,
        ),
        false,
    );
});

test("backup v4 preserves and restores the validated Google schedule field", () => {
    const storage = memoryStorage();
    const stops = routeStops();
    const history = baseHistory();
    routeHistory.writeRouteHistory(
        storage,
        history,
        new Set(["shared", "plain"]),
    );

    const basisKey = browser.buildScheduleBasisKey({
        routeIds: ["shared", "plain"],
        home: {
            address: "1 Home Rd, Elk City, OK",
            latitude: 35.41,
            longitude: -99.4,
        },
        serviceByStopId: { shared: 900, plain: 300 },
        timing: {
            departureTime: "2026-09-10T13:00:00Z",
            homeByTime: "2026-09-10T22:00:00Z",
        },
    });
    browser.persistGoogleSchedule(
        storage,
        routeHistory,
        {
            vehicleStartTime: "2026-09-10T13:00:00Z",
            vehicleEndTime: "2026-09-10T16:30:00Z",
            travelDurationSeconds: 7200,
            totalServiceDurationSeconds: 1200,
            waitDurationSeconds: 0,
            visits: [
                { stopId: "shared", startTime: "2026-09-10T14:00:00Z" },
                { stopId: "plain", startTime: "2026-09-10T15:30:00Z" },
            ],
        },
        basisKey,
        ["shared", "plain"],
    );

    const priorStorage = globalThis.localStorage;
    globalThis.localStorage = storage;
    try {
        const created = backup.createBackup({
            home: {
                address: "1 Home Rd, Elk City, OK",
                latitude: 35.41,
                longitude: -99.4,
            },
            stops,
            planning: knownPlanningRecords(),
            routes: history,
        });
        assert.equal(created.backupVersion, 4);
        assert.equal(created.routes.google.schedule.basisKey, basisKey);
        assert.equal(created.routes.basic.schedule, null);

        backup.parseBackup(JSON.stringify(created));
        const restored = backup.takeParsedGoogleScheduleForRestore();
        assert.deepEqual(restored.routeIds, ["shared", "plain"]);
        assert.equal(restored.schedule.basisKey, basisKey);
    } finally {
        globalThis.localStorage = priorStorage;
    }
});

test("Preferred Finish is soft: accepted schedule reports overrun while Home remains valid", () => {
    const message = browser.formatScheduleOutcome(
        {
            orderedStopIds: ["shared", "plain"],
            schedule: {
                vehicleEndTime: "2026-09-10T21:00:00Z",
                visits: [
                    { stopId: "shared", startTime: "2026-09-10T18:00:00Z" },
                    { stopId: "plain", startTime: "2026-09-10T20:20:00Z" },
                ],
            },
        },
        {
            dayContext: { timeZone: "America/Chicago" },
            preferredFinishTime: "2026-09-10T20:00:00Z",
            serviceByStopId: { shared: 900, plain: 300 },
        },
    );

    assert.match(message, /Field work finishes about 3:25 PM/);
    assert.match(message, /Home about 4:00 PM/);
    assert.match(message, /Preferred finish exceeded by 25 min/);
});
