const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const contract = require("../contract.js");
const { applyAddressInbox, parseAddressInbox } = require("../inbox.js");
const { routeSource, routePointName } = require("../garmin-gpx.js");
const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

function inboxText(addresses) {
    return JSON.stringify({
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-07-31T14:00:00.000Z",
        addresses,
    });
}

function routeFormatter() {
    const match = appSource.match(
        /function routeDisplaySource\(job\) \{[\s\S]*?\n\}\n\nfunction formatRouteStopLine\(job, index\) \{[\s\S]*?\n\}/,
    );
    assert.ok(match, "Build Route source helpers must remain in app.js");
    const context = {};
    vm.runInNewContext(
        `${match[0]}\nthis.helpers = { routeDisplaySource, formatRouteStopLine };`,
        context,
    );
    return context.helpers;
}

test("only GIS and DCFS are accepted as dedicated route sources", () => {
    assert.equal(contract.normalizeSource(" gis "), "GIS");
    assert.equal(contract.normalizeSource("DCFS"), "DCFS");
    assert.equal(contract.normalizeSource("MCS"), "");
    assert.equal(contract.normalizeSource("Guardian"), "");
});

test("workbook source updates a matching address without replacing client data or pin", () => {
    const existing = [{
        id: "cache-stop",
        address: "420 NWGRANITE AVE, Cache",
        label: "MCS",
        notes: "Client details",
        latitude: 34.63615,
        longitude: -98.624558,
        pinStatus: "manual",
    }];
    const inbox = parseAddressInbox(inboxText([{
        address: "420 NWGRANITE AVE, Cache",
        source: "GIS",
    }]));
    const result = applyAddressInbox(existing, inbox);
    const stop = result.stops[0];

    assert.equal(stop.id, "cache-stop");
    assert.equal(stop.source, "GIS");
    assert.equal(stop.label, "MCS");
    assert.equal(stop.notes, "Client details");
    assert.equal(stop.pinStatus, "manual");
    assert.equal(stop.latitude, 34.63615);
    assert.equal(stop.longitude, -98.624558);
});

test("older workbook inboxes without source remain valid", () => {
    const inbox = parseAddressInbox(inboxText([{
        address: "100 Main St, Elk City, OK 73644",
    }]));
    assert.equal(inbox.addresses[0].source, "");
});

test("Build Route and Garmin prefer the dedicated workbook source", () => {
    const { formatRouteStopLine } = routeFormatter();
    const stop = {
        address: "420 NWGRANITE AVE, Cache",
        source: "GIS",
        label: "MCS",
        notes: "",
    };

    assert.equal(
        formatRouteStopLine(stop, 7),
        "08 — GIS — 420 NWGRANITE AVE, Cache",
    );
    assert.equal(routeSource(stop), "GIS");
    assert.equal(
        routePointName(stop, 8, 10),
        "08 - GIS - 420 NWGRANITE AVE, Cache",
    );
});

test("unknown dedicated source cannot override legacy fallback", () => {
    assert.equal(
        routeSource({ source: "MCS", label: "DCFS", notes: "" }),
        "DCFS",
    );
});

test("runtime source handling does not add observers or polling", () => {
    assert.doesNotMatch(appSource, /\bMutationObserver\b/);
    assert.doesNotMatch(appSource, /setInterval\s*\(/);
});
