const test = require("node:test");
const assert = require("node:assert/strict");

const {
    remapRouteStopIds,
    setGigRouteMembership,
} = require("../route-history.js");

const validIds = new Set(["manual", "shared", "workbook", "next"]);

function gig(id, stopId) {
    return { id, stopId };
}

test("including one manual gig adds its physical stop once to both route versions", () => {
    const next = setGigRouteMembership(
        {
            google: { routeIds: ["next"], optimizationStatus: "google_optimized" },
            basic: { routeIds: ["next"], optimizationStatus: "basic_optimized" },
            pending: null,
        },
        gig("gig_1", "manual"),
        true,
        validIds,
    );

    assert.deepEqual(next.google.routeIds, ["next", "manual"]);
    assert.deepEqual(next.basic.routeIds, ["next", "manual"]);
    assert.deepEqual(next.google.gigIdsByStopId, { manual: ["gig_1"] });
    assert.deepEqual(next.basic.gigIdsByStopId, { manual: ["gig_1"] });
    assert.deepEqual(next.google.gigManagedStopIds, ["manual"]);
    assert.equal(next.google.optimizationStatus, "manually_changed");
    assert.equal(next.basic.optimizationStatus, "manually_changed");
});

test("two included gigs at one property never create two driving stops", () => {
    const one = setGigRouteMembership(
        { google: { routeIds: [] }, basic: { routeIds: [] }, pending: null },
        gig("gig_1", "shared"),
        true,
        validIds,
    );
    const two = setGigRouteMembership(
        one,
        gig("gig_2", "shared"),
        true,
        validIds,
    );

    assert.deepEqual(two.google.routeIds, ["shared"]);
    assert.deepEqual(two.google.gigIdsByStopId.shared, ["gig_1", "gig_2"]);

    const removeOne = setGigRouteMembership(
        two,
        gig("gig_1", "shared"),
        false,
        validIds,
    );
    assert.deepEqual(removeOne.google.routeIds, ["shared"]);
    assert.deepEqual(removeOne.google.gigIdsByStopId.shared, ["gig_2"]);

    const removeLast = setGigRouteMembership(
        removeOne,
        gig("gig_2", "shared"),
        false,
        validIds,
    );
    assert.equal(removeLast.google, null);
    assert.equal(removeLast.basic, null);
});

test("removing a gig does not remove a physical stop that already belonged to the route", () => {
    const attached = setGigRouteMembership(
        {
            google: { routeIds: ["shared"] },
            basic: { routeIds: ["shared"] },
            pending: null,
        },
        gig("gig_1", "shared"),
        true,
        validIds,
    );

    assert.deepEqual(attached.google.gigManagedStopIds, []);
    const removed = setGigRouteMembership(
        attached,
        gig("gig_1", "shared"),
        false,
        validIds,
    );

    assert.deepEqual(removed.google.routeIds, ["shared"]);
    assert.deepEqual(removed.basic.routeIds, ["shared"]);
});

test("workbook Order IDs protect a shared stop when its last manual gig is removed", () => {
    const attached = setGigRouteMembership(
        {
            google: {
                routeIds: ["workbook"],
                orderIdsByStopId: { workbook: ["ORDER-1"] },
            },
            basic: {
                routeIds: ["workbook"],
                orderIdsByStopId: { workbook: ["ORDER-1"] },
            },
            pending: null,
        },
        gig("gig_1", "workbook"),
        true,
        validIds,
    );
    const removed = setGigRouteMembership(
        attached,
        gig("gig_1", "workbook"),
        false,
        validIds,
    );

    assert.deepEqual(removed.google.routeIds, ["workbook"]);
    assert.deepEqual(removed.google.orderIdsByStopId, {
        workbook: ["ORDER-1"],
    });
    assert.deepEqual(removed.google.gigIdsByStopId, {});
});

test("physical-stop remap carries manual gig route metadata to the retained stop", () => {
    const remapped = remapRouteStopIds(
        {
            google: {
                routeIds: ["manual", "shared", "next"],
                gigIdsByStopId: {
                    manual: ["gig_1"],
                    shared: ["gig_2"],
                },
                gigManagedStopIds: ["manual", "shared"],
                optimizationStatus: "google_optimized",
            },
            basic: null,
            pending: null,
        },
        { manual: "shared" },
        validIds,
    );

    assert.deepEqual(remapped.google.routeIds, ["shared", "next"]);
    assert.deepEqual(remapped.google.gigIdsByStopId, {
        shared: ["gig_1", "gig_2"],
    });
    assert.deepEqual(remapped.google.gigManagedStopIds, ["shared"]);
    assert.equal(remapped.google.optimizationStatus, "google_optimized");
});