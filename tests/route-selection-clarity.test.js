"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function routeChoiceSection() {
    const start = app.indexOf("function routeChoiceStatusLabel");
    const end = app.indexOf(
        'if (els.startNewRoute) {\n    els.startNewRoute.addEventListener',
        start,
    );
    assert.ok(start >= 0, "route choice helpers must exist");
    assert.ok(end > start, "route choice handler boundary must exist");
    return app.slice(start, end);
}

function buildHarness({
    googleStatus = "google_optimized",
    basicStatus = "not_optimized",
    confirmResult = false,
} = {}) {
    const googleOption = { textContent: "", disabled: false };
    const basicOption = { textContent: "", disabled: false };
    let changeHandler = null;
    const routeChoice = {
        value: "google",
        querySelector(selector) {
            if (selector === 'option[value="google"]') return googleOption;
            if (selector === 'option[value="basic"]') return basicOption;
            return null;
        },
        addEventListener(eventName, handler) {
            if (eventName === "change") changeHandler = handler;
        },
    };
    const activated = [];
    const confirmations = [];
    const context = vm.createContext({
        routeHistory: {
            google: {
                routeIds: ["g1", "g2"],
                optimizationStatus: googleStatus,
            },
            basic: {
                routeIds: ["b2", "b1"],
                optimizationStatus: basicStatus,
            },
            pending: null,
        },
        activeRouteSlot: "google",
        routeIds: ["g1", "g2"],
        els: {
            routeChoice,
            workbookRouteOrderStatus: null,
            routeStatus: null,
            newRouteAvailable: null,
            homeAddress: null,
            homeStatus: null,
            geoapifyKey: null,
            geoapifyKeyStatus: null,
        },
        confirm(message) {
            confirmations.push(String(message || ""));
            return confirmResult;
        },
        activateRouteSlot(slot) {
            activated.push(slot);
            context.activeRouteSlot = slot;
            context.routeIds = context.routeHistory[slot].routeIds.slice();
        },
        renderJobsList() {},
        renderRouteList() {},
        ensureSelectionControls() {},
        renderHome() {},
        renderNewRouteAvailable() {},
        renderSettings() {},
        readGeoapifyKey() {
            return "";
        },
        localStorage: {},
        showHomeLocationMap() {},
        home: null,
        homeDraftLatitude: null,
        homeDraftLongitude: null,
        homeDraftPinStatus: "unverified",
    });

    vm.runInContext(routeChoiceSection(), context);
    return {
        context,
        routeChoice,
        googleOption,
        basicOption,
        activated,
        confirmations,
        change: () => changeHandler?.(),
        render: () => vm.runInContext("renderRouteChoice()", context),
    };
}

test("route selector labels exact saved state and cancel keeps the optimized Google order displayed", () => {
    const harness = buildHarness({ confirmResult: false });
    harness.render();

    assert.equal(harness.googleOption.textContent, "Google Route — Optimized");
    assert.equal(harness.basicOption.textContent, "Basic Route — Not Optimized");

    harness.routeChoice.value = "basic";
    harness.change();

    assert.deepEqual(harness.activated, []);
    assert.equal(harness.context.activeRouteSlot, "google");
    assert.deepEqual(harness.context.routeIds, ["g1", "g2"]);
    assert.equal(harness.routeChoice.value, "google");
    assert.equal(harness.confirmations.length, 1);
    assert.match(harness.confirmations[0], /Basic Route is Not Optimized/);
    assert.match(harness.confirmations[0], /Google Route is Optimized/);
    assert.match(harness.confirmations[0], /will stay saved/);
});

test("confirming the warning deliberately switches to the unoptimized Basic saved route", () => {
    const harness = buildHarness({ confirmResult: true });
    harness.render();

    harness.routeChoice.value = "basic";
    harness.change();

    assert.deepEqual(harness.activated, ["basic"]);
    assert.equal(harness.context.activeRouteSlot, "basic");
    assert.deepEqual(harness.context.routeIds, ["b2", "b1"]);
    assert.equal(harness.confirmations.length, 1);
});

test("switching between two prepared routes remains immediate", () => {
    const harness = buildHarness({
        basicStatus: "basic_optimized",
        confirmResult: false,
    });
    harness.render();

    assert.equal(harness.basicOption.textContent, "Basic Route — Optimized");
    harness.routeChoice.value = "basic";
    harness.change();

    assert.deepEqual(harness.activated, ["basic"]);
    assert.equal(harness.confirmations.length, 0);
});
