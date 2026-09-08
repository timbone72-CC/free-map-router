const test = require("node:test");
const assert = require("node:assert/strict");

const {
    buildPlannerModel,
    copiedCurrentSchedule,
} = require("../planner-model.js");

function fixture(overrides = {}) {
    const routeSnapshot = {
        routeIds: ["stop-a", "stop-b"],
        optimizationStatus: "google_optimized",
        orderIdsByStopId: {
            "stop-a": ["ORD-1", "ORD-2"],
        },
        gigIdsByStopId: {
            "stop-b": ["GIG-1"],
        },
        schedule: {
            basisKey: "basis-1",
            vehicleStartTime: "2026-09-08T13:00:00Z",
            vehicleEndTime: "2026-09-08T14:10:00Z",
            travelDurationSeconds: 3300,
            totalServiceDurationSeconds: 900,
            waitDurationSeconds: 0,
            visits: [
                { stopId: "stop-a", startTime: "2026-09-08T13:10:00Z" },
                { stopId: "stop-b", startTime: "2026-09-08T13:40:00Z" },
            ],
        },
    };
    const routePlanningProjection = {
        routeStopCount: 2,
        workItemCount: 3,
        serviceMinutes: 15,
        knownServiceMinutes: 15,
        complete: true,
        stops: [
            {
                stopId: "stop-a",
                workItemCount: 2,
                serviceMinutes: 10,
                knownServiceMinutes: 10,
                complete: true,
                items: [
                    {
                        kind: "workbook",
                        workItemId: "ORD-1",
                        serviceMinutes: 5,
                        serviceMinutesOverride: null,
                        assignedDate: null,
                        lockedDay: false,
                        planningRevision: null,
                        planningUpdatedAt: null,
                    },
                    {
                        kind: "workbook",
                        workItemId: "ORD-2",
                        serviceMinutes: 5,
                        serviceMinutesOverride: null,
                        assignedDate: "2026-09-08",
                        lockedDay: true,
                        planningRevision: 2,
                        planningUpdatedAt: "2026-09-07T10:00:00Z",
                    },
                ],
            },
            {
                stopId: "stop-b",
                workItemCount: 1,
                serviceMinutes: 5,
                knownServiceMinutes: 5,
                complete: true,
                items: [
                    {
                        kind: "gig",
                        workItemId: "GIG-1",
                        serviceMinutes: 5,
                        serviceMinutesOverride: 5,
                        assignedDate: null,
                        lockedDay: false,
                        planningRevision: 1,
                        planningUpdatedAt: "2026-09-07T11:00:00Z",
                    },
                ],
            },
        ],
    };
    return {
        routeSlot: "google",
        routeSnapshot,
        routePlanningProjection,
        savedStops: [
            {
                id: "stop-a",
                address: "101 Main St",
                source: "GIS",
                latitude: 35.5,
                longitude: -98.5,
            },
            {
                id: "stop-b",
                address: "202 Oak St",
                label: "HNP",
                latitude: null,
                longitude: null,
            },
        ],
        workItemDetails: {
            "gig:GIG-1": {
                source: "HNP",
                workOrderId: "HNP-77",
                expectedPay: 25,
                dueDate: "2026-09-10",
            },
        },
        paySummary: {
            inspectorAdeExpectedPay: 30,
            manualGigExpectedPay: 25,
            totalKnownExpectedPay: 55,
            payIncomplete: false,
            hasRepresentedWork: true,
        },
        dayContext: {
            routeDate: "2026-09-08",
            departureTime: "08:00",
            preferredFinishTime: "09:00",
            homeByTime: "10:00",
            timeZone: "America/Chicago",
        },
        currentScheduleBasisKey: "basis-1",
        ...overrides,
    };
}

test("shared physical stop yields one card with two exact work rows", () => {
    const model = buildPlannerModel(fixture());
    assert.equal(model.stopCards.length, 2);
    assert.equal(model.stopCards[0].stopId, "stop-a");
    assert.equal(model.stopCards[0].workItemCount, 2);
    assert.deepEqual(
        model.stopCards[0].workItems.map((item) => [item.kind, item.workItemId]),
        [
            ["workbook", "ORD-1"],
            ["workbook", "ORD-2"],
        ],
    );
    assert.equal(model.stopCards[0].source, "GIS");
});

test("day summary counts exact work separately from physical stops", () => {
    const model = buildPlannerModel(fixture());
    assert.equal(model.daySummary.workItemCount, 3);
    assert.equal(model.daySummary.physicalStopCount, 2);
});

