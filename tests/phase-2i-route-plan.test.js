const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RoutePlan = require("../route-plan.js");

function schedule(routeIds = ["s1", "s2"]) {
    return {
        basisKey: "basis-1",
        vehicleStartTime: "2026-09-08T13:00:00Z",
        vehicleEndTime: "2026-09-08T14:00:00Z",
        travelDurationSeconds: 1800,
        totalServiceDurationSeconds: 900,
        waitDurationSeconds: 0,
        visits: routeIds.map((stopId, index) => ({
            stopId,
            startTime: `2026-09-08T13:${String(index * 20 + 10).padStart(2, "0")}:00Z`,
        })),
    };
}

function dayContext(date = "2026-09-08") {
    return {
        routeDate: date,
        departureTime: "08:00",
        preferredFinishTime: "15:00",
        homeByTime: "17:00",
        timeZone: "America/Chicago",
    };
}

function routeSnapshot(routeIds, orderIdsByStopId = {}, gigIdsByStopId = {}, extra = {}) {
    return {
        routeIds,
        sourceUpdatedAt: "2026-09-08T12:00:00.000Z",
        optimizationStatus: "not_optimized",
        orderIdsByStopId,
        workbookPayByStopId: {},
        gigIdsByStopId,
        gigManagedStopIds: [],
        schedule: null,
        ...extra,
    };
}

function plan(overrides = {}) {
    return {
        schemaVersion: 1,
        planId: "plan-1",
        revision: 1,
        updatedAt: "2026-09-08T12:00:00.000Z",
        activeDayId: "day-1",
        workItems: [
            { kind: "workbook", workItemId: "O-1", stopId: "s1" },
            { kind: "gig", workItemId: "G-1", stopId: "s2" },
        ],
        standaloneStops: [],
        days: [
            {
                dayId: "day-1",
                revision: 1,
                updatedAt: "2026-09-08T12:00:00.000Z",
                dayContext: dayContext(),
                google: routeSnapshot(["s1", "s2"], { s1: ["O-1"] }, { s2: ["G-1"] }),
                basic: routeSnapshot(["s2", "s1"], { s1: ["O-1"] }, { s2: ["G-1"] }),
            },
        ],
        ...overrides,
    };
}

test("2I-A is a pure dormant domain module with no storage, DOM, network, or recurring runtime behavior", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "route-plan.js"), "utf8");
    for (const forbidden of [
        "localStorage",
        "sessionStorage",
        "document.",
        "fetch(",
        "XMLHttpRequest",
        "MutationObserver",
        "setInterval(",
        "setTimeout(",
        "FMRGoogleDrive",
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }
});

test("one-day migration preserves different Google and Basic orders, metadata, timing, and Google schedule", () => {
    const input = {
        version: 6,
        dayContext: dayContext(),
        google: routeSnapshot(
            ["s2", "s1"],
            { s1: ["O-1"], s2: ["O-2"] },
            {},
            {
                optimizationStatus: "google_optimized",
                workbookPayByStopId: {
                    s1: { expectedPay: 5.25, expectedPayComplete: true },
                    s2: { expectedPay: 7, expectedPayComplete: false },
                },
                schedule: schedule(["s2", "s1"]),
            },
        ),
        basic: routeSnapshot(
            ["s1", "s2"],
            { s1: ["O-1"], s2: ["O-2"] },
            {},
            { optimizationStatus: "basic_optimized" },
        ),
        pending: routeSnapshot(["pending"], { pending: ["P-1"] }),
    };

    const migrated = RoutePlan.migrateOneDayRouteHistory(input);
    assert.equal(migrated.days.length, 1);
    const day = migrated.days[0];
    assert.deepEqual(day.google.routeIds, ["s2", "s1"]);
    assert.deepEqual(day.basic.routeIds, ["s1", "s2"]);
    assert.equal(day.google.optimizationStatus, "google_optimized");
    assert.equal(day.basic.optimizationStatus, "basic_optimized");
    assert.deepEqual(day.dayContext, dayContext());
    assert.deepEqual(day.google.schedule.visits.map((visit) => visit.stopId), ["s2", "s1"]);
    assert.equal(day.basic.schedule, null);
    assert.equal(Object.hasOwn(migrated, "pending"), false);
    assert.deepEqual(input.pending.routeIds, ["pending"]);
});

