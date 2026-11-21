"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    APPROVED_STREET_SEEDS,
    addStreetCorrectionRule,
    applyCorrectionsToInbox,
    createCorrectionRecord,
    mergeCorrectionRecords,
    parseCorrectionRecord,
    proposeStreetCorrection,
    removeStreetCorrectionRules,
    streetDecisionForAddress,
} = require("../address-corrections.js");

const wrong = "123 W HEAT AVE, Lawton, OK 73501";
const fixed = "123 WHEAT AVE, Lawton, OK 73501";
const candidate = {
    town: "Lawton", state: "OK",
    originalStreet: "W HEAT AVE", correctedStreet: "WHEAT AVE",
};

function approvedRecord(id = "street_rule_one") {
    return addStreetCorrectionRule(createCorrectionRecord([]), candidate, id);
}

test("verified street fixes seed 46 known errors without exposing properties", () => {
    assert.equal(APPROVED_STREET_SEEDS.length, 46);
    const source = fs.readFileSync(path.join(__dirname, "../address-corrections.js"), "utf8");
    const blockStart = source.indexOf("const APPROVED_STREET_SEEDS");
    const blockEnd = source.indexOf("        ]);", blockStart);
    assert.ok(blockStart >= 0 && blockEnd > blockStart);
    const seedBlock = source.slice(blockStart, blockEnd);
    assert.doesNotMatch(seedBlock, /latitude|longitude|orderIds|pinStatus|sourceId/);
    for (const seed of APPROVED_STREET_SEEDS) {
        assert.match(seed.id, /^seed_[0-9]{2}$/);
        assert.equal(seed.state, "OK");
        assert.ok(seed.originalStreet);
        assert.ok(seed.correctedStreet);
    }
    const unchangedRecord = createCorrectionRecord([]);
    assert.equal(unchangedRecord.correctionsVersion, 1);
    const applied = applyCorrectionsToInbox({ addresses: [
        { address: "321 W HEAT RIDGE AVE, Geronimo, OK 73543", orderIds: ["G-321"] },
        { address: "321 W HEAT RIDGE AVE, Lawton, OK 73501", orderIds: ["L-321"] },
        { address: "725 S OUTH SYCAMORE ST, Fletcher, OK 73541", orderIds: ["F-725"] },
        { address: "452 W E AVE, Cache, OK 73527", orderIds: ["C-452"] },
        { address: "401 NEGARDEN LN, Lawton, OK 73507", orderIds: ["L-401"] },
        { address: "321SEELLSWORTH AVE, Lawton, OK 73501", orderIds: ["L-321"] },
    ] }, unchangedRecord);
    assert.deepEqual(applied.addresses.map(x => x.address), [
        "321 WHEAT RIDGE AVE, Geronimo, OK 73543",
        "321 W HEAT RIDGE AVE, Lawton, OK 73501",
        "725 SOUTH SYCAMORE ST, Fletcher, OK 73541",
        "452 W E AVE, Cache, OK 73527",
        "401 NE GARDEN LN, Lawton, OK 73507",
        "321 SE ELLSWORTH AVE, Lawton, OK 73501",
    ]);
    assert.deepEqual(applied.addresses.map(x => x.orderIds[0]), [
        "G-321", "L-321", "F-725", "C-452", "L-401", "L-321",
    ]);
});

test("removing a reviewed built-in street correction persists as a Drive tombstone", () => {
    const initial = createCorrectionRecord([]);
    const before = streetDecisionForAddress(
        "321 W HEAT RIDGE AVE, Geronimo, OK 73543", initial,
    );
    assert.equal(before.status, "corrected");
    const removed = removeStreetCorrectionRules(initial, ["seed_02"]);
    assert.equal(removed.correctionsVersion, 2);
    assert.deepEqual(removed.removedStreetRuleIds, ["seed_02"]);
    const reloaded = parseCorrectionRecord(JSON.stringify(removed));
    const later = mergeCorrectionRecords(createCorrectionRecord([]), reloaded);
    assert.equal(
        streetDecisionForAddress("321 W HEAT RIDGE AVE, Geronimo, OK 73543", later),
        null,
    );
    assert.equal(
        streetDecisionForAddress("725 S OUTH SYCAMORE ST, Fletcher, OK 73541", later).status,
        "corrected",
    );
});

test("new manual rule conflicting with a verified seed fails closed", () => {
    const conflict = addStreetCorrectionRule(createCorrectionRecord([]), {
        town: "Geronimo", state: "OK",
        originalStreet: "W HEAT RIDGE AVE", correctedStreet: "W HEAT RD",
    }, "street_other_1");
    const result = applyCorrectionsToInbox({
        addresses: [{ address: "321 W HEAT RIDGE AVE, Geronimo, OK 73543" }],
    }, conflict);
    assert.equal(result.addresses[0].address, "321 W HEAT RIDGE AVE, Geronimo, OK 73543");
    assert.equal(result.addresses[0].streetCorrectionConflict.status, "conflict");
});

