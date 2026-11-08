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
    assert.doesNotMatch(content.split("</details>")[0], /<details/);
});

test("all route tools retain their original unique IDs inside the same dropdown", () => {
    const { content } = routeTools();
    const ids = [
        "exportRoute", "sendRouteOrder", "checkWorkbookRoute",
        "clearRoute", "downloadGarminGpx",
        "clearInspectorAdeJobs", "clearManualGigWork",
        "routeMapLinks", "workbookRouteOrderStatus",
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
    assert.match(html, /styles\.css\?v=1\.2\.4/);
});