test("shared physical stop becomes one stop with every exact workbook and gig work identity preserved", () => {
    const migrated = RoutePlan.migrateOneDayRouteHistory({
        version: 6,
        dayContext: dayContext(),
        google: routeSnapshot(
            ["shared"],
            { shared: ["O-1", "O-2"] },
            { shared: ["G-1"] },
        ),
        basic: routeSnapshot(
            ["shared"],
            { shared: ["O-1", "O-2"] },
            { shared: ["G-1"] },
        ),
    });

    assert.deepEqual(migrated.workItems, [
        { kind: "workbook", workItemId: "O-1", stopId: "shared" },
        { kind: "workbook", workItemId: "O-2", stopId: "shared" },
        { kind: "gig", workItemId: "G-1", stopId: "shared" },
    ]);
    assert.deepEqual(migrated.standaloneStops, []);
    assert.deepEqual(migrated.days[0].google.routeIds, ["shared"]);
});

test("the same exact work identity on two physical stops fails closed during migration", () => {
    assert.throws(
        () =>
            RoutePlan.migrateOneDayRouteHistory({
                version: 6,
                dayContext: dayContext(),
                google: routeSnapshot(["a"], { a: ["O-1"] }),
                basic: routeSnapshot(["b"], { b: ["O-1"] }),
            }),
        /more than one physical stop/,
    );
});

test("route-only app stops are retained as standalone plan membership instead of receiving invented work IDs", () => {
    const migrated = RoutePlan.migrateOneDayRouteHistory({
        version: 6,
        dayContext: dayContext("2026-09-09"),
        google: routeSnapshot(["work", "app-only"], { work: ["O-1"] }),
        basic: routeSnapshot(["app-only", "work"], { work: ["O-1"] }),
    });

    assert.deepEqual(migrated.workItems, [
        { kind: "workbook", workItemId: "O-1", stopId: "work" },
    ]);
    assert.deepEqual(migrated.standaloneStops, [
        { stopId: "app-only", assignedDate: "2026-09-09", lockedDay: false },
    ]);
});

test("legacy migration with no day context keeps timing null and uses deterministic identities", () => {
    const input = {
        version: 6,
        dayContext: null,
        google: routeSnapshot(["s1"], { s1: ["O-1"] }, {}, { sourceUpdatedAt: null }),
        basic: routeSnapshot(["s1"], { s1: ["O-1"] }, {}, { sourceUpdatedAt: null }),
    };
    const first = RoutePlan.migrateOneDayRouteHistory(input);
    const second = RoutePlan.migrateOneDayRouteHistory(input);

    assert.equal(first.days[0].dayContext, null);
    assert.equal(first.planId, second.planId);
    assert.equal(first.activeDayId, second.activeDayId);
    assert.equal(first.updatedAt, "1970-01-01T00:00:00.000Z");
});

test("migration and normalization never mutate their supplied route or plan inputs", () => {
    const input = {
        version: 6,
        dayContext: dayContext(),
        google: routeSnapshot(["s1"], { s1: ["O-1"] }),
        basic: routeSnapshot(["s1"], { s1: ["O-1"] }),
    };
    const before = structuredClone(input);
    const migrated = RoutePlan.migrateOneDayRouteHistory(input);
    const planBefore = structuredClone(migrated);
    const normalized = RoutePlan.normalizeRoutePlan(migrated);

    assert.deepEqual(input, before);
    assert.deepEqual(migrated, planBefore);
    assert.notEqual(normalized, migrated);
    assert.notEqual(normalized.days[0], migrated.days[0]);
});

