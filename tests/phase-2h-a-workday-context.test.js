const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routeHistoryContract = require("../route-history.js");
const {
    ROUTE_HISTORY_VERSION,
    STORAGE_KEY,
    readRouteHistory,
    replaceRoute,
    stageWorkbookRoute,
    startPendingRoute,
    validateDayContext,
    writeDayContext,
    writeRouteHistory,
} = routeHistoryContract;
const { BACKUP_VERSION, createBackup, parseBackup } = require("../backup.js");
const { createPlanningRecord } = require("../work-item-planning.js");
const {
    bindWorkdayControls,
    defaultDayContext,
} = require("../workday-context.js");

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

function dayContext(overrides = {}) {
    return {
        routeDate: "2026-09-04",
        departureTime: "09:40",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
        ...overrides,
    };
}

function namedRoutes() {
    return {
        version: 5,
        google: {
            routeIds: ["a", "b"],
            sourceUpdatedAt: "2026-09-04T13:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: {
                a: ["ORDER-A"],
                b: ["ORDER-B-1", "ORDER-B-2"],
            },
            gigIdsByStopId: {
                b: ["gig_b"],
            },
        },
        basic: {
            routeIds: ["b", "a"],
            sourceUpdatedAt: "2026-09-04T13:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: {
                a: ["ORDER-A"],
                b: ["ORDER-B-1", "ORDER-B-2"],
            },
            gigIdsByStopId: {
                b: ["gig_b"],
            },
        },
        pending: null,
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

test("route-history v5 migrates to v6 without losing route or exact work identity", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(namedRoutes()));

    const restored = readRouteHistory(storage, new Set(["a", "b"]));

    assert.equal(ROUTE_HISTORY_VERSION, 6);
    assert.equal(restored.version, 6);
    assert.equal(restored.dayContext, null);
    assert.deepEqual(restored.google.routeIds, ["a", "b"]);
    assert.deepEqual(restored.basic.routeIds, ["b", "a"]);
    assert.deepEqual(restored.google.orderIdsByStopId, {
        a: ["ORDER-A"],
        b: ["ORDER-B-1", "ORDER-B-2"],
    });
    assert.deepEqual(restored.google.gigIdsByStopId, { b: ["gig_b"] });
    assert.equal(restored.google.optimizationStatus, "google_optimized");
    assert.equal(restored.basic.optimizationStatus, "basic_optimized");
    assert.equal(restored.google.schedule, null);
    assert.equal(restored.basic.schedule, null);
});

test("day context round-trips exact local values and stale route writes preserve the latest timing", () => {
    const storage = memoryStorage();
    const staleHistory = writeRouteHistory(storage, namedRoutes());
    const expected = dayContext();

    writeDayContext(storage, expected);
    const staleRouteEdit = replaceRoute(staleHistory, "google", ["b", "a"]);
    const written = writeRouteHistory(storage, staleRouteEdit);

    assert.deepEqual(written.dayContext, expected);
    assert.deepEqual(written.google.routeIds, ["b", "a"]);
    assert.deepEqual(written.basic.routeIds, ["b", "a"]);
    assert.equal(written.google.optimizationStatus, "google_optimized");
    assert.equal(written.basic.optimizationStatus, "basic_optimized");
});

test("invalid Home By is rejected without overwriting the last valid day context", () => {
    const storage = memoryStorage();
    writeRouteHistory(storage, namedRoutes());
    const valid = dayContext();
    writeDayContext(storage, valid);

    const invalid = dayContext({ homeByTime: "09:40" });
    const validation = validateDayContext(invalid);
    assert.equal(validation.ok, false);
    assert.match(validation.error, /Home by must be later than Departure/);
    assert.throws(() => writeDayContext(storage, invalid), /Home by must be later/);
    assert.deepEqual(readRouteHistory(storage).dayContext, valid);
});

test("a nonexistent DST local time fails closed instead of shifting silently", () => {
    const validation = validateDayContext({
        routeDate: "2026-03-08",
        departureTime: "02:30",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/New_York",
    });

    assert.equal(validation.ok, false);
    assert.match(validation.error, /Departure does not exist/);
});

test("starting a genuinely new workbook route clears old day context and reserved schedule state", () => {
    const storage = memoryStorage();
    let current = writeRouteHistory(storage, namedRoutes());
    current = writeDayContext(storage, dayContext());
    const staged = stageWorkbookRoute(
        current,
        ["c", "d"],
        "2026-09-04T14:00:00.000Z",
        new Set(["a", "b", "c", "d"]),
        {
            c: ["ORDER-C"],
            d: ["ORDER-D"],
        },
    ).history;
    writeRouteHistory(storage, staged, new Set(["a", "b", "c", "d"]));

    const started = startPendingRoute(
        readRouteHistory(storage, new Set(["a", "b", "c", "d"])),
        new Set(["a", "b", "c", "d"]),
    );
    const saved = writeRouteHistory(
        storage,
        started.history,
        new Set(["a", "b", "c", "d"]),
    );

    assert.equal(started.result, "started");
    assert.equal(saved.dayContext, null);
    assert.deepEqual(saved.google.routeIds, ["c", "d"]);
    assert.deepEqual(saved.basic.routeIds, ["c", "d"]);
    assert.deepEqual(saved.google.orderIdsByStopId, {
        c: ["ORDER-C"],
        d: ["ORDER-D"],
    });
    assert.equal(saved.google.schedule, null);
    assert.equal(saved.basic.schedule, null);
});

