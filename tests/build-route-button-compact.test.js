"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function cssRule(selector) {
    const start = css.indexOf(selector + " {");
    assert.ok(start !== -1, selector + " is missing");
    const open = css.indexOf("{", start);
    return css.slice(open + 1, css.indexOf("}", open));
}

test("compact button dimensions apply only to the Build Route page", () => {
    const button = cssRule("#routePage .btn");
    assert.match(button, /width:\s*auto\s*;/);
    assert.match(button, /max-width:\s*100%\s*;/);
    assert.match(button, /min-height:\s*36px\s*;/);
    assert.match(button, /padding:\s*6px 9px\s*;/);

    const row = cssRule("#routePage .btnRow");
    assert.match(row, /gap:\s*6px\s*;/);

    const navigation = cssRule("#routePage .plannerExecutionActions > .btn");
    assert.match(navigation, /flex:\s*0 1 auto\s*;/);
    assert.match(html, /id="routePage"/);
    assert.match(html, /styles\.css\?v=1\.2\.9/);
});

test("existing route actions, labels, and the full tools dropdown remain present", () => {
    const routePage = html.slice(html.indexOf('id="routePage"'), html.indexOf('data-page="settings"'));
    const ids = [
        "exportRoute", "sendRouteOrder", "checkWorkbookRoute",
        "startNewRoute", "clearRoute", "downloadGarminGpx",
        "clearInspectorAdeJobs", "clearManualGigWork",
        "routePlanAutoDays", "routePlanBuildDays", "routePlanAssignDays",
        "optimizeRoute", "googleOptimizeRoute", "startRouteNavigation",
        "completeAndNavigateNext",
    ];
    for (const id of ids) {
        assert.equal(routePage.split('id="' + id + '"').length - 1, 1, id);
    }
    assert.match(routePage, /<details class="plannerUtilities">/);
    assert.match(routePage, /<summary>Route tools &amp; maintenance<\/summary>/);
});
