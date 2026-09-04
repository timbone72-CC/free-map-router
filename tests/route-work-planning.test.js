const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createPlanningRecord,
} = require("../work-item-planning.js");
const {
    buildRoutePlanningProjection,
    routeWorkItemRefs,
} = require("../route-work-planning.js");

test("route projection preserves stop order and exact workbook work identities", () => {
    const snapshot = {
        routeIds: ["stop_b", "stop_a"],
        orderIdsByStopId: {
            stop_a: ["ORDER-A"],
            stop_b: ["ORDER-B1", "ORDER-B2"],
        },
    };

    const projection = buildRoutePlanningProjection(snapshot, []);

    assert.deepEqual(projection.stops.map((stop) => stop.stopId), [
        "stop_b",
        "stop_a",
    ]);
    assert.deepEqual(
        projection.stops[0].items.map((item) => `${item.kind}:${item.workItemId}`),
        ["workbook:ORDER-B1", "workbook:ORDER-B2"],
    );
    assert.equal(projection.stops[0].serviceMinutes, 10);
    assert.equal(projection.stops[1].serviceMinutes, 5);
    assert.equal(projection.serviceMinutes, 15);
    assert.equal(projection.complete, true);
});

test("planning metadata stays attached to the exact work item rather than the stop", () => {
    const plan = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-2",
        serviceMinutes: 18,
        assignedDate: "2026-09-04",
        lockedDay: true,
    }, { now: "2026-09-03T20:00:00.000Z" });

    const projection = buildRoutePlanningProjection({
        routeIds: ["shared_stop"],
        orderIdsByStopId: {
            shared_stop: ["ORDER-1", "ORDER-2"],
        },
    }, [plan]);

    const [first, second] = projection.stops[0].items;
    assert.equal(first.workItemId, "ORDER-1");
    assert.equal(first.serviceMinutes, 5);
    assert.equal(first.serviceMinutesOverride, null);
    assert.equal(first.assignedDate, null);
    assert.equal(first.lockedDay, false);

    assert.equal(second.workItemId, "ORDER-2");
    assert.equal(second.serviceMinutes, 18);
    assert.equal(second.serviceMinutesOverride, 18);
    assert.equal(second.assignedDate, "2026-09-04");
    assert.equal(second.lockedDay, true);
    assert.equal(second.planningRevision, 1);
    assert.equal(second.planningUpdatedAt, "2026-09-03T20:00:00.000Z");
});

test("workbook and gig IDs with the same text remain different exact identities", () => {
    const projection = buildRoutePlanningProjection({
        routeIds: ["stop_1"],
        orderIdsByStopId: { stop_1: ["123"] },
        gigIdsByStopId: { stop_1: ["123"] },
    }, [
        createPlanningRecord({
            kind: "gig",
            workItemId: "123",
            serviceMinutes: 12,
        }, { now: "2026-09-03T20:00:00.000Z" }),
    ]);

    assert.deepEqual(
        projection.stops[0].items.map((item) => `${item.kind}:${item.workItemId}`),
        ["workbook:123", "gig:123"],
    );
    assert.equal(projection.stops[0].serviceMinutes, 17);
});

test("verified interior duration is used only through the governed resolver", () => {
    const projection = buildRoutePlanningProjection({
        routeIds: ["stop_1"],
        orderIdsByStopId: {
            stop_1: ["ORDER-OUTSIDE", "ORDER-INTERIOR"],
        },
    }, [], {
        isVerifiedInteriorWorkbookItem(workItemId) {
            return workItemId === "ORDER-INTERIOR";
        },
    });

    assert.deepEqual(
        projection.stops[0].items.map((item) => item.serviceMinutes),
        [5, 20],
    );
    assert.equal(projection.stops[0].serviceMinutes, 25);
    assert.equal(projection.serviceMinutes, 25);
});

test("manual gig without an exact duration keeps the stop and route timing incomplete", () => {
    const projection = buildRoutePlanningProjection({
        routeIds: ["stop_1", "stop_2"],
        orderIdsByStopId: { stop_1: ["ORDER-1"] },
        gigIdsByStopId: { stop_1: ["gig_unknown"] },
    }, []);

    assert.equal(projection.stops[0].workItemCount, 2);
    assert.equal(projection.stops[0].knownServiceMinutes, 5);
    assert.equal(projection.stops[0].serviceMinutes, null);
    assert.equal(projection.stops[0].complete, false);
    assert.equal(projection.stops[1].workItemCount, 0);
    assert.equal(projection.stops[1].serviceMinutes, 0);
    assert.equal(projection.knownServiceMinutes, 5);
    assert.equal(projection.serviceMinutes, null);
    assert.equal(projection.complete, false);
});

test("planning records not present in the route snapshot are ignored", () => {
    const unused = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-NOT-ROUTED",
        serviceMinutes: 99,
        assignedDate: "2026-09-05",
        lockedDay: true,
    }, { now: "2026-09-03T20:00:00.000Z" });

    const projection = buildRoutePlanningProjection({
        routeIds: ["stop_1"],
        orderIdsByStopId: { stop_1: ["ORDER-1"] },
    }, [unused]);

    assert.equal(projection.workItemCount, 1);
    assert.equal(projection.serviceMinutes, 5);
    assert.equal(projection.stops[0].items[0].workItemId, "ORDER-1");
});

test("same exact work identity on two physical stops fails closed", () => {
    const snapshot = {
        routeIds: ["stop_1", "stop_2"],
        orderIdsByStopId: {
            stop_1: ["ORDER-1"],
            stop_2: ["ORDER-1"],
        },
    };

    assert.throws(
        () => routeWorkItemRefs(snapshot),
        /attached to more than one route stop/,
    );
    assert.throws(
        () => buildRoutePlanningProjection(snapshot, []),
        /attached to more than one route stop/,
    );
});

test("route projection does not mutate the saved route snapshot or planning records", () => {
    const snapshot = {
        routeIds: ["stop_1", "stop_1", ""],
        orderIdsByStopId: {
            stop_1: ["ORDER-1", "ORDER-1"],
        },
    };
    const plan = createPlanningRecord({
        kind: "workbook",
        workItemId: "ORDER-1",
        serviceMinutes: 8,
    }, { now: "2026-09-03T20:00:00.000Z" });
    const snapshotBefore = JSON.stringify(snapshot);
    const planningBefore = JSON.stringify([plan]);

    const projection = buildRoutePlanningProjection(snapshot, [plan]);

    assert.equal(projection.routeStopCount, 1);
    assert.equal(projection.workItemCount, 1);
    assert.equal(JSON.stringify(snapshot), snapshotBefore);
    assert.equal(JSON.stringify([plan]), planningBefore);
});