test("backup v4 preserves day context and Phase 2G planning", () => {
    const planning = [
        createPlanningRecord(
            {
                kind: "workbook",
                workItemId: "ORDER-A",
                serviceMinutes: 12,
                assignedDate: "2026-09-04",
                lockedDay: true,
            },
            { now: "2026-09-04T12:00:00.000Z" },
        ),
    ];
    const routes = {
        ...namedRoutes(),
        dayContext: dayContext(),
    };
    const backup = createBackup({
        home: { id: "home", address: "Home" },
        stops: [
            { id: "a", address: "A" },
            { id: "b", address: "B" },
        ],
        routes,
        planning,
    });
    const restored = parseBackup(JSON.stringify(backup));

    assert.equal(BACKUP_VERSION, 4);
    assert.equal(backup.backupVersion, 4);
    assert.deepEqual(backup.routes.dayContext, dayContext());
    assert.deepEqual(restored.routes.dayContext, dayContext());
    assert.equal(restored.planning.length, 1);
    assert.equal(restored.planning[0].workItemId, "ORDER-A");
    assert.equal(restored.planning[0].serviceMinutes, 12);
    assert.equal(restored.planning[0].lockedDay, true);
});

test("backup v1, v2, and v3 restore with no invented day context", () => {
    const planningRecord = createPlanningRecord(
        {
            kind: "workbook",
            workItemId: "ORDER-A",
            serviceMinutes: 9,
        },
        { now: "2026-09-04T12:00:00.000Z" },
    );

    for (const backupVersion of [1, 2, 3]) {
        const legacy = {
            app: "free-map-router",
            backupVersion,
            home: { address: "Home" },
            stops: [{ id: "a", address: "A" }],
            routeIds: ["a"],
            gigs: [],
            planning: backupVersion === 3 ? [planningRecord] : [],
            routes: {
                version: 5,
                google: { routeIds: ["a"] },
                basic: { routeIds: ["a"] },
                pending: null,
            },
        };

        const restored = parseBackup(JSON.stringify(legacy));
        assert.equal(restored.routes.dayContext, null, `backup v${backupVersion}`);
        assert.equal(
            restored.planning.length,
            backupVersion === 3 ? 1 : 0,
            `planning in backup v${backupVersion}`,
        );

        const storage = memoryStorage();
        writeRouteHistory(storage, {
            ...namedRoutes(),
            dayContext: dayContext(),
        });
        const applied = writeRouteHistory(storage, restored.routes);
        assert.equal(applied.dayContext, null, `restore replacement for v${backupVersion}`);
    }
});

test("backup v4 with invalid route timing is rejected", () => {
    const backup = createBackup({
        home: { address: "Home" },
        stops: [{ id: "a", address: "A" }],
        routes: {
            google: { routeIds: ["a"] },
            basic: { routeIds: ["a"] },
            dayContext: dayContext(),
        },
    });
    backup.routes.dayContext.homeByTime = "08:00";

    assert.throws(
        () => parseBackup(JSON.stringify(backup)),
        /invalid route timing: Home by must be later than Departure/,
    );
});

test("default controls use local route date, current departure, 3 PM preference, and 5 PM Home By", () => {
    const defaults = defaultDayContext(
        new Date("2026-09-04T14:40:00.000Z"),
        "America/Chicago",
    );

    assert.deepEqual(defaults, {
        routeDate: "2026-09-04",
        departureTime: "09:40",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    });
});

test("editing workday controls saves timing without changing route order or optimizer status", () => {
    const storage = memoryStorage();
    writeRouteHistory(storage, {
        ...namedRoutes(),
        dayContext: dayContext(),
    });
    const document = fakeWorkdayDocument();

    assert.equal(
        bindWorkdayControls({
            document,
            storage,
            now: () => new Date("2026-09-04T14:40:00.000Z"),
        }),
        true,
    );

    const departure = document.elements.get("routeDepartureTime");
    departure.value = "10:15";
    departure.fire("change");

    const saved = readRouteHistory(storage);
    assert.equal(saved.dayContext.departureTime, "10:15");
    assert.deepEqual(saved.google.routeIds, ["a", "b"]);
    assert.deepEqual(saved.basic.routeIds, ["b", "a"]);
    assert.equal(saved.google.optimizationStatus, "google_optimized");
    assert.equal(saved.basic.optimizationStatus, "basic_optimized");

    const homeBy = document.elements.get("routeHomeByTime");
    homeBy.value = "09:00";
    homeBy.fire("change");
    assert.equal(readRouteHistory(storage).dayContext.homeByTime, "17:00");
    assert.match(
        document.elements.get("routeDayContextStatus").textContent,
        /Home by must be later than Departure/,
    );
});

test("Build Route contains exactly the four Phase 2H-A controls before app.js", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

    for (const id of [
        "routeDate",
        "routeDepartureTime",
        "routePreferredFinishTime",
        "routeHomeByTime",
    ]) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /id="routeDayContextStatus"/);
    assert.match(html, /route-history\.js\?v=6\.0\.0/);
    assert.match(html, /workday-context\.js\?v=1\.0\.0/);
    assert.match(html, /backup\.js\?v=4\.0\.0/);
    assert.ok(
        html.indexOf("workday-context.js?v=1.0.0") <
            html.indexOf("app.js?v=3.32.0"),
    );
});
