"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("Route summary is one closed-by-default native disclosure near Workday", () => {
    const start = html.indexOf('<details class="plannerSummaryDetails" id="plannerSummaryDetails">');
    const end = html.indexOf("</details>", start);
    assert.ok(start >= 0 && end > start);
    const drawer = html.slice(start, end + "</details>".length);

    assert.match(drawer, /<summary>Route summary <span[^>]*>— stops, work, pay &amp; timing<\/span><\/summary>/);
    assert.doesNotMatch(drawer.slice(0, drawer.indexOf(">") + 1), /\sopen(?:\s|=|>)/);
    assert.match(drawer, /id="plannerDaySummary" class="plannerDaySummary" aria-live="polite"/);
    assert.match(drawer, /id="routePaySummary"/);
    assert.equal(html.split('id="plannerDaySummary"').length - 1, 1);
    assert.equal(html.split('id="routePaySummary"').length - 1, 1);
    assert.ok(html.indexOf('id="workdayControls"') < start);
    assert.ok(end < html.indexOf('class="plannerSurface"'));
});

test("route summary still populates all existing cards without changing planner model", () => {
    assert.match(app, /plannerEls\.daySummary\.innerHTML = "";/);
    assert.match(app, /plannerEls\.daySummary\.appendChild\(plannerSummaryItem\(label, value\)\);/);
    for (const label of ['"Route"', '"Workday"', '"Stops / work"', '"Expected pay"', '"Service"', '"Traffic travel"', '"Home By"']) {
        assert.ok(app.includes(label), label + " remains rendered");
    }
    assert.match(app, /message\.className = "plannerSummaryMessage tiny muted"/);
});

test("the summary drawer is visible as one compact colored control, with readable expanded cards", () => {
    for (const selector of [
        "#routePage .plannerSummaryDetails",
        "#routePage .plannerSummaryDetails > summary",
        "#routePage .plannerSummaryDetails > summary:focus-visible",
        "#routePage .plannerSummaryDetails[open] > summary",
        "#routePage .plannerSummaryItem",
        "#routePage .plannerSummaryItem:nth-child(3)",
        "#routePage .plannerSummaryItem:nth-child(4)",
        "#routePage .plannerSummaryLabel",
        "#routePage .plannerSummaryValue",
    ]) {
        assert.ok(css.includes(selector + " {"), selector + " is styled");
    }
    assert.match(css, /@media \(max-width: 760px\)\s*\{\s*\.plannerDaySummary\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /@media \(max-width: 480px\)\s*\{\s*\.plannerDaySummary\s*\{\s*grid-template-columns: 1fr/);
    assert.match(html, /styles\.css\?v=1\.2\.11/);
});