test("missing represented pay is incomplete instead of a false complete zero", () => {
    const model = buildPlannerModel(
        fixture({
            paySummary: {
                totalKnownExpectedPay: 30,
                payIncomplete: true,
                hasRepresentedWork: true,
            },
        }),
    );
    assert.equal(model.daySummary.expectedPayKnown, 30);
    assert.equal(model.daySummary.payComplete, false);
    assert.equal(model.daySummary.payIncomplete, true);
});

test("unknown manual service duration remains incomplete instead of zero", () => {
    const input = fixture();
    input.routePlanningProjection = structuredClone(input.routePlanningProjection);
    const gigStop = input.routePlanningProjection.stops[1];
    gigStop.items[0].serviceMinutes = null;
    gigStop.serviceMinutes = null;
    gigStop.knownServiceMinutes = 0;
    gigStop.complete = false;
    input.routePlanningProjection.serviceMinutes = null;
    input.routePlanningProjection.knownServiceMinutes = 10;
    input.routePlanningProjection.complete = false;

    const model = buildPlannerModel(input);
    assert.equal(model.stopCards[1].serviceMinutes, null);
    assert.equal(model.stopCards[1].knownServiceMinutes, 0);
    assert.equal(model.stopCards[1].serviceComplete, false);
    assert.equal(model.daySummary.serviceMinutes, null);
    assert.equal(model.daySummary.knownServiceMinutes, 10);
    assert.equal(model.daySummary.serviceComplete, false);
    assert.equal(model.daySummary.travelDurationSeconds, null);
});

test("current Google schedule supplies ETA, travel, field finish and Home facts", () => {
    const model = buildPlannerModel(fixture());
    assert.equal(model.timingConfidence.status, "google_current");
    assert.equal(model.stopCards[0].etaTime, "2026-09-08T13:10:00Z");
    assert.equal(model.stopCards[1].etaTime, "2026-09-08T13:40:00Z");
    assert.equal(model.daySummary.travelDurationSeconds, 3300);
    assert.equal(model.daySummary.fieldWorkFinishTime, "2026-09-08T13:45:00.000Z");
    assert.equal(model.daySummary.homeTime, "2026-09-08T14:10:00Z");
    assert.equal(model.daySummary.preferredFinishStatus, "met");
    assert.equal(model.daySummary.homeByStatus, "met");
});

test("stale schedule basis is not exposed as current timing", () => {
    const model = buildPlannerModel(
        fixture({ currentScheduleBasisKey: "new-basis" }),
    );
    assert.equal(model.timingConfidence.status, "google_unavailable");
    assert.equal(model.timingConfidence.scheduleCurrent, false);
    assert.equal(model.stopCards[0].etaTime, null);
    assert.equal(model.daySummary.travelDurationSeconds, null);
    assert.equal(model.daySummary.homeTime, null);
});

test("Basic Route never receives Google timing confidence", () => {
    const input = fixture({ routeSlot: "basic" });
    input.routeSnapshot = structuredClone(input.routeSnapshot);
    input.routeSnapshot.optimizationStatus = "basic_optimized";
    const model = buildPlannerModel(input);
    assert.equal(model.timingConfidence.status, "basic_unavailable");
    assert.equal(model.timingConfidence.trafficAware, false);
    assert.equal(model.stopCards[0].etaTime, null);
    assert.equal(model.daySummary.travelDurationSeconds, null);
});

test("unplottable stops remain full cards and are counted without identity loss", () => {
    const model = buildPlannerModel(fixture());
    assert.deepEqual(model.mapPlottableStopIds, ["stop-a"]);
    assert.deepEqual(model.unplottableStopIds, ["stop-b"]);
    assert.equal(model.daySummary.unplottableStopCount, 1);
    assert.equal(model.stopCards[1].stopId, "stop-b");
    assert.equal(model.stopCards[1].workItems[0].workItemId, "GIG-1");
});

test("planner derivation does not mutate supplied inputs", () => {
    const input = fixture();
    const before = structuredClone(input);
    buildPlannerModel(input);
    assert.deepEqual(input, before);
});

test("schedule service total must agree with derived route service", () => {
    const input = fixture();
    input.routeSnapshot = structuredClone(input.routeSnapshot);
    input.routeSnapshot.schedule.totalServiceDurationSeconds = 1200;
    assert.equal(
        copiedCurrentSchedule(
            input.routeSlot,
            input.routeSnapshot,
            input.currentScheduleBasisKey,
        )?.totalServiceDurationSeconds,
        1200,
    );
    const model = buildPlannerModel(input);
    assert.equal(model.timingConfidence.status, "google_unavailable");
    assert.equal(model.daySummary.travelDurationSeconds, null);
});
