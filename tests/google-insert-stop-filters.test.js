"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const filters = require("../address-filters.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function select(value = "") {
    const element = {
        value, options: [], disabled: false,
        replaceChildren() { this.options = []; this.value = ""; },
        appendChild(child) { this.options.push(child); },
    };
    Object.defineProperty(element, "textContent", {
        set(value) {
            if (!value) element.replaceChildren();
        },
    });
    return element;
}

function setup() {
    const stops = [
        { id: "elk-main", address: "121 Main St, Elk City, OK 73644", county: "Beckham", label: "First inspection" },
        { id: "elk-oak", address: "344 Oak St, Elk City, OK 73644", county: "Beckham", notes: "Tall gate" },
        { id: "lawton", address: "777 Elm St, Lawton, OK", county: "Comanche", label: "Another job" },
        { id: "unmapped", address: "800 NORTHERN 55", notes: "No reliable city" },
        { id: "already", address: "889 Center St, Lawton, OK", county: "Comanche", notes: "Already routed" },
    ];
    const elements = {
        googleInsertStopSearch: { value: "" },
        googleInsertStopCity: select("All"),
        googleInsertStopCounty: select("All"),
        googleInsertStopChoice: select(),
        googleInsertStop: { disabled: true },
    };
    const storage = {
        getItem() { return null; },
        setItem() { throw new Error("Filter must never write saved data"); },
    };
    const fixture = {
        jobs: stops,
        els: elements,
        localStorage: storage,
        home: { address: "Home" },
        activeRouteSlot: "google",
        googleInsertionBusy: false,
        routeOrderSendPromise: null,
        document: { createElement(tag) {
            assert.equal(tag, "option");
            return { value: "", textContent: "" };
        } },
        readRouteHistory() { return { google: { routeIds: ["already"] } }; },
        savedJobIds() { return new Set(stops.map((stop) => stop.id)); },
        globalThis: {
            FMRAddressFilters: filters,
            FMRRouteHistory: {
                canInsertSavedStop(_history, id) { return id !== "already"; },
            },
        },
    };
    const beginHelper = app.indexOf("function updateAddressFilterOptions(");
    const endHelper = app.indexOf("\nfunction getFilteredAddressRows(", beginHelper);
    const begin = app.indexOf("function googleInsertionCandidates(");
    const end = app.indexOf("\nfunction googleInsertionContext(", begin);
    assert.ok(beginHelper >= 0 && endHelper > beginHelper);
    assert.ok(begin >= 0 && end > begin);
    vm.runInNewContext(
        app.slice(beginHelper, endHelper) + "\n" + app.slice(begin, end),
        fixture,
    );
    const render = () => vm.runInNewContext("renderGoogleInsertionChoices()", fixture);
    const visible = () => elements.googleInsertStopChoice.options
        .filter((item) => item.value)
        .map((item) => item.value);
    return { stops, elements, fixture, render, visible };
}

test("Build Route has compact searchable insert-only address, City, County and exact-stop controls", () => {
    const region = html.slice(html.indexOf('aria-label="Search insertable saved addresses"'), html.indexOf('id="routeOptimizeFeedback"'));
    for (const id of [
        "googleInsertStopSearch",
        "googleInsertStopCity",
        "googleInsertStopCounty",
        "googleInsertStopChoice",
        "googleInsertStop",
    ]) {
        assert.match(region, new RegExp('id="' + id + '"'));
    }
    assert.match(region, /All cities/);
    assert.match(region, /All counties/);
    assert.match(html, /app\.js\?v=3\.34\.16/);
    assert.match(app, /els\.googleInsertStopSearch[\s\S]*els\.googleInsertStopCity[\s\S]*els\.googleInsertStopCounty/);
    assert.match(app, /filter === els\.googleInsertStopSearch \? "input" : "change"/);
});

test("city and county choices come only from eligible saved stops and do not guess unknown metadata", () => {
    const { elements, render, visible } = setup();
    render();
    assert.deepEqual(visible(), ["elk-main", "elk-oak", "lawton", "unmapped"]);
    assert.deepEqual(elements.googleInsertStopCity.options.map((o) => o.value), [
        "All", "Elk City", "Lawton", "Unknown town",
    ]);
    assert.deepEqual(elements.googleInsertStopCounty.options.map((o) => o.value), [
        "All", "Beckham", "Comanche", "Unknown county",
    ]);
    assert.equal(elements.googleInsertStopChoice.options.some((o) => o.value === "already"), false);
});

test("city and county filters combine with search by street, label and notes", () => {
    const { elements, render, visible } = setup();
    render();
    elements.googleInsertStopCity.value = "Elk City";
    elements.googleInsertStopCounty.value = "Beckham";
    elements.googleInsertStopSearch.value = "first inspection";
    render();
    assert.deepEqual(visible(), ["elk-main"]);
    elements.googleInsertStopSearch.value = "oak gate";
    render();
    assert.deepEqual(visible(), ["elk-oak"]);
    elements.googleInsertStopCounty.value = "Comanche";
    render();
    assert.deepEqual(visible(), []);
    assert.equal(elements.googleInsertStop.disabled, true);
    assert.match(elements.googleInsertStopChoice.options[0].textContent, /No matching/);
    elements.googleInsertStopCity.value = "All";
    elements.googleInsertStopCounty.value = "Comanche";
    elements.googleInsertStopSearch.value = "Lawton";
    render();
    assert.deepEqual(visible(), ["lawton"]);
});

