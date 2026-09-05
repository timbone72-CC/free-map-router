"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const routeHistory = require("../route-history.js");
const workdayContext = require("../workday-context.js");
const browser = require("../google-route-browser.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

function fakeElement() {
    const listeners = new Map();
    return {
        value: "",
        textContent: "",
        dataset: {},
        addEventListener(type, listener) {
            listeners.set(type, listener);
        },
        fire(type) {
            return listeners.get(type)?.();
        },
    };
}

function fakeWorkdayDocument() {
    const ids = [
        "workdayControls",
        "routeDate",
        "routeDepartureTime",
        "routePreferredFinishTime",
        "routeHomeByTime",
        "routeDayContextStatus",
    ];
    const elements = new Map(ids.map((id) => [id, fakeElement()]));
    return {
        elements,
        getElementById(id) {
            return elements.get(id) || null;
        },
    };
}

function dayContext() {
    return {
        routeDate: "2026-09-05",
        departureTime: "13:00",
        preferredFinishTime: "18:30",
        homeByTime: "23:00",
        timeZone: "America/Chicago",
    };
}

function routeSnapshot() {
    return {
        version: routeHistory.ROUTE_HISTORY_VERSION,
        dayContext: dayContext(),
        google: {
            routeIds: ["a"],
            sourceUpdatedAt: "2026-09-05T14:46:15.882Z",
            optimizationStatus: "not_optimized",
            orderIdsByStopId: { a: ["ORDER-A"] },
            workbookPayByStopId: {},
            gigIdsByStopId: {},
            gigManagedStopIds: [],
            schedule: null,
        },
        basic: {
            routeIds: ["a"],
            sourceUpdatedAt: "2026-09-05T14:46:15.882Z",
            optimizationStatus: "not_optimized",
            orderIdsByStopId: { a: ["ORDER-A"] },
            workbookPayByStopId: {},
            gigIdsByStopId: {},
            gigManagedStopIds: [],
            schedule: null,
        },
        pending: null,
    };
}

test("clearing Home By turns off the Google deadline without overwriting saved timing", () => {
    const storage = memoryStorage();
    routeHistory.writeRouteHistory(storage, routeSnapshot(), new Set(["a"]));
    const document = fakeWorkdayDocument();

    assert.equal(
        workdayContext.bindWorkdayControls({ document, storage }),
        true,
    );

    const homeBy = document.elements.get("routeHomeByTime");
    assert.equal(homeBy.value, "23:00");
    assert.equal(workdayContext.homeByRestrictionEnabled(document), true);

    homeBy.value = "";
    homeBy.fire("change");

    assert.equal(workdayContext.homeByRestrictionEnabled(document), false);
    assert.equal(routeHistory.readRouteHistory(storage).dayContext.homeByTime, "23:00");
    assert.match(
        document.elements.get("routeDayContextStatus").textContent,
        /Home By limit off for Google Optimize/,
    );

    homeBy.value = "22:30";
    homeBy.fire("change");

    assert.equal(workdayContext.homeByRestrictionEnabled(document), true);
    assert.equal(routeHistory.readRouteHistory(storage).dayContext.homeByTime, "22:30");
});

test("no-limit Google preparation omits the hard timing window but keeps exact route work and service duration", async () => {
    const storage = memoryStorage();
    routeHistory.writeRouteHistory(storage, routeSnapshot(), new Set(["a"]));

    const prepared = await browser.prepareTimeAwareSnapshot(
        {
            async prepareSelectedRouteSnapshot() {
                return {
                    home: {
                        address: "Home",
                        latitude: 35.4,
                        longitude: -99.4,
                        pinStatus: "manual",
                    },
                    stops: [
                        {
                            id: "a",
                            address: "100 Main St, Lawton, OK",
                            latitude: null,
                            longitude: null,
                            pinStatus: "unverified",
                        },
                    ],
                };
            },
        },
        {
            storage,
            enforceHomeBy: false,
            root: {
                localStorage: storage,
                FMRRouteHistory: routeHistory,
                FMRWorkdayContext: workdayContext,
                FMRWorkItemPlanningRuntime: {
                    projectRoute() {
                        return {
                            complete: true,
                            stops: [
                                {
                                    stopId: "a",
                                    serviceMinutes: 5,
                                    items: [
                                        {
                                            kind: "workbook",
                                            workItemId: "ORDER-A",
                                            serviceMinutes: 5,
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                },
            },
        },
    );

    assert.equal(prepared.context.enforceHomeBy, false);
    assert.equal(Object.hasOwn(prepared.snapshot, "timing"), false);
    assert.equal(prepared.snapshot.stops.length, 1);
    assert.equal(prepared.snapshot.stops[0].id, "a");
    assert.equal(prepared.snapshot.stops[0].serviceDurationSeconds, 300);

    const request = browser.buildBrowserRequest(prepared.snapshot, "no-home-by");
    assert.equal(Object.hasOwn(request, "timing"), false);
    assert.equal(request.stops.length, 1);
    assert.equal(request.stops[0].id, "a");
    assert.equal(request.stops[0].serviceDurationSeconds, 300);
});

test("timed and no-limit preparations have different stale-check bases", async () => {
    const timed = {
        snapshot: {
            home: { address: "Home", latitude: 35.4, longitude: -99.4 },
            timing: {
                departureTime: "2026-09-05T18:00:00Z",
                homeByTime: "2026-09-06T04:00:00Z",
            },
            stops: [{ id: "a" }],
        },
        context: { serviceByStopId: { a: 300 } },
    };
    const unlimited = {
        snapshot: {
            home: { address: "Home", latitude: 35.4, longitude: -99.4 },
            stops: [{ id: "a" }],
        },
        context: { serviceByStopId: { a: 300 } },
    };

    assert.notEqual(
        browser.preparedRequestBasisKey(timed),
        browser.preparedRequestBasisKey(unlimited),
    );
    assert.throws(
        () => browser.assertPreparedContextCurrent(timed, unlimited),
        (error) =>
            error instanceof browser.GoogleRouteBrowserError &&
            error.code === "STALE_ROUTE",
    );
});
