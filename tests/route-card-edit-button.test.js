const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.dataset = {};
        this.listeners = {};
        this.classList = { add() {} };
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    append(...children) {
        this.children.push(...children);
    }

    addEventListener(name, handler) {
        this.listeners[name] = handler;
    }
}

function renderTestCard(savedStops) {
    const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
    const start = source.indexOf("function plannerCard(card, index, timeZone) {");
    const end = source.indexOf("\nfunction clearPlannerMarkers()", start);
    assert.ok(start >= 0 && end > start, "plannerCard must remain in app.js");

    const calls = [];
    const addEditView = { checked: false };
    const routeIds = ["stop-1", "stop-2"];
    const context = {
        document: {
            createElement: (tagName) => new FakeElement(tagName),
            getElementById: (id) => id === "addressViewAddEdit" ? addEditView : null,
        },
        routeIds,
        jobs: savedStops,
        plannerFocusedStopId: null,
        plannerStopHeader: () => new FakeElement("header"),
        plannerWorkRows: () => new FakeElement("div"),
        els: { completeAndNavigateNext: null },
        showPage: (page) => calls.push("page:" + page),
        startEditJob: (id) => calls.push("edit:" + id),
        persistActiveRoute: () => { throw new Error("Edit must not alter route"); },
        renderRouteList: () => { throw new Error("Edit must not rerender route"); },
        renderJobsList: () => { throw new Error("Edit must not change selection"); },
    };
    const plannerCard = vm.runInNewContext(
        source.slice(start, end) + "\nplannerCard;",
        context,
    );
    const card = plannerCard({ stopId: "stop-2", address: "Test address", workItems: [] }, 1, "America/Chicago");
    const actions = card.children.find((child) => child.className === "plannerCardActions");
    assert.ok(actions);
    const edit = actions.children.find((child) => child.textContent === "Edit");
    const remove = actions.children.find((child) => child.textContent === "Remove");
    assert.ok(edit && remove, "Edit and Remove actions must be visible");
    assert.equal(actions.children.indexOf(edit) + 1, actions.children.indexOf(remove));
    assert.equal(edit.type, "button");
    return { edit, routeIds, addEditView, calls };
}

test("route-card Edit opens the existing saved-address editor without changing the route", () => {
    const ui = renderTestCard([{ id: "stop-2", address: "Test address" }]);
    let stopped = false;
    ui.edit.listeners.click({ stopPropagation: () => { stopped = true; } });
    assert.equal(stopped, true);
    assert.equal(ui.addEditView.checked, true);
    assert.deepEqual(ui.calls, ["page:addresses", "edit:stop-2"]);
    assert.deepEqual(ui.routeIds, ["stop-1", "stop-2"]);
});

test("route-card Edit does nothing when the saved stop no longer exists", () => {
    const ui = renderTestCard([]);
    ui.edit.listeners.click({ stopPropagation() {} });
    assert.equal(ui.addEditView.checked, false);
    assert.deepEqual(ui.calls, []);
    assert.deepEqual(ui.routeIds, ["stop-1", "stop-2"]);
});
