"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

class FakeNode {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.parent = null;
        this.listeners = {};
        this.classList = { add() {} };
    }
    detach(node) {
        if (!node.parent) return;
        node.parent.children = node.parent.children.filter((child) => child !== node);
        node.parent = null;
    }
    appendChild(node) {
        this.detach(node);
        this.children.push(node);
        node.parent = this;
        return node;
    }
    append(...nodes) {
        for (const node of nodes) this.appendChild(node);
    }
    prepend(node) {
        this.detach(node);
        this.children.unshift(node);
        node.parent = this;
    }
    addEventListener(type, handler) {
        this.listeners[type] = handler;
    }
}

function cardActions(card) {
    return card.children.find((node) => node.className === "plannerCardActions");
}

function setup() {
    const begin = app.indexOf("function plannerCard(card, index, timeZone) {");
    const end = app.indexOf("function clearPlannerMarkers()", begin);
    assert.ok(begin >= 0 && end > begin, "planner card owner found");
    const done = new FakeNode("button");
    done.id = "completeAndNavigateNext";
    const onDone = () => "existing completion handler";
    done.addEventListener("click", onDone);
    const sandbox = {
        document: { createElement: (tag) => new FakeNode(tag) },
        routeIds: ["first", "second"],
        els: { completeAndNavigateNext: done },
        plannerFocusedStopId: null,
        plannerStopHeader: () => new FakeNode("span"),
        plannerWorkRows: () => new FakeNode("div"),
        persistActiveRoute: () => {},
        markRouteManuallyChanged: () => "manually_changed",
        renderRouteList: () => {},
        renderJobsList: () => {},
        focusPlannerStop: () => {},
    };
    vm.runInNewContext(app.slice(begin, end) + "\nglobalThis.makeCard = plannerCard;", sandbox);
    return { sandbox, done, onDone };
}

test("only current first stop card receives the original completion button", () => {
    const { sandbox, done, onDone } = setup();
    const first = sandbox.makeCard({ stopId: "first" }, 0, "UTC");
    const second = sandbox.makeCard({ stopId: "second" }, 1, "UTC");
    const firstActions = cardActions(first);
    const secondActions = cardActions(second);
    assert.equal(firstActions.children[0], done, "Done comes before Up / Down / Remove");
    assert.equal(firstActions.children.length, 4);
    assert.equal(secondActions.children.length, 3, "later stop cannot prematurely complete");
    assert.equal(done.listeners.click, onDone, "existing click handler stays attached");
});

test("after advancing to the next stop, the same Done button moves with it", () => {
    const { sandbox, done, onDone } = setup();
    const first = sandbox.makeCard({ stopId: "first" }, 0, "UTC");
    const previousActions = cardActions(first);
    sandbox.routeIds = ["second"];
    const newCurrent = sandbox.makeCard({ stopId: "second" }, 0, "UTC");
    const nextActions = cardActions(newCurrent);
    assert.equal(nextActions.children[0], done);
    assert.equal(done.parent, nextActions);
    assert.ok(!previousActions.children.includes(done));
    assert.equal(done.listeners.click, onDone, "reparenting doesn't replace navigation logic");
});

test("no Done button on any non-current stop, even if supplied as first card", () => {
    const { sandbox, done } = setup();
    const other = sandbox.makeCard({ stopId: "second" }, 0, "UTC");
    assert.ok(!cardActions(other).children.includes(done));
    assert.equal(done.parent, null);
});

test("the existing global Done control and completion function remain unchanged", () => {
    assert.equal(html.split('id="completeAndNavigateNext"').length - 1, 1);
    assert.match(app, /els\.completeAndNavigateNext\.addEventListener\(\s*"click",\s*completeCurrentStopAndNavigate,\s*\);/);
    const begin = app.indexOf("function completeCurrentStopAndNavigate()");
    const end = app.indexOf("function startCurrentStopNavigation()", begin);
    const completion = app.slice(begin, end);
    assert.match(completion, /const currentStopId = routeIds\[0\];/);
    assert.match(completion, /completeActivePlanStop\(/);
    assert.match(completion, /window\.open\(url, "_blank"\);/);
});
