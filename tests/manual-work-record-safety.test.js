const test = require("node:test");
const assert = require("node:assert/strict");

const { parseManualWorkRecord } = require("../manual-work-library.js");

function version2(templates) {
    return JSON.stringify({
        app: "free-map-router",
        manualWorkVersion: 2,
        updatedAt: "2026-08-22T12:00:00Z",
        properties: [{
            propertyId: "property-one",
            address: "123 Anywhere Dr, Elk City, OK 73644",
            archived: false,
            updatedAt: "2026-08-22T12:00:00Z",
        }],
        templates,
    });
}

test("version 2 Drive record fails closed instead of silently dropping a damaged schedule", () => {
    assert.throws(
        () => parseManualWorkRecord(version2([{
            templateId: "template-one",
            propertyId: "property-one",
            source: "HNP",
            expectedPay: 18,
            recurrenceCount: 30,
            recurrenceUnit: "days",
            nextDueDate: "not-a-date",
            alertLeadDays: 4,
            active: true,
            updatedAt: "2026-08-22T12:00:00Z",
        }])),
        /repeat schedule|unexpected structure|damaged/i,
    );
});

test("version 2 Drive record fails closed when a schedule points at a missing property", () => {
    assert.throws(
        () => parseManualWorkRecord(version2([{
            templateId: "template-one",
            propertyId: "missing-property",
            source: "HNP",
            expectedPay: 18,
            recurrenceCount: 30,
            recurrenceUnit: "days",
            nextDueDate: "2026-09-18",
            alertLeadDays: 4,
            active: true,
            updatedAt: "2026-08-22T12:00:00Z",
        }])),
        /repeat schedule|unexpected structure|damaged/i,
    );
});