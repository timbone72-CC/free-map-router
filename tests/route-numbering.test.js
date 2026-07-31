const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const { routePointName, routeSource } = require("../garmin-gpx.js");

function appRouteFormatters() {
    const match = app.match(
        /function routeDisplaySource\(job\) \{[\s\S]*?\n\}\n\nfunction formatRouteStopLine\(job, index\) \{[\s\S]*?\n\}/,
    );
    assert.ok(match, "Route display helpers must remain in app.js");

    const context = {};
    vm.runInNewContext(
        `${match[0]}\nthis.helpers = { routeDisplaySource, formatRouteStopLine };`,
        context,
    );
    return context.helpers;
}

test("Build Route numbers stops and shows only DCFS or GIS", () => {
    const { formatRouteStopLine } = appRouteFormatters();

    assert.equal(
        formatRouteStopLine(
            {
                address: "123 Main St",
                label: "Guardian DCFS",
                notes: "MCS details remain saved",
            },
            0,
        ),
        "01 — DCFS — 123 Main St",
    );
    assert.equal(
        formatRouteStopLine(
            {
                address: "456 Oak Ave",
                label: "MCS",
                notes: "GIS inspection",
            },
            1,
        ),
        "02 — GIS — 456 Oak Ave",
    );
    assert.equal(
        formatRouteStopLine(
            {
                address: "789 Elm Rd",
                label: "MCS",
                notes: "ordinary field notes",
            },
            2,
        ),
        "03 — 789 Elm Rd",
    );
});

test("Address list keeps its existing detailed formatter", () => {
    assert.equal(
        (app.match(/label\.textContent = formatJobLine\(job\);/g) || []).length,
        1,
    );
    assert.equal(
        (app.match(/label\.textContent = formatRouteStopLine\(job, i\);/g) || [])
            .length,
        1,
    );
});

test("Garmin stop names follow the same source and numbering rules", () => {
    assert.equal(
        routeSource({ label: "MCS", notes: "DCFS assignment" }),
        "DCFS",
    );
    assert.equal(
        routeSource({ label: "MCS", notes: "GIS assignment" }),
        "GIS",
    );
    assert.equal(routeSource({ label: "MCS", notes: "field notes" }), "");

    assert.equal(
        routePointName(
            {
                address: "123 Main St",
                label: "MCS",
                notes: "DCFS assignment",
            },
            1,
            4,
        ),
        "01 - DCFS - 123 Main St",
    );
    assert.equal(
        routePointName(
            {
                address: "456 Oak Ave",
                label: "MCS",
                notes: "field notes",
            },
            2,
            4,
        ),
        "02 - 456 Oak Ave",
    );
    assert.equal(routePointName({}, 0, 4), "Start - Home");
    assert.equal(routePointName({}, 3, 4), "Finish - Home");
});

test("route numbering uses the owned render and no observer", () => {
    assert.doesNotMatch(app, /\bMutationObserver\b/);
    assert.match(
        app,
        /function renderRouteList\(\)[\s\S]*formatRouteStopLine\(job, i\)/,
    );
});
