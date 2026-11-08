"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function sectionBetween(start, end) {
    const a = html.indexOf(start);
    const b = html.indexOf(end, a);
    assert.ok(a >= 0 && b > a, "expected section boundaries");
    return html.slice(a, b);
}

test("shared driving actions sit below route selector and above Route Tools", () => {
    const header = html.indexOf('class="inlineHeader plannerRouteHeader"');
    const driving = html.indexOf('<section class="plannerActionSection"');
    const tools = html.indexOf('<details class="plannerUtilities">');
    const surface = html.indexOf('class="plannerSurface"');

    assert.ok(header >= 0 && header < driving && driving < tools && tools < surface);
    const controls = sectionBetween('<section class="plannerActionSection"', "</section>");
    for (const id of [
        "startRouteNavigation",
        "completeAndNavigateNext",
        "routeStatus",
    ]) {
        assert.match(controls, new RegExp('id="' + id + '"'));
        assert.equal(html.split('id="' + id + '"').length - 1, 1);
    }
    assert.match(controls, /id="routeActionsHeading">Drive this route<\/h3>/);
    assert.match(controls, /id="startRouteNavigation"[^>]*disabled/s);
    assert.match(controls, /id="completeAndNavigateNext"[^>]*disabled/s);
    assert.doesNotMatch(html.slice(surface), /id="startRouteNavigation"/);
});

test("both optimizers retain unique IDs; only selected route is shown", () => {
    assert.match(html, /id="routePage"[^>]*data-active-route="google"/);
    const tools = sectionBetween('<details class="plannerUtilities">', "</details>");
    for (const id of ["optimizeRoute", "googleOptimizeRoute", "routeOptimizeFeedback"]) {
        assert.match(tools, new RegExp('id="' + id + '"'));
        assert.equal(html.split('id="' + id + '"').length - 1, 1);
    }
    assert.match(css, /#routePage\[data-active-route="google"\] #optimizeRoute\s*\{\s*display:\s*none;/);
    assert.match(css, /#routePage\[data-active-route="basic"\] #googleOptimizeRoute,/);
    assert.match(css, /#routePage\[data-active-route="basic"\] #googleRouteSignIn,/);
    assert.match(css, /#routePage\[data-active-route="basic"\] #googleRouteAuthStatus\s*\{\s*display:\s*none;/);
    assert.match(html, /styles\.css\?v=1\.2\.8/);
    assert.match(html, /app\.js\?v=3\.34\.5/);
});

test("renderRouteChoice updates route-specific controls without touching route state", () => {
    const beginning = app.indexOf("function renderRouteChoice() {");
    const ending = app.indexOf("function renderNewRouteAvailable()", beginning);
    assert.ok(beginning >= 0 && ending > beginning);
    const source = app.slice(beginning, ending);
    const options = { google: {}, basic: {} };
    const elements = {
        routePage: { dataset: {} },
        routeOptimizeFeedback: { textContent: "" },
        routeChoice: {
            value: "",
            querySelector(selector) {
                return selector.includes("google") ? options.google : options.basic;
            },
        },
    };
    const sandbox = {
        els: elements,
        activeRouteSlot: "google",
        optimizerFeedbackByRoute: { google: "Google route ready", basic: "Basic route ready" },
        routeHistory: {
            google: { routeIds: ["google-stop"] },
            basic: { routeIds: ["basic-stop"] },
        },
        routeChoiceStatusLabel: () => "Optimized",
    };
    vm.runInNewContext(source + "\nrenderRouteChoice();", sandbox);
    assert.equal(elements.routePage.dataset.activeRoute, "google");
    assert.equal(elements.routeOptimizeFeedback.textContent, "Google route ready");
    assert.equal(elements.routeChoice.value, "google");
    assert.equal(options.google.disabled, false);
    assert.equal(options.basic.disabled, false);
    sandbox.activeRouteSlot = "basic";
    vm.runInNewContext("renderRouteChoice();", sandbox);
    assert.equal(elements.routePage.dataset.activeRoute, "basic");
    assert.equal(elements.routeOptimizeFeedback.textContent, "Basic route ready");
    assert.equal(elements.routeChoice.value, "basic");
});

test("optimization progress stays attached to its own route slot", () => {
    const start = app.indexOf("function writeOptimizationFeedback(");
    const end = app.indexOf("async function optimizeSelectedRoute()", start);
    assert.ok(start >= 0 && end > start);
    const sandbox = {
        activeRouteSlot: "basic",
        optimizerFeedbackByRoute: { google: "", basic: "" },
        els: {
            routeOptimizeFeedback: { textContent: "Basic remains visible" },
            routeStatus: { textContent: "Driving Basic Route" },
        },
    };
    vm.runInNewContext(app.slice(start, end) + "\nwriteOptimizationFeedback('Google working', 'google');", sandbox);
    assert.equal(sandbox.optimizerFeedbackByRoute.google, "Google working");
    assert.equal(sandbox.els.routeOptimizeFeedback.textContent, "Basic remains visible");
    assert.equal(sandbox.els.routeStatus.textContent, "Driving Basic Route");

    vm.runInNewContext("writeOptimizationFeedback('Basic finished', 'basic');", sandbox);
    assert.equal(sandbox.optimizerFeedbackByRoute.basic, "Basic finished");
    assert.equal(sandbox.els.routeOptimizeFeedback.textContent, "Basic finished");
    assert.match(app, /setOptimizerFeedback\(message\)\s*\{\s*writeOptimizationFeedback\(message, "google"\);/);
    assert.match(app, /completeActivePlanStop\(/, "existing stop completion remains in app");
});
