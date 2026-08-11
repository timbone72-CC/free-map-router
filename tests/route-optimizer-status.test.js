"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Build Route owns one persistent optimizer status display", () => {
    assert.match(html, /id="routeOptimizationStatus"/);
    assert.match(html, /Current route: Not Optimized/);
    assert.match(app, /function renderRouteOptimizationStatus/);
    assert.match(app, /Previous route/);
    assert.match(app, /Google Optimized/);
    assert.match(app, /Basic Optimized/);
    assert.match(app, /Manually Changed/);
});

test("each optimizer records its route source", () => {
    assert.match(
        app,
        /optimizeRoundTripOrder[\s\S]*persistActiveRoute\("basic_optimized"\)/,
    );
    assert.match(
        app,
        /applyGoogleRouteResult[\s\S]*persistActiveRoute\("google_optimized"\)/,
    );
});

test("manual route-order controls invalidate an optimizer label", () => {
    const routeRenderer = app.slice(
        app.indexOf("function renderRouteList"),
        app.indexOf("function renderRouteChoice"),
    );
    assert.match(
        routeRenderer,
        /upBtn\.addEventListener[\s\S]*persistActiveRoute\("manually_changed"\)/,
    );
    assert.match(
        routeRenderer,
        /downBtn\.addEventListener[\s\S]*persistActiveRoute\("manually_changed"\)/,
    );
});

test("clearing or completing the final stop resets an empty route", () => {
    assert.match(
        app,
        /function clearRouteSelection\(\)[\s\S]*persistActiveRoute\("not_optimized"\)/,
    );
    assert.match(
        app,
        /nextRouteIds\.length === 0 \? "not_optimized" : null/,
    );
});
