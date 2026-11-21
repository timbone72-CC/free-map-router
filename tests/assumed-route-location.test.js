"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assumed = require("../assumed-route-location.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const savedStops = [
    { id: "first", address: "111 Main Street, Elk City, OK" },
    { id: "second", address: "222 Oak Avenue, Elk City, OK" },
];

function plan() {
    return {
        activePlan: {
            planId: "plan-1",
            activeDayId: "day-1",
            days: [{
                dayId: "day-1",
                dayContext: { routeDate: "2026-11-21" },
                google: { routeIds: ["first", "second"] },
                basic: { routeIds: ["first", "second"] },
            }],
        },
    };
}

function memoryStorage() {
    const entries = new Map();
    const writes = [];
    return {
        entries, writes,
        getItem(key) { return entries.get(key) ?? null; },
        setItem(key, value) {
            assert.equal(key, assumed.STORAGE_KEY, "never write any Route Plan or workbook key");
            writes.push([key, String(value)]);
            entries.set(key, String(value));
        },
    };
}

test("assumed location is device-local and changes only after explicit Continue", () => {
    const history = plan();
    const storage = memoryStorage();
    assert.equal(assumed.read(storage, history, "google", savedStops), null);

    const candidate = assumed.prepare(history, "google", "second", savedStops);
    // Displaying or Canceling a confirmation does not persist a location.
    assert.equal(storage.writes.length, 0);
    assert.equal(assumed.read(storage, history, "google", savedStops), null);

    const original = JSON.stringify(history);
    assumed.confirm(storage, candidate, history, "google", savedStops);
    assert.equal(storage.writes.length, 1);
    assert.equal(assumed.read(storage, history, "google", savedStops).stopId, "second");
    assert.equal(JSON.stringify(history), original, "no job completion or route mutation");

    // Refresh reads only the same browser's opt-in selection.
    const anotherBrowser = memoryStorage();
    assert.equal(assumed.read(anotherBrowser, history, "google", savedStops), null);
    assumed.confirm(
        storage,
        assumed.prepare(history, "google", "first", savedStops),
        history,
        "google",
        savedStops,
    );
    assert.equal(assumed.read(storage, history, "google", savedStops).stopId, "first");
    assert.equal(storage.writes.length, 2);
});

test("assumed location disappears when current route day, plan, slot, address, or route membership changes", () => {
    const history = plan(), storage = memoryStorage();
    const selected = assumed.prepare(history, "google", "second", savedStops);
    assumed.confirm(storage, selected, history, "google", savedStops);
    assert.equal(assumed.read(storage, history, "basic", savedStops), null);

    const differentPlan = plan();
    differentPlan.activePlan.planId = "plan-2";
    assert.equal(assumed.read(storage, differentPlan, "google", savedStops), null);

    const differentDay = plan();
    differentDay.activePlan.activeDayId = "day-2";
    differentDay.activePlan.days.push({
        dayId: "day-2", dayContext: { routeDate: "2026-11-22" },
        google: { routeIds: ["first", "second"] },
    });
    assert.equal(assumed.read(storage, differentDay, "google", savedStops), null);

    const differentDate = plan();
    differentDate.activePlan.days[0].dayContext.routeDate = "2026-11-22";
    assert.equal(assumed.read(storage, differentDate, "google", savedStops), null);

    const removedFromRoute = plan();
    removedFromRoute.activePlan.days[0].google.routeIds = ["first"];
    assert.equal(assumed.read(storage, removedFromRoute, "google", savedStops), null);

    assert.equal(assumed.read(storage, history, "google", savedStops.slice(0, 1)), null);
    assert.equal(storage.writes.length, 1, "invalidation performs no write");
});

test("Continue refuses stale or invalid selection without writing", () => {
    const history = plan(), storage = memoryStorage();
    const selected = assumed.prepare(history, "google", "second", savedStops);
    const changed = plan();
    changed.activePlan.days[0].google.routeIds = ["first"];
    assert.throws(
        () => assumed.confirm(storage, selected, changed, "google", savedStops),
        /route changed/i,
    );
    assert.throws(
        () => assumed.prepare(history, "google", "missing", savedStops),
        /no longer on the active route/i,
    );
    assert.equal(storage.writes.length, 0);
    storage.entries.set(assumed.STORAGE_KEY, "{bad json");
    assert.equal(assumed.read(storage, history, "google", savedStops), null);
});