test("a new saved Oklahoma town automatically adds its verified county without adding a statewide city list", () => {
    const { stops, elements, render, visible } = setup();
    render();
    assert.equal(elements.googleInsertStopCity.options.some((option) => option.value === "Vici"), false);
    assert.equal(elements.googleInsertStopCounty.options.some((option) => option.value === "Dewey"), false);

    stops.push({ id: "vici-new", address: "255 Main St, Vici, OK 73859" });
    render();
    assert.equal(elements.googleInsertStopCity.options.some((option) => option.value === "Vici"), true);
    assert.equal(elements.googleInsertStopCounty.options.some((option) => option.value === "Dewey"), true);

    elements.googleInsertStopCounty.value = "Dewey";
    render();
    assert.deepEqual(visible(), ["vici-new"]);
    elements.googleInsertStopCity.value = "Vici";
    render();
    assert.deepEqual(visible(), ["vici-new"]);
});

test("typing house-number digits only returns addresses starting with those digits in chosen city/county", () => {
    const { stops, elements, render, visible } = setup();
    stops.push(
        { id: "one-first", address: "100 North 1st Ave, Elk City, OK 73644", county: "Beckham" },
        { id: "one-two", address: "123 Second St, Elk City, OK 73644", county: "Beckham" },
        { id: "not-prefix", address: "21 First Ave, Elk City, OK 73644", county: "Beckham" },
        { id: "street-has-one", address: "345 1st St, Elk City, OK 73644", county: "Beckham" },
        { id: "other-county", address: "109 Main St, Lawton, OK 73501", county: "Comanche" },
    );
    render();
    elements.googleInsertStopCity.value = "Elk City";
    elements.googleInsertStopCounty.value = "Beckham";
    elements.googleInsertStopSearch.value = "1";
    render();
    assert.deepEqual(visible(), ["elk-main", "one-first", "one-two"]);
    // The next digits keep narrowing the left-to-right house-number prefix.
    elements.googleInsertStopSearch.value = "12";
    render();
    assert.deepEqual(visible(), ["elk-main", "one-two"]);
    elements.googleInsertStopSearch.value = "121";
    render();
    assert.deepEqual(visible(), ["elk-main"]);
    elements.googleInsertStopSearch.value = "121 Main";
    render();
    assert.deepEqual(visible(), ["elk-main"]);
    elements.googleInsertStopSearch.value = "121 Oak";
    render();
    assert.deepEqual(visible(), []);
    assert.equal(elements.googleInsertStop.disabled, true);
    assert.match(elements.googleInsertStopChoice.options[0].textContent, /No matching/);

    // Different county: 109 should appear only after selecting its county.
    elements.googleInsertStopSearch.value = "1";
    elements.googleInsertStopCity.value = "All";
    elements.googleInsertStopCounty.value = "Comanche";
    render();
    assert.deepEqual(visible(), ["other-county"]);

    // Street names beginning with digits still work as ordinary text searches.
    elements.googleInsertStopSearch.value = "1st";
    elements.googleInsertStopCity.value = "Elk City";
    elements.googleInsertStopCounty.value = "Beckham";
    render();
    assert.deepEqual(visible(), ["one-first", "street-has-one"]);
});

test("a number in the ZIP, label, or notes never qualifies an address for a leading house number", () => {
    const { stops, elements, render, visible } = setup();
    stops.push(
        { id: "zip-one", address: "455 Fir St, Elk City, OK 71111", county: "Beckham" },
        { id: "label-one", address: "455 Pine Ave, Elk City, OK 73644", county: "Beckham", label: "Visit 123" },
        { id: "notes-one", address: "455 Ash St, Elk City, OK 73644", county: "Beckham", notes: "1st replacement" },
    );
    elements.googleInsertStopCity.value = "Elk City";
    elements.googleInsertStopCounty.value = "Beckham";
    elements.googleInsertStopSearch.value = "1";
    render();
    assert.deepEqual(visible(), ["elk-main"]);
    // Non-numeric text still searches labels and notes.
    elements.googleInsertStopSearch.value = "replacement";
    render();
    assert.deepEqual(visible(), ["notes-one"]);
    elements.googleInsertStopSearch.value = "123";
    render();
    assert.deepEqual(visible(), []);
});

test("typing preserves a still-matching chosen stop, and clears it on a mismatch without changing routes", () => {
    const { elements, fixture, render } = setup();
    render();
    elements.googleInsertStopChoice.value = "elk-main";
    render();
    assert.equal(elements.googleInsertStopChoice.value, "elk-main");
    assert.equal(elements.googleInsertStop.disabled, false);
    elements.googleInsertStopSearch.value = "121 main";
    render();
    assert.equal(elements.googleInsertStopChoice.value, "elk-main");
    elements.googleInsertStopSearch.value = "oak";
    render();
    assert.equal(elements.googleInsertStopChoice.value, "");
    assert.equal(elements.googleInsertStop.disabled, true);
    fixture.googleInsertionBusy = true;
    render();
    assert.equal(elements.googleInsertStop.disabled, true);
    fixture.googleInsertionBusy = false;
    fixture.activeRouteSlot = "basic";
    render();
    assert.equal(elements.googleInsertStop.disabled, true);
});
