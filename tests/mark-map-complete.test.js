"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Routing = require("../routing.js");
const RouteHistory = require("../route-history.js");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
    const start = app.indexOf("function " + name + "(");
    assert.ok(start !== -1, name + " must exist");
    const open = app.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < app.length; i++) {
        if (app[i] === "{") depth++;
        if (app[i] === "}") depth--;
        if (!depth) return app.slice(start, i + 1);
    }
    throw new Error(name + " has no closing brace");
}

function storage() {
    const values = new Map();
    let writes = 0;
    return {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); writes++; },
        count() { return writes; },
    };
}

function scenario({ accepted = true, stale = false } = {}) {
    const home = { address: "Home" };
    const stops = Array.from({ length: 20 }, (_, index) => ({
        id: "s" + (index + 1),
        address: "Stop " + (index + 1),
    }));
    const routeIds = stops.map((stop) => stop.id);
    const validIds = new Set(routeIds);
    const localStorage = storage();
    const history = RouteHistory.writeRouteHistory(localStorage, {
        version: 6,
        dayContext: {
            routeDate: "2026-11-21",
            departureTime: "08:00",
            preferredFinishTime: "15:00",
            homeByTime: "17:00",
            timeZone: "America/Chicago",
        },
        google: {
            routeIds,
            sourceUpdatedAt: "2026-11-21T12:00:00.000Z",
            optimizationStatus: "google_optimized",
            orderIdsByStopId: { s8: ["ORDER-8"], s9: ["ORDER-9"] },
        },
        basic: {
            routeIds: routeIds.slice().reverse(),
            sourceUpdatedAt: "2026-11-21T12:00:00.000Z",
            optimizationStatus: "basic_optimized",
            orderIdsByStopId: { s8: ["ORDER-8"], s9: ["ORDER-9"] },
        },
        pending: {
            routeIds: ["s20"],
            sourceUpdatedAt: "2026-11-22T12:00:00.000Z",
            optimizationStatus: "not_optimized",
        },
    }, validIds);

    const sandbox = {
        history, localStorage, validIds, RouteHistory, alerts: [], confirms: [],
        rendered: 0, refreshed: 0, accepted,
    };
    const source = [
        'let routeHistory = history;',
        'let routeIds = history.google.routeIds.slice();',
        'let activeRouteSlot = "google";',
        'const routeOrderSendPromise = null;',
        'const els = { routeStatus: { textContent: "" } };',
        'const savedJobIds = () => validIds;',
        'const readRouteHistory = (...args) => RouteHistory.readRouteHistory(...args);',
        'const writeRouteHistory = (...args) => RouteHistory.writeRouteHistory(...args);',
        'const completeActivePlanStop = (...args) => RouteHistory.completeActivePlanStop(...args);',
        'const alert = (message) => alerts.push(message);',
        'const confirm = (message) => { confirms.push(message); return accepted; };',
        'const renderAll = () => { rendered++; };',
        'const renderRouteList = () => { refreshed++; };',
        extractFunction("mapSectionStopIds"),
        extractFunction("markGoogleMapSectionComplete"),
        'this.getSectionIds = mapSectionStopIds;',
        'this.markSection = markGoogleMapSectionComplete;',
        'this.currentStatus = () => els.routeStatus.textContent;',
    ].join("\n");
    vm.runInNewContext(source, sandbox);

    const sections = Routing.buildGoogleMapsRouteSections(home, stops);
    const stopIds = Array.from(sandbox.getSectionIds(sections[1], home, routeIds));
    const expected = {
        planId: history.activePlan.planId,
        planRevision: history.activePlan.revision - (stale ? 1 : 0),
        dayId: history.activePlan.activeDayId,
        slot: "google",
        routeIds: routeIds.slice(),
    };
    return { sandbox, sections, stopIds, expected, localStorage, routeIds, validIds };
}

test("section completion skips shared map origins and Home exactly once", () => {
    const { sections, sandbox, routeIds } = scenario();
    const home = sections[0].origin;
    const all = sections.flatMap((section) =>
        Array.from(sandbox.getSectionIds(section, home, routeIds)));
    assert.deepEqual(all, routeIds);
    assert.equal(sections[1].origin.id, "s7");
    assert.deepEqual(Array.from(sandbox.getSectionIds(sections[1], home, routeIds)),
        ["s8", "s9", "s10", "s11", "s12", "s13", "s14"]);
});

test("Mark Map 2 completes exact work, leaves other maps alone and saves once", () => {
    const { sandbox, stopIds, expected, localStorage, validIds, routeIds } = scenario();
    const writesBefore = localStorage.count();
    sandbox.markSection(2, stopIds, expected);
    const saved = RouteHistory.readRouteHistory(localStorage, validIds);
    const remaining = routeIds.filter((id) => !stopIds.includes(id));
    assert.deepEqual(saved.google.routeIds, remaining);
    assert.deepEqual(saved.basic.routeIds,
        routeIds.slice().reverse().filter((id) => !stopIds.includes(id)));
    assert.deepEqual(saved.activePlan.days[0].completedWorkItems
        .map((item) => item.workItemId).sort(), ["ORDER-8", "ORDER-9"]);
    assert.deepEqual(saved.pending.routeIds, ["s20"]);
    assert.equal(localStorage.count(), writesBefore + 1);
    assert.equal(sandbox.rendered, 1);
    assert.match(sandbox.currentStatus(), /Map 2 completed \(7 stops\)/);
});

test("Cancel keeps every route stop and writes nothing", () => {
    const { sandbox, stopIds, expected, localStorage, validIds, routeIds } =
        scenario({ accepted: false });
    const before = localStorage.count();
    sandbox.markSection(2, stopIds, expected);
    assert.equal(localStorage.count(), before);
    assert.deepEqual(RouteHistory.readRouteHistory(localStorage, validIds).google.routeIds, routeIds);
    assert.equal(sandbox.rendered, 0);
});

test("stale map sections are rejected before confirmation", () => {
    const { sandbox, stopIds, expected, localStorage, validIds, routeIds } =
        scenario({ stale: true });
    const before = localStorage.count();
    sandbox.markSection(2, stopIds, expected);
    assert.equal(localStorage.count(), before);
    assert.deepEqual(RouteHistory.readRouteHistory(localStorage, validIds).google.routeIds, routeIds);
    assert.equal(sandbox.confirms.length, 0);
    assert.match(sandbox.alerts[0], /route changed/i);
});

test("map controls use their section link and confirmation action", () => {
    assert.match(app, /completeButton\.textContent = "Mark Map " \+ section\.number \+ " Complete"/);
    assert.match(app, /completeButton\.addEventListener\("click", \(\) =>\s*markGoogleMapSectionComplete/);
    assert.match(app, /link\.href = section\.url/);
    assert.match(app, /els\.exportRoute\.hidden = multipleMaps/);
});
