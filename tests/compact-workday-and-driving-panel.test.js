"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function rule(selector) {
    const start = css.indexOf(selector + " {");
    assert.ok(start >= 0, selector + " must be present");
    const from = css.indexOf("{", start) + 1;
    return css.slice(from, css.indexOf("}", from));
}

test("Multi-Day Plan and Workday are the two children of one balanced layout wrapper", () => {
    const start = html.indexOf('<div class="plannerSettingsGrid">');
    const end = html.indexOf('<details class="plannerSummaryDetails"', start);
    assert.ok(start >= 0 && end > start);
    const section = html.slice(start, end);
    assert.ok(section.indexOf('id="routePlanControls"') < section.indexOf('id="workdayControls"'));
    assert.ok(section.includes('class="plannerDaySetup"'));
    assert.ok(section.includes('class="workdayFields"'));

    let depth = 0;
    for (const tag of section.match(/<\/?div\b[^>]*>/g) || []) {
        depth += tag.startsWith("</") ? -1 : 1;
        assert.ok(depth >= 0, "No unmatched closing div before summary");
    }
    assert.equal(depth, 0, "The two planning panels close before route summary");
});

test("Days remains a narrow numeric input and Workday retains all four original fields", () => {
    const day = rule("#routePage #routePlanDayCount");
    assert.match(day, /max-width:\s*94px/);
    assert.match(rule("#routePage .plannerSettingsGrid"), /repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(rule("#routePage .workdayFields"), /repeat\(4,\s*minmax\(0,\s*1fr\)\)/);

    for (const id of [
        "routePlanDayCount", "routePlanDaySelector", "routeDate",
        "routeDepartureTime", "routePreferredFinishTime",
        "routeHomeByEnabled", "routeHomeByTime", "routeDayContextStatus",
        "routePlanAutoDays", "routePlanBuildDays", "routePlanAssignDays",
    ]) {
        assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " must be unique");
    }
    assert.match(html, /styles\.css\?v=1\.2\.9/);
    assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.plannerSettingsGrid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(css, /@media \(max-width: 540px\)[\s\S]*?\.workdayFields\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("Drive this route keeps both navigation buttons and explains the existing next-stop behavior concisely", () => {
    const section = html.slice(
        html.indexOf('<section class="plannerActionSection"'),
        html.indexOf('<section class="plannerSurface"'),
    );
    assert.match(section, /Drive this route/);
    assert.match(section, /id="startRouteNavigation"/);
    assert.match(section, /id="completeAndNavigateNext"/);
    assert.match(section, /Done &amp; Navigate Next[\s\S]*?next stop \(or Home\) in Google Maps/);
    assert.match(rule("#routePage .plannerActionSection"), /padding:\s*10px 12px/);
});