test("street learning requires a genuine before/after edit of the same numbered property", () => {
    assert.deepEqual(proposeStreetCorrection(wrong, fixed), candidate);
    assert.equal(proposeStreetCorrection(wrong, "321 WHEAT AVE, Lawton, OK 73501"), null);
    assert.equal(proposeStreetCorrection(wrong, "123 WHEAT AVE, Altus, OK 73521"), null);
    assert.equal(proposeStreetCorrection(wrong, "123 WHEAT AVE, Lawton, OK 73505"), null);
    assert.equal(proposeStreetCorrection(wrong, wrong), null);
    assert.equal(proposeStreetCorrection("W HEAT AVE", "WHEAT AVE"), null);
});

test("approved correction works for workbook addresses glued to the house number", () => {
    const proposed = proposeStreetCorrection(
        "119NWVALLEYBROOK DR, Lawton, OK 73505",
        "119 NW VALLEYBROOK DR, Lawton, OK 73505",
    );
    assert.deepEqual(proposed, {
        town: "Lawton", state: "OK",
        originalStreet: "NWVALLEYBROOK DR",
        correctedStreet: "NW VALLEYBROOK DR",
    });
    const saved = addStreetCorrectionRule(
        createCorrectionRecord([]), proposed, "street_glued_1",
    );
    const imported = applyCorrectionsToInbox({ addresses: [{
        address: "321NWVALLEYBROOK DR, Lawton, OK 73505",
        orderIds: ["NEW-321"],
    }] }, saved);
    assert.equal(
        imported.addresses[0].address,
        "321 NW VALLEYBROOK DR, Lawton, OK 73505",
    );
    assert.deepEqual(imported.addresses[0].orderIds, ["NEW-321"]);
});

test("v1 exact-address memory remains compatible until street learning is approved", () => {
    const old = createCorrectionRecord([{
        address: fixed,
        addressAliases: [wrong],
        source: "GIS",
        latitude: 34.7, longitude: -98.4, pinStatus: "manual",
    }]);
    assert.equal(old.correctionsVersion, 1);
    assert.equal(old.streetRules, undefined);
    const fromDrive = parseCorrectionRecord(JSON.stringify(old));
    assert.equal(fromDrive.correctionsVersion, 1);
    assert.equal(fromDrive.streetRules, undefined);
    const updated = addStreetCorrectionRule(old, candidate, "street_rule_one");
    assert.equal(updated.correctionsVersion, 2);
    assert.equal(updated.corrections.length, 1);
    const reloaded = parseCorrectionRecord(JSON.stringify(updated));
    assert.equal(reloaded.streetRules.length, 1);
});

test("approved street rule changes other house numbers, not their pins, GIS IDs or details", () => {
    const route = {
        updatedAt: "2026-11-20T20:00:00Z",
        addresses: [
            {
                address: "321 W HEAT AVE, Lawton, OK 73501",
                source: "DCFS",
                orderIds: ["WO-321"],
                latitude: 34.55, longitude: -98.31,
                pinStatus: "manual",
                label: "Different property", notes: "Keep me",
            },
            {
                address: "321 W HEAT AVE, Elk City, OK 73644",
                orderIds: ["WO-ELK"], pinStatus: "geocoded",
            },
            {
                address: "322 WHEAT AVE, Lawton, OK 73501",
                orderIds: ["WO-322"],
            },
            {
                address: "333 N WEST ST, Lawton, OK 73501",
                orderIds: ["WO-WEST"],
            },
        ],
    };
    const result = applyCorrectionsToInbox(route, approvedRecord());
    assert.equal(result.addresses[0].address, "321 WHEAT AVE, Lawton, OK 73501");
    assert.deepEqual(result.addresses[0].orderIds, ["WO-321"]);
    assert.equal(result.addresses[0].latitude, 34.55);
    assert.equal(result.addresses[0].longitude, -98.31);
    assert.equal(result.addresses[0].pinStatus, "manual");
    assert.equal(result.addresses[0].label, "Different property");
    assert.equal(result.addresses[0].notes, "Keep me");
    assert.equal(result.addresses[0].originalAddress, "321 W HEAT AVE, Lawton, OK 73501");
    assert.equal(result.addresses[1].address, route.addresses[1].address);
    assert.equal(result.addresses[2].address, route.addresses[2].address);
    assert.equal(result.addresses[3].address, route.addresses[3].address);
    assert.deepEqual(route.addresses[0].orderIds, ["WO-321"]);
});

