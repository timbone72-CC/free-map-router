"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("the three approved route actions appear together before the large plan controls", () => {
    const header = html.indexOf('class="inlineHeader plannerRouteHeader"');
    const quick = html.indexOf('class="plannerQuickActions"');
    const plan = html.indexOf('id="routePlanControls"');
    const maintenance = html.indexOf('class="plannerUtilities"');

    assert.ok(header >= 0 && header < quick && quick < plan && plan < maintenance);
    const section = html.slice(quick, plan);
    for (const id of ["exportRoute", "sendRouteOrder", "checkWorkbookRoute"]) {
        assert.ok(section.includes(`id="${id}"`), `${id} is not in Quick Actions`);
        assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id} must stay unique`);
    }
    assert.match(section, /Open in Google Maps/);
    assert.match(section, /Send Route Order to Workbook/);
    assert.match(section, /Check Workbook Route/);
    assert.match(section, /id="sendRouteOrder"[^>]*disabled/s);
});

test("map links and workbook send status stay beside their top action controls", () => {
    const quick = html.indexOf('class="plannerQuickActions"');
    const plan = html.indexOf('id="routePlanControls"');
    const section = html.slice(quick, plan);
    for (const id of ["routeMapLinks", "workbookRouteOrderStatus"]) {
        assert.ok(section.includes(`id="${id}"`), `${id} must be near its action`);
        assert.equal(html.split(`id="${id}"`).length - 1, 1);
    }
    assert.ok(css.includes(".plannerQuickActions > .btnRow"));
    assert.match(html, /styles\.css\?v=1\.2\.3/);
});

test("secondary maintenance controls remain in the expandable maintenance group", () => {
    const maintenance = html.slice(html.indexOf('<details class="plannerUtilities">'));
    assert.match(maintenance, /id="clearRoute"/);
    assert.match(maintenance, /id="downloadGarminGpx"/);
    assert.match(maintenance, /id="clearInspectorAdeJobs"/);
    assert.match(maintenance, /id="clearManualGigWork"/);
    assert.doesNotMatch(maintenance, /id="exportRoute"/);
    assert.doesNotMatch(maintenance, /id="sendRouteOrder"/);
    assert.doesNotMatch(maintenance, /id="checkWorkbookRoute"/);
});
