"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function section(text, start, end) {
    const a = text.indexOf(start);
    const b = text.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, "Missing " + start + " or " + end);
    return text.slice(a, b + end.length);
}

test("all original route tools remain unique inside one dropdown, grouped by purpose", () => {
    const tools = section(html, '<details class="plannerUtilities">', "</details>");
    assert.match(tools, /class="plannerToolsGrid"/);
    assert.match(tools, /class="plannerToolGroup plannerToolPrimary"/);
    assert.match(tools, /class="plannerToolGroup plannerToolSecondary"/);
    const primary = section(tools, 'class="plannerToolGroup plannerToolPrimary"', 'class="plannerToolGroup plannerToolSecondary"');
    const secondary = tools.slice(tools.indexOf('class="plannerToolGroup plannerToolSecondary"'));

    const primaryIds = [
        "optimizeRoute", "googleOptimizeRoute", "routeOptimizeFeedback",
        "exportRoute", "sendRouteOrder", "checkWorkbookRoute", "clearRoute",
        "downloadGarminGpx", "workbookRouteCheckStatus", "newRouteAvailable",
        "newRouteAvailableStatus", "startNewRoute", "routeMapLinks",
        "workbookRouteOrderStatus",
    ];
    const secondaryIds = ["clearInspectorAdeJobs", "clearManualGigWork"];
    for (const id of primaryIds) assert.match(primary, new RegExp('id="' + id + '"'), id);
    for (const id of secondaryIds) assert.match(secondary, new RegExp('id="' + id + '"'), id);
    for (const id of [...primaryIds, ...secondaryIds]) {
        assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " should be unique");
    }
    assert.match(tools, /id="sendRouteOrder"[^>]*disabled/s);
    assert.match(tools, /id="newRouteAvailable" class="plannerNotice" hidden/);
    assert.match(tools, /id="routeMapLinks" class="btnRow" hidden/);
    assert.match(tools, /<summary>Route tools &amp; maintenance<\/summary>/);
});

test("mobile tool order and breakpoints are unchanged", () => {
    const tools = section(html, '<details class="plannerUtilities">', "</details>");
    const ordered = ["optimizeRoute", "googleOptimizeRoute", "exportRoute",
        "sendRouteOrder", "checkWorkbookRoute", "clearRoute", "downloadGarminGpx",
        "workbookRouteCheckStatus", "newRouteAvailable", "routeMapLinks",
        "workbookRouteOrderStatus", "clearInspectorAdeJobs", "clearManualGigWork"];
    const positions = ordered.map(id => tools.indexOf('id="' + id + '"'));
    assert.ok(positions.every(x => x >= 0));
    for (let i = 1; i < positions.length; i++) {
        assert.ok(positions[i] > positions[i - 1], ordered[i] + " unexpectedly moved on phone");
    }
    assert.match(css, /@media \(max-width: 760px\)\s*\{\s*#routePage \.plannerToolsGrid,[\s\S]*?#routePage \.plannerToolGroup\s*\{\s*display:\s*contents/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#routePage \.plannerToolSecondary h4\s*\{\s*display:\s*none/);
    assert.match(html, /styles\.css\?v=1\.2\.13/);
});

test("desktop routes have readable text and full-width grouping rather than nested skinny cards", () => {
    const marker = css.indexOf("/* Cohesive Build Route workspace:");
    const accents = css.indexOf("/* Route Builder color accents:", marker);
    const styles = css.slice(marker, accents);
    assert.ok(marker >= 0 && accents > marker);
    assert.match(styles, /@media \(min-width: 761px\)[\s\S]*?#routePage\s*\{\s*font-size:\s*18px/);
    assert.match(styles, /#routePage \.tiny,[\s\S]*?font-size:\s*16px/);
    assert.match(styles, /#routePage \.btn,[\s\S]*?min-height:\s*44px/);
    assert.match(styles, /#routePage #routePlanControls h3,[\s\S]*?font-size:\s*22px/);
    assert.match(styles, /#routePage \.plannerContext > \.plannerUtilities\s*\{[\s\S]*?max-width:\s*none/);
    assert.match(styles, /#routePage \.plannerToolsGrid\s*\{\s*display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.7fr\)/);
    assert.match(styles, /#routePage \.plannerSettingsGrid\s*\{\s*grid-template-columns:\s*minmax\(350px, 0\.85fr\)/);
    assert.match(styles, /#routePage \.plannerSettingsGrid\s*\{[\s\S]*?align-items:\s*start/);
    assert.match(styles, /#routePage \.workdayFields\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.doesNotMatch(styles, /(^|\n)\s*body\s*\{/);
});

test("driving, map/list, and planning data controls are unchanged", () => {
    for (const id of [
        "routeChoice", "routePlanControls", "routePlanDaySelector", "routePlanDayCount",
        "routePlanAutoDays", "routePlanBuildDays", "routePlanAssignDays",
        "workdayControls", "routeDate", "routeDepartureTime",
        "routePreferredFinishTime", "routeHomeByEnabled", "routeHomeByTime",
        "plannerSummaryDetails", "routePaySummary",
        "startRouteNavigation", "completeAndNavigateNext", "routeStatus",
        "plannerMap", "plannerWorkspace", "routeList",
    ]) assert.equal(html.split('id="' + id + '"').length - 1, 1, id);
    assert.match(html, /<section class="plannerActionSection"/);
    assert.match(html, /<section class="plannerSurface"/);
});
