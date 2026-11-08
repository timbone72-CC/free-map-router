"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function routeTools() {
    const open = html.indexOf('<details class="plannerUtilities">');
    const close = html.indexOf("</details>", open);
    assert.ok(open >= 0 && close > open, "Route tools dropdown must exist");
    assert.equal(html.split('<details class="plannerUtilities">').length - 1, 1);
    return { open, content: html.slice(open, close + "</details>".length) };
}

test("the entire Route tools dropdown appears directly after route selection, before planning", () => {
    const routeHeader = html.indexOf('class="inlineHeader plannerRouteHeader"');
    const plan = html.indexOf('id="routePlanControls"');
    const { open, content } = routeTools();
    assert.ok(routeHeader >= 0 && routeHeader < open && open < plan);
    assert.match(content, /<summary>Route tools &amp; maintenance<\/summary>/);
    assert.doesNotMatch(html, /class="plannerQuickActions"/);
    assert.doesNotMatch(content.slice(content.indexOf(">") + 1), /<details/);
});

test("all route tools retain their original unique IDs inside the same dropdown", () => {
    const { content } = routeTools();
    const ids = [
        "exportRoute", "sendRouteOrder", "checkWorkbookRoute",
        "clearRoute", "downloadGarminGpx",
        "clearInspectorAdeJobs", "clearManualGigWork",
        "routeMapLinks", "workbookRouteOrderStatus",
        "newRouteAvailable", "newRouteAvailableStatus", "startNewRoute",
    ];
    for (const id of ids) {
        assert.match(content, new RegExp('id="' + id + '"'));
        assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " must remain unique");
    }
    assert.match(content, /id="sendRouteOrder"[^>]*disabled/s);
    assert.match(content, /id="routeMapLinks" class="btnRow" hidden/);
    assert.ok(content.indexOf('id="sendRouteOrder"') < content.indexOf('id="workbookRouteOrderStatus"'));
    assert.ok(content.indexOf('id="exportRoute"') < content.indexOf('id="routeMapLinks"'));
    assert.match(content, /<\/details>$/);
});

test("the moved dropdown remains compact and no unused Quick Actions CSS remains", () => {
    assert.match(css, /\.plannerContext > \.plannerUtilities\s*\{/);
    assert.doesNotMatch(css, /\.plannerQuickActions/);
    assert.match(html, /styles\.css\?v=1\.2\.7/);
});

test("Start New Route keeps the original pending-only display and confirmation logic", () => {
    const { content } = routeTools();
    assert.match(content, /id="newRouteAvailable" class="plannerNotice" hidden/);
    assert.match(content, /id="newRouteAvailableStatus"/);
    assert.match(content, /id="startNewRoute" type="button" class="btn btnSmall"/);
    assert.ok(content.indexOf('id="checkWorkbookRoute"') < content.indexOf('id="startNewRoute"'));

    const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
    assert.match(appJs, /const hasPending = Boolean\(pending\?\.routeIds\.length\);/);
    assert.match(appJs, /els\.newRouteAvailable\.hidden = !hasPending;/);
    assert.match(appJs, /els\.startNewRoute\.disabled = !hasPending;/);
    assert.match(appJs, /const pendingCount = routeHistory\.pending\?\.routeIds\.length \|\| 0;/);
    assert.match(appJs, /if \(pendingCount === 0\) return;/);
    assert.match(appJs, /confirm\([\s\S]*?This replaces the active Route Plan/);
});