test("normalization rejects duplicate plan identity and a route work item outside the plan pool", () => {
    assert.throws(
        () => RoutePlan.normalizeRoutePlan(plan({ workItems: [
            { kind: "workbook", workItemId: "O-1", stopId: "s1" },
            { kind: "workbook", workItemId: "O-1", stopId: "s1" },
        ] })),
        /duplicated in the Route Plan/,
    );

    const invalid = plan();
    invalid.days[0].google.orderIdsByStopId.s1.push("O-NOT-IN-POOL");
    assert.throws(
        () => RoutePlan.normalizeRoutePlan(invalid),
        /outside the Route Plan pool/,
    );
});

test("one exact work item or physical stop cannot silently belong to two Route Plan Days", () => {
    const secondDay = {
        dayId: "day-2",
        revision: 1,
        updatedAt: "2026-09-08T12:05:00.000Z",
        dayContext: dayContext("2026-09-09"),
        google: routeSnapshot(["s1"], { s1: ["O-1"] }),
        basic: routeSnapshot(["s1"], { s1: ["O-1"] }),
    };
    const invalid = plan({ days: [...plan().days, secondDay] });

    assert.throws(
        () => RoutePlan.normalizeRoutePlan(invalid),
        /(more than one Route Plan Day|Physical stop s1 appears on more than one)/,
    );
});

test("work-item day selection reads existing exact planning assignedDate and leaves unassigned work explicit", () => {
    const current = RoutePlan.normalizeRoutePlan(plan());
    const planning = [
        { kind: "workbook", workItemId: "O-1", assignedDate: "2026-09-08" },
        { kind: "gig", workItemId: "G-1", assignedDate: null },
        { kind: "workbook", workItemId: "NOT-IN-PLAN", assignedDate: "2026-09-08" },
    ];

    assert.deepEqual(
        RoutePlan.planWorkItemsForDate(current, planning, "2026-09-08"),
        [{ kind: "workbook", workItemId: "O-1", stopId: "s1" }],
    );
    assert.deepEqual(RoutePlan.unassignedPlanWorkItems(current, planning), [
        { kind: "gig", workItemId: "G-1", stopId: "s2" },
    ]);
});

test("standalone stop day assignment is explicit plan-owned state because no exact work record owns it", () => {
    const current = RoutePlan.normalizeRoutePlan(plan({
        standaloneStops: [
            { stopId: "manual-stop", assignedDate: "2026-09-09", lockedDay: true },
        ],
    }));

    assert.deepEqual(RoutePlan.standaloneStopsForDate(current, "2026-09-09"), [
        { stopId: "manual-stop", assignedDate: "2026-09-09", lockedDay: true },
    ]);
});

test("Basic Day snapshots cannot retain Google schedule confidence", () => {
    const input = plan();
    input.days[0].basic.schedule = schedule(["s2", "s1"]);
    const normalized = RoutePlan.normalizeRoutePlan(input);
    assert.equal(normalized.days[0].basic.schedule, null);
});

test("invalid standalone calendar dates fail closed instead of becoming plan assignments", () => {
    assert.throws(
        () => RoutePlan.normalizeRoutePlan(plan({
            standaloneStops: [
                { stopId: "manual-stop", assignedDate: "2026-02-31", lockedDay: false },
            ],
        })),
        /valid local YYYY-MM-DD date/,
    );
});

test("damaged Google schedule facts fail closed in the pure Day contract", () => {
    const invalid = plan();
    invalid.days[0].google = routeSnapshot(
        ["s1", "s2"],
        { s1: ["O-1"] },
        { s2: ["G-1"] },
        {
            optimizationStatus: "google_optimized",
            schedule: {
                ...schedule(["s1", "s2"]),
                visits: [
                    { stopId: "s2", startTime: "2026-09-08T13:10:00Z" },
                    { stopId: "s1", startTime: "2026-09-08T13:30:00Z" },
                ],
            },
        },
    );
    assert.throws(
        () => RoutePlan.normalizeRoutePlan(invalid),
        /must match the exact route order/,
    );
});