test("Heading Here has a separate Continue/Cancel modal and indicator, with no change to Done", () => {
    for (const id of [
        "assumedRouteLocationStatus",
        "assumedRouteLocationDialog",
        "assumedRouteLocationAddress",
        "assumedRouteLocationDescription",
        "assumedRouteLocationContinue",
        "assumedRouteLocationCancel",
    ]) {
        assert.equal(html.split('id="' + id + '"').length - 1, 1);
    }
    assert.match(html, /<dialog id="assumedRouteLocationDialog"/);
    assert.match(html, /assumed-route-location\.js\?v=1\.0\.0/);
    assert.ok(html.indexOf("assumed-route-location.js?v=") < html.indexOf("app.js?v="));
    assert.match(html, /app\.js\?v=3\.34\.18/);
    assert.match(app, /headingHereBtn\.textContent = "Heading Here"/);
    assert.match(app, /beginAssumedRouteLocation\(card\.stopId\)/);
    assert.match(app, /renderAssumedRouteLocationStatus\(\);\s*renderPlannerDaySummary/);
    assert.doesNotMatch(
        app.slice(app.indexOf("// Heading Here is a device-local assumption"),
            app.indexOf("function focusPlannerStop(")),
        /completeActivePlanStop|persistActiveRoute|writeRouteHistory|window\.open|fetch\(/,
    );
});

test("Continue and Cancel in the real app handler only persist confirmed selection", () => {
    let history = plan();
    const storage = memoryStorage();
    const handlers = {};
    const dialog = {
        open: false,
        addEventListener(type, handler) { handlers["dialog:" + type] = handler; },
        showModal() { this.open = true; },
        close() { this.open = false; handlers["dialog:close"]?.(); },
    };
    const button = (name) => ({
        addEventListener(type, handler) { handlers[name + ":" + type] = handler; },
    });
    const status = { hidden: true, textContent: "" };
    const description = { textContent: "" };
    const ctx = {
        els: {
            assumedRouteLocationDialog: dialog,
            assumedRouteLocationStatus: status,
            assumedRouteLocationAddress: { textContent: "" },
            assumedRouteLocationDescription: description,
            assumedRouteLocationContinue: button("continue"),
            assumedRouteLocationCancel: button("cancel"),
            routeStatus: { textContent: "" },
        },
        localStorage: storage,
        routeHistory: history,
        activeRouteSlot: "google",
        jobs: savedStops,
        globalThis: { FMRAssumedRouteLocation: assumed },
        savedJobIds: () => new Set(["first", "second"]),
        readRouteHistory: () => history,
    };
    const begin = app.indexOf("// Heading Here is a device-local assumption");
    const end = app.indexOf("function focusPlannerStop(", begin);
    assert.ok(begin > -1 && end > begin);
    vm.runInNewContext(
        "let pendingAssumedRouteLocation = null;\n" + app.slice(begin, end) +
            "\nglobalThis.testHeading = { beginAssumedRouteLocation, renderAssumedRouteLocationStatus };",
        ctx,
    );
    const ui = ctx.globalThis.testHeading;
    assert.equal(ui.beginAssumedRouteLocation("second"), true);
    assert.equal(dialog.open, true);
    assert.equal(ctx.els.assumedRouteLocationAddress.textContent, savedStops[1].address);
    handlers["cancel:click"]();
    assert.equal(dialog.open, false);
    assert.equal(storage.writes.length, 0);
    ui.renderAssumedRouteLocationStatus();
    assert.equal(status.hidden, true);

    ui.beginAssumedRouteLocation("second");
    handlers["continue:click"]();
    assert.equal(dialog.open, false);
    assert.equal(storage.writes.length, 1);
    assert.equal(status.hidden, false);
    assert.match(status.textContent, /Assumed location: 222 Oak Avenue.*not GPS/);

    ui.beginAssumedRouteLocation("first");
    // Route changed between opening the dialog and pressing Continue.
    history = plan();
    history.activePlan.planId = "plan-next";
    ctx.routeHistory = history;
    assert.equal(handlers["continue:click"](), undefined);
    assert.match(description.textContent, /route changed/i);
    assert.equal(storage.writes.length, 1);
    handlers["cancel:click"]();
    ui.renderAssumedRouteLocationStatus();
    assert.equal(status.hidden, true);
});
