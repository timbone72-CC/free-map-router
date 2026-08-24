const test = require("node:test");
const assert = require("node:assert/strict");

const { createGig } = require("../gig-contract.js");
const { setGigRouteMembership } = require("../route-history.js");
const {
    advanceTemplateDue,
    normalizeLibrary,
    templateForProperty,
    upsertRepeatTemplate,
} = require("../manual-work-library.js");

function scheduledLibrary() {
    const base = normalizeLibrary({
        properties: [{
            propertyId: "property-one",
            address: "123 Anywhere Dr, Elk City, OK 73644",
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
        templates: [],
    });
    return upsertRepeatTemplate(
        base,
        "property-one",
        {
            source: "HNP",
            expectedPay: 18,
            notes: "Repeat exterior check",
            recurrenceCount: 30,
            recurrenceUnit: "days",
            nextDueDate: "2026-09-18",
        },
        {
            now: new Date("2026-08-22T12:10:00Z"),
            idFactory: () => "template-one",
        },
    );
}

test("materializing scheduled work creates a distinct gig and one physical stop in both routes", () => {
    const template = templateForProperty(scheduledLibrary(), "property-one");
    const validStopIds = new Set(["manual-stop", "ade-stop"]);
    const gig = createGig(
        {
            stopId: "manual-stop",
            source: template.source,
            workOrderId: "",
            expectedPay: template.expectedPay,
            notes: template.notes,
            routeIncluded: true,
            dueDate: template.nextDueDate,
        },
        {
            validStopIds,
            now: "2026-09-14T12:00:00Z",
            idFactory: () => "gig-scheduled-one",
        },
    );

    const history = setGigRouteMembership(
        {
            google: {
                routeIds: ["ade-stop", "manual-stop"],
                orderIdsByStopId: { "ade-stop": ["ADE-1"] },
                optimizationStatus: "google_optimized",
            },
            basic: {
                routeIds: ["ade-stop"],
                orderIdsByStopId: { "ade-stop": ["ADE-1"] },
                optimizationStatus: "basic_optimized",
            },
            pending: {
                routeIds: ["ade-stop"],
                orderIdsByStopId: { "ade-stop": ["ADE-NEW"] },
                sourceUpdatedAt: "2026-09-14T10:00:00Z",
            },
        },
        gig,
        true,
        validStopIds,
    );

    assert.equal(gig.id, "gig-scheduled-one");
    assert.equal(gig.workOrderId, "");
    assert.equal(gig.source, "HNP");
    assert.equal(gig.expectedPay, 18);
    assert.equal(gig.routeIncluded, true);
    assert.equal(gig.dueDate, "2026-09-18");
    assert.deepEqual(history.google.routeIds, ["ade-stop", "manual-stop"]);
    assert.deepEqual(history.basic.routeIds, ["ade-stop", "manual-stop"]);
    assert.equal(history.google.routeIds.filter((id) => id === "manual-stop").length, 1);
    assert.equal(history.basic.routeIds.filter((id) => id === "manual-stop").length, 1);
    assert.deepEqual(history.google.orderIdsByStopId, { "ade-stop": ["ADE-1"] });
    assert.deepEqual(history.basic.orderIdsByStopId, { "ade-stop": ["ADE-1"] });
    assert.deepEqual(history.pending.orderIdsByStopId, { "ade-stop": ["ADE-NEW"] });
    assert.deepEqual(history.pending.routeIds, ["ade-stop"]);
});

test("materializing a due cycle advances the template from the scheduled date", () => {
    const library = scheduledLibrary();
    const advanced = advanceTemplateDue(library, "template-one", "2026-09-14");

    assert.equal(
        templateForProperty(advanced, "property-one").nextDueDate,
        "2026-10-18",
    );
    assert.equal(library.templates[0].nextDueDate, "2026-09-18");
});
