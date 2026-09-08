"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function countMatches(text, pattern) {
    return Array.from(text.matchAll(pattern)).length;
}

function scriptIndex(filename) {
    return html.indexOf(`src="${filename}`);
}

function c2Section() {
    const marker = "PHASE 2H-C2 — Planner Map/List and Responsive Presentation";
    const index = app.indexOf(marker);
    assert.ok(index >= 0, "Phase 2H-C2 app section must exist");
    return app.slice(index);
}

test("C2 keeps the approved five top-level pages and every protected Build Route control exactly once", () => {
    const pageOptions = Array.from(
        html.matchAll(/<option value="(home|addresses|import|route|settings)">/g),
    ).map((match) => match[1]);
    assert.deepEqual(pageOptions, [
        "home",
        "addresses",
        "import",
        "route",
        "settings",
    ]);

    for (const id of [
        "routeChoice",
        "workdayControls",
        "routeDate",
        "routeDepartureTime",
        "routePreferredFinishTime",
        "routeHomeByTime",
        "newRouteAvailable",
        "startNewRoute",
        "checkWorkbookRoute",
        "optimizeRoute",
        "googleOptimizeRoute",
        "clearRoute",
        "exportRoute",
        "sendRouteOrder",
        "downloadGarminGpx",
        "clearInspectorAdeJobs",
        "clearManualGigWork",
        "googleRouteSignIn",
        "googleRouteAuthStatus",
        "routeMapLinks",
        "routeOptimizationStatus",
        "routePaySummary",
        "routeStatus",
        "workbookRouteOrderStatus",
        "startRouteNavigation",
        "completeAndNavigateNext",
        "routeList",
    ]) {
        assert.equal(
            countMatches(html, new RegExp(`id="${id}"`, "g")),
            1,
            `${id} must remain present exactly once`,
        );
    }
});

test("C2 Build Route contains one day summary, one map, one route list, and a bounded phone List/Map toggle", () => {
    for (const id of [
        "routePage",
        "plannerDaySummary",
        "plannerViewToggle",
        "plannerWorkspace",
        "plannerMapStatus",
        "plannerMap",
        "plannerMapEmpty",
    ]) {
        assert.equal(countMatches(html, new RegExp(`id="${id}"`, "g")), 1);
    }

    assert.equal(
        countMatches(html, /<button[\s\S]{0,180}data-planner-view="list"/g),
        1,
    );
    assert.equal(
        countMatches(html, /<button[\s\S]{0,180}data-planner-view="map"/g),
        1,
    );
    assert.match(html, /<details class="plannerUtilities">/);
    assert.match(html, /<summary>Route tools &amp; maintenance<\/summary>/);
});

test("C2 loads planning and planner model dependencies before app.js without a new package or map provider", () => {
    const routeWorkPlanning = scriptIndex("route-work-planning.js");
    const planningRuntime = scriptIndex("work-item-planning-runtime.js");
    const plannerModel = scriptIndex("planner-model.js");
    const appScript = scriptIndex("app.js");

    assert.ok(routeWorkPlanning >= 0);
    assert.ok(planningRuntime > routeWorkPlanning);
    assert.ok(plannerModel > planningRuntime);
    assert.ok(appScript > plannerModel);
    assert.match(html, /planner-model\.js\?v=1\.0\.0/);
    assert.match(html, /app\.js\?v=3\.33\.0/);
    assert.doesNotMatch(html, /maps\.googleapis\.com\/maps\/api\/js/);
});

test("C2 renders cards from the C1 model and derives map markers only from plottable stop cards", () => {
    const section = c2Section();
    assert.match(section, /const \{ buildPlannerModel, workItemKey: plannerWorkItemKey \}/);
    assert.match(section, /const model = buildPlannerModel\(\{/);
    assert.match(section, /model\.stopCards\.forEach\(\(card, index\) =>/);
    assert.match(section, /for \(const item of card\.workItems \|\| \[\]\)/);
    assert.match(section, /if \(!card\.mapPlottable \|\| !card\.coordinates\) continue;/);
    assert.match(section, /plannerMarkersByStopId\.set\(card\.stopId, marker\)/);
    assert.match(section, /marker\.on\("click", \(\) => focusPlannerStop\(card\.stopId\)\)/);
    assert.match(section, /li\.dataset\.stopId = card\.stopId/);
    assert.match(section, /model\.stopCards\.forEach/);
});

test("marker/card focus is exact-stop presentation state only", () => {
    const section = c2Section();
    const focusBlock = section.match(
        /function focusPlannerStop\(stopId\) \{([\s\S]*?)\n\}\n\nfunction plannerCard/,
    );
    assert.ok(focusBlock, "focusPlannerStop must remain a bounded function");
    const body = focusBlock[1];

    assert.match(body, /plannerFocusedStopId = id/);
    assert.match(body, /card\.dataset\.stopId === id/);
    assert.match(body, /plannerMarkersByStopId\.get\(id\)/);
    assert.doesNotMatch(body, /persistActiveRoute|persistRouteSlot|writeRouteHistory/);
    assert.doesNotMatch(body, /localStorage\.setItem|sessionStorage/);
    assert.doesNotMatch(body, /routeIds\s*=|routeIds\.push|routeIds\.splice/);
});

test("C2 responsive presentation is desktop map/list together and phone one-view-at-a-time", () => {
    assert.match(
        css,
        /\.plannerWorkspace\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(300px, 0\.9fr\) minmax\(0, 1\.1fr\);/,
    );
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.plannerViewToggle\s*\{[\s\S]*display:\s*inline-flex;/,
    );
    assert.match(
        css,
        /\.plannerWorkspace\[data-planner-view="list"\] \.plannerMapPane\s*\{[\s\S]*display:\s*none;/,
    );
    assert.match(
        css,
        /\.plannerWorkspace\[data-planner-view="map"\] \.plannerListPane\s*\{[\s\S]*display:\s*none;/,
    );
});

test("C2 adds no observer, polling loop, alternate route array, or persisted phone view state", () => {
    const section = c2Section();
    assert.doesNotMatch(section, /MutationObserver|setInterval\s*\(/);
    assert.doesNotMatch(section, /plannerRouteIds|mobileRouteIds|alternateRoute/);
    assert.doesNotMatch(section, /localStorage\.setItem\([^\n]*planner/i);
    assert.doesNotMatch(section, /sessionStorage\.setItem\([^\n]*planner/i);
    assert.match(section, /let plannerViewMode = "list"/);
});
