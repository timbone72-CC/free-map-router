"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Build Route exposes separate free and test-only Google optimizers", () => {
    const html = read("index.html");
    assert.match(html, /id="optimizeRoute"/);
    assert.match(html, /id="googleOptimizeRoute"/);
    assert.match(html, /Google Optimize \(Test\)/);
    assert.match(html, /id="googleRouteSignIn"/);
    assert.match(html, /google-route-contract\.js\?v=1\.0\.0/);
    assert.match(html, /google-route-browser\.js\?v=1\.0\.0/);
});

test("app owns Google route application through a narrow bridge", () => {
    const app = read("app.js");
    assert.match(app, /globalThis\.FMRRouteBridge = Object\.freeze/);
    assert.match(app, /validateBackendResponse/);
    assert.match(app, /applyOrderedStopIds/);
    assert.match(app, /routeIds = ordered\.map/);
});

test("Google browser adapter does not rewrite route DOM", () => {
    const browser = read("google-route-browser.js");
    assert.doesNotMatch(browser, /MutationObserver/);
    assert.doesNotMatch(browser, /routeList\.innerHTML/);
    assert.doesNotMatch(browser, /querySelectorAll\([^)]*routeList/);
});