test("street correction never inherits a different house's manual pin", () => {
    const record = mergeCorrectionRecords(
        createCorrectionRecord([{
            address: fixed,
            addressAliases: [wrong],
            latitude: 34.7, longitude: -98.5,
            pinStatus: "manual",
        }]),
        approvedRecord(),
    );
    const incoming = { addresses: [{
        address: "321 W HEAT AVE, Lawton, OK 73501",
        latitude: null, longitude: null,
        pinStatus: "unverified",
        orderIds: ["NEW-321"],
    }] };
    const result = applyCorrectionsToInbox(incoming, record);
    assert.equal(result.addresses[0].address, "321 WHEAT AVE, Lawton, OK 73501");
    assert.equal(result.addresses[0].latitude, null);
    assert.equal(result.addresses[0].pinStatus, "unverified");
    assert.deepEqual(result.addresses[0].orderIds, ["NEW-321"]);
});

test("exact saved correction remains stronger than a street-wide correction", () => {
    const one = createCorrectionRecord([{
        address: "123 WHEAT AVE, Lawton, OK 73501",
        addressAliases: [wrong],
        latitude: 34.7, longitude: -98.4, pinStatus: "manual",
    }]);
    const record = mergeCorrectionRecords(approvedRecord(), one);
    const changed = applyCorrectionsToInbox({ addresses: [{ address: wrong }] }, record);
    assert.equal(changed.addresses[0].address, fixed);
    assert.equal(changed.addresses[0].pinStatus, "manual");
});

test("two devices' contradictory rules merge as a conflict without changing a new incoming address", () => {
    const laptop = approvedRecord("street_laptop_1");
    const phone = addStreetCorrectionRule(createCorrectionRecord([]), {
        ...candidate, correctedStreet: "W HEAT ST",
    }, "street_phone_1");
    const merged = mergeCorrectionRecords(laptop, phone);
    assert.equal(merged.correctionsVersion, 2);
    assert.equal(merged.streetRules.length, 2);
    const decision = streetDecisionForAddress("321 W HEAT AVE, Lawton, OK 73501", merged);
    assert.equal(decision.status, "conflict");
    assert.deepEqual(decision.choices.map(x => x.street).sort(), ["W HEAT ST", "WHEAT AVE"]);
    const changed = applyCorrectionsToInbox({ addresses: [{
        address: "321 W HEAT AVE, Lawton, OK 73501",
        orderIds: ["321"],
    }] }, merged);
    assert.equal(changed.addresses[0].address, "321 W HEAT AVE, Lawton, OK 73501");
    assert.equal(changed.addresses[0].streetCorrectionConflict.status, "conflict");
    assert.deepEqual(changed.addresses[0].orderIds, ["321"]);
});

test("tombstones resolve a conflict across a later device merge and allow undo", () => {
    const laptop = approvedRecord("street_laptop_1");
    const phone = addStreetCorrectionRule(createCorrectionRecord([]), {
        ...candidate, correctedStreet: "W HEAT ST",
    }, "street_phone_1");
    const merged = mergeCorrectionRecords(laptop, phone);
    const chosen = removeStreetCorrectionRules(merged, ["street_phone_1"]);
    const next = mergeCorrectionRecords(phone, chosen);
    assert.deepEqual(next.streetRules.map((r) => r.correctedStreet), ["WHEAT AVE"]);
    assert.equal(
        streetDecisionForAddress("321 W HEAT AVE, Lawton, OK 73501", next).status,
        "corrected",
    );
    const removed = removeStreetCorrectionRules(next, ["street_laptop_1"]);
    assert.equal(streetDecisionForAddress("321 W HEAT AVE, Lawton, OK 73501", removed), null);
    const restoredRemote = mergeCorrectionRecords(merged, parseCorrectionRecord(JSON.stringify(removed)));
    assert.equal(restoredRemote.streetRules.length, 0);
    assert.equal(restoredRemote.correctionsVersion, 2);
});

test("identical rules from different devices do not produce false conflicts", () => {
    const a = approvedRecord("street_laptop_1");
    const b = approvedRecord("street_phone_1");
    const both = mergeCorrectionRecords(a, b);
    assert.equal(
        streetDecisionForAddress("321 W HEAT AVE, Lawton, OK 73501", both).status,
        "corrected",
    );
});

test("FMR UI has opt-in learning, conflict marker, removal and shared Drive workflow", () => {
    const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
    const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
    assert.match(app, /proposeStreetCorrection\(previousAddress, address\)/);
    assert.match(app, /approvedRule = proposal && confirm\(/);
    assert.match(app, /appendStreetConflictWarning\(\s*header, card\.address/);
    assert.match(app, /textContent = "!"/);
    assert.match(app, /removeStreetCorrectionRules\(/);
    assert.match(app, /streetCorrectionRecord = corrections;/);
    assert.match(app, /mergeCorrectionRecords\(remote, localRecord\)/);
    assert.match(app, /saveAddressCorrectionsToDrive\(token, merged\)/);
    assert.match(html, /id="manageStreetCorrections"/);
    assert.match(html, /address-corrections\.js\?v=1\.0\.2/);
    assert.match(html, /app\.js\?v=3\.34\.10/);
});
