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
    setAttribute(name, value) {
        this[name] = value;
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
        startEditJob: (id, returnToRoute) => calls.push("edit:" + id + ":" + Boolean(returnToRoute)),
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
    assert.deepEqual(ui.calls, ["page:addresses", "edit:stop-2:true"]);
    assert.deepEqual(ui.routeIds, ["stop-1", "stop-2"]);
});

test("route-card Edit does nothing when the saved stop no longer exists", () => {
    const ui = renderTestCard([]);
    ui.edit.listeners.click({ stopPropagation() {} });
    assert.equal(ui.addEditView.checked, false);
    assert.deepEqual(ui.calls, []);
    assert.deepEqual(ui.routeIds, ["stop-1", "stop-2"]);
});

function makeSaveHarness({ routeOrigin = false, failSave = false } = {}) {
    const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
    const editorBegin = source.indexOf("function resetForm() {");
    const editorEnd = source.indexOf("\nfunction updateLocationPreview(", editorBegin);
    const saveBegin = source.indexOf('if (els.jobForm) {\n    els.jobForm.addEventListener("submit"');
    const saveEnd = source.indexOf("\nif (els.address) {", saveBegin);
    assert.ok(editorBegin >= 0 && editorEnd > editorBegin);
    assert.ok(saveBegin >= 0 && saveEnd > saveBegin);

    const calls = [];
    const handlers = {};
    const routeIds = ["stop-1", "stop-2"];
    const saved = [
        { id: "stop-1", address: "111 First St" },
        { id: "stop-2", address: "222 Second St" },
    ];
    const addressInput = { value: "", focus() {} };
    const els = {
        jobForm: {
            addEventListener(eventName, fn) { handlers[eventName] = fn; },
            reset() { calls.push("reset"); },
        },
        address: addressInput,
        label: { value: "" },
        latitude: { value: "" },
        longitude: { value: "" },
        notes: { value: "" },
        locationMap: { hidden: true },
        locationPreview: { hidden: true, removeAttribute() {} },
        locationStatus: { textContent: "" },
    };
    const editedCard = {
        dataset: { stopId: "stop-2" },
        scrollIntoView(options) { calls.push("scroll:" + options.block); },
    };
    const sandbox = {
        els,
        jobs: saved,
        routeIds,
        routeHistory: { google: { routeIds: routeIds.slice() } },
        activeRouteSlot: "google",
        localStorage: {},
        normalizeAddress: (value) => String(value || "").trim(),
        toNumberOrNull: (value) => value ? Number(value) : null,
        applyStopEdit: (records, id, draft) => {
            calls.push("save:" + id);
            if (failSave) throw new Error("Correction rejected");
            return {
                stops: records.map((job) => job.id === id ? { ...job, address: draft.address } : job),
                idRemap: {},
            };
        },
        writeStops: (_storage, records) => records,
        remapRouteStopIds: (history) => history,
        savedJobIds: () => new Set(saved.map((job) => job.id)),
        writeRouteHistory: (_storage, history) => history,
        proposeStreetCorrection: () => null,
        savePermanentAddressCorrections: () => Promise.resolve(),
        refreshAddressSuggestions() {},
        renderAll: () => calls.push("render"),
        showPage: (page) => calls.push("page:" + page),
        focusPlannerStop: (id) => {
            calls.push("focus:" + id);
            return routeIds.includes(id);
        },
        document: {
            querySelectorAll: (selector) => {
                assert.equal(selector, "#routeList > li[data-stop-id]");
                return [editedCard];
            },
        },
        alert: (message) => calls.push("alert:" + message),
    };
    vm.runInNewContext(
        "let editingJobId = null; let routeEditReturnStopId = null; let formPinStatus = \"unverified\";\n" +
        source.slice(editorBegin, editorEnd) + "\n" +
        source.slice(saveBegin, saveEnd) +
        "\nglobalThis.startEditForTest = startEditJob;",
        sandbox,
    );
    sandbox.startEditForTest("stop-2", routeOrigin);
    addressInput.value = "222 Revised St";
    return {
        calls,
        routeIds,
        submit: () => handlers.submit({ preventDefault() {} }),
    };
}

test("saving a route-originated address returns to its stop and preserves route membership", async () => {
    const editor = makeSaveHarness({ routeOrigin: true });
    await editor.submit();
    assert.ok(editor.calls.includes("save:stop-2"));
    assert.deepEqual(
        editor.calls.filter((call) => call.startsWith("page:") || call.startsWith("focus:") || call.startsWith("scroll:")),
        ["page:route", "focus:stop-2", "scroll:nearest"],
    );
    assert.deepEqual(editor.routeIds, ["stop-1", "stop-2"]);
});

test("address-page edits do not automatically navigate back to Build Route", async () => {
    const editor = makeSaveHarness({ routeOrigin: false });
    await editor.submit();
    assert.ok(editor.calls.includes("save:stop-2"));
    assert.equal(editor.calls.some((call) => call.startsWith("page:")), false);
    assert.deepEqual(editor.routeIds, ["stop-1", "stop-2"]);
});

test("a failed route-originated save stays in the editor", async () => {
    const editor = makeSaveHarness({ routeOrigin: true, failSave: true });
    await editor.submit();
    assert.ok(editor.calls.includes("alert:Correction rejected"));
    assert.equal(editor.calls.some((call) => call.startsWith("page:")), false);
    assert.equal(editor.calls.includes("reset"), false);
    assert.deepEqual(editor.routeIds, ["stop-1", "stop-2"]);
});
