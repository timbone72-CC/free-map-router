"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const googleBrowser = read("google-route-browser.js");

function routeTools() {
    const start = html.indexOf('<details class="plannerUtilities">');
    const end = html.indexOf("</details>", start);
    assert.ok(start > -1 && end > start, "Route tools dropdown exists");
    return html.slice(start, end + "</details>".length);
}

test("both optimizers and Google sign-in live near the top inside route tools", () => {
    const tools = routeTools();
    const optimizer = tools.indexOf('id="optimizeRoute"');
    const google = tools.indexOf('id="googleOptimizeRoute"');
    const signIn = tools.indexOf('id="googleRouteSignIn"');
    const auth = tools.indexOf('id="googleRouteAuthStatus"');
    const progress = tools.indexOf('id="routeOptimizeFeedback"');
    const otherTools = tools.indexOf('id="exportRoute"');

    assert.ok(optimizer > 0 && google > optimizer);
    assert.ok(signIn > google && auth > signIn && progress > auth);
    assert.ok(otherTools > progress, "optimizer feedback appears before maintenance tools");
    for (const id of [
        "optimizeRoute", "googleOptimizeRoute", "googleRouteSignIn",
        "googleRouteAuthStatus", "routeOptimizeFeedback",
    ]) {
        assert.equal(html.split('id="' + id + '"').length - 1, 1, id + " stays unique");
    }
    assert.match(tools, /id="routeOptimizeFeedback"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.ok(html.indexOf('id="routePlanControls"') > html.indexOf('<details class="plannerUtilities">'));
});

test("general route status remains outside the dropdown for non-optimization actions", () => {
    const tools = routeTools();
    assert.doesNotMatch(tools, /id="routeStatus"/);
    assert.match(html.slice(html.indexOf('id="routeActionsHeading"')), /id="routeStatus"/);
    assert.match(html, /id="startRouteNavigation"/);
    assert.match(html, /id="completeAndNavigateNext"/);
});

test("Basic optimization updates the new live feedback and previous route status", () => {
    assert.match(app, /routeOptimizeFeedback: document\.getElementById\("routeOptimizeFeedback"\)/);
    assert.match(app, /function writeOptimizationFeedback\(message\)/);
    assert.match(app, /els\.routeOptimizeFeedback\.textContent = value;/);
    assert.match(app, /els\.routeStatus\.textContent = value;/);
    const basic = app.slice(app.indexOf("async function optimizeSelectedRoute()"), app.indexOf("function exportToGoogleMaps()"));
    assert.match(basic, /writeOptimizationFeedback\("Preparing Basic Route…"/);
    assert.match(basic, /writeOptimizationFeedback\("Optimizing Basic Route…"/);
    assert.match(basic, /writeOptimizationFeedback\(\s*error\?\.message/);
    assert.match(basic, /writeOptimizationFeedback\(\s*`Basic Route optimized/);
});

test("Google optimizer uses the dedicated progress bridge without hijacking inbox status", () => {
    assert.match(app, /setOptimizerFeedback\(message\)\s*\{\s*writeOptimizationFeedback\(message\);/);
    assert.match(googleBrowser, /function setOptimizationStatus\(message\)/);
    assert.match(googleBrowser, /bridge\.setOptimizerFeedback\(value\)/);
    const optimize = googleBrowser.slice(
        googleBrowser.indexOf('optimizeButton.addEventListener("click", async () => {'),
        googleBrowser.indexOf('runtimeRoot.addEventListener?.("focus"'),
    );
    assert.match(optimize, /setOptimizationStatus\("Preparing work times and selected addresses for Google…"/);
    assert.match(optimize, /"Google is calculating the traffic-aware workday…"/);
    assert.match(optimize, /setOptimizationStatus\(\s*`Google road route applied/);
    assert.match(optimize, /setOptimizationStatus\(error\?\.message/);
    assert.doesNotMatch(optimize, /setStatus\(/);
    assert.match(googleBrowser, /setStatus\("Checking for new route…"/);
});
