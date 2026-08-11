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
    assert.match(html, /Google Route: Not Optimized/);
    assert.match(app, /function renderRouteOptimizationStatus/);
    assert.match(app, /Basic Route/);
    assert.match(app, /Google Optimized/);
    assert.match(app, /Basic Optimized/);
    assert.match(app, /Manually Changed/);
});

test("each optimizer records its route source", () => {
    assert.match(
        app,
        /optimizeSelectedRoute[\s\S]*activateRouteSlot\("basic"\)[\s\S]*persistRouteSlot\([\s\S]*"basic"[\s\S]*"basic_optimized"/,
    );
    assert.match(
        app,
        /applyGoogleRouteResult[\s\S]*persistRouteSlot\("google", googleRouteIds, "google_optimized"\)/,
    );
});

test("optimizer results remain bound to their own slot if selection changes", () => {
    assert.match(
        app,
        /const basicRouteIds = routeIds\.slice\(\)[\s\S]*prepareMissingRouteCoordinates\([\s\S]*basicRouteIds[\s\S]*persistRouteSlot\([\s\S]*"basic"/,
    );
    assert.match(
        app,
        /applyGoogleRouteResult[\s\S]*routeHistory\.google\?\.routeIds[\s\S]*persistRouteSlot\("google"/,
    );
});

test("Build Route exposes two named route slots and the controlled pending action", () => {
    assert.match(html, /option value="google">Google Route/);
    assert.match(html, /option value="basic">Basic Route/);
    assert.match(html, /id="newRouteAvailable"/);
    assert.match(html, /id="startNewRoute"/);
    assert.match(app, /New Route Available/);
    assert.match(app, /startPendingRoute/);
    assert.doesNotMatch(html, />Current Route<|>Previous Route</);
});

test("workbook receipt cannot activate a route before confirmed Start New Route", () => {
    const inboxPath = app.slice(
        app.indexOf("async function syncWorkbookInboxFrom"),
        app.indexOf("if (els.backupGoogleDrive)"),
    );
    const startHandler = app.slice(
        app.indexOf("if (els.startNewRoute)"),
        app.indexOf("// ============================================================================\n// SECTION 9"),
    );

    assert.match(inboxPath, /stageWorkbookRoute/);
    assert.doesNotMatch(inboxPath, /activeRouteSlot\s*=/);
    assert.ok(
        startHandler.indexOf("confirm(") <
            startHandler.indexOf("startPendingRoute("),
    );
    assert.match(startHandler, /activeRouteSlot = "google"/);
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
