"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filters = require("../address-filters.js");
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const stops = [
    { id: "one", source: "GIS", label: "Inspection", address: "101 Main St, Elk City, OK 73644" },
    { id: "two", source: "DCFS", address: "201 Center Ave, Lawton, OK" },
    { id: "three", address: "309 NORTH BOUNDARY WALTERS OK" },
    { id: "four", address: "601 Elm St, Elk City, OK", label: "Personal stop" },
];
const gigs = [
    { id: "gig-1", stopId: "one", source: "HNP" },
    { id: "gig-2", stopId: "three", source: "Tresmolino" },
];

test("saved addresses filter on existing GIS/DCFS labels and exact gig companies without duplicating stops", () => {
    const rows = filters.describeStops(stops, gigs);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0].sources, ["GIS", "HNP"]);
    assert.deepEqual(rows[1].sources, ["DCFS"]);
    assert.deepEqual(rows[2].sources, ["TRESMOLINO"]);
    assert.deepEqual(rows[3].sources, ["Unassigned"]);
    assert.deepEqual(filters.filterRows(rows, { source: "GIS" }).map((row) => row.stop.id), ["one"]);
    assert.deepEqual(filters.filterRows(rows, { source: "HNP" }).map((row) => row.stop.id), ["one"]);
    assert.deepEqual(filters.filterRows(rows, { source: "Gigs" }).map((row) => row.stop.id), ["one", "three"]);
    assert.deepEqual(filters.filterRows(rows, { source: "DCFS" }).map((row) => row.stop.id), ["two"]);
    assert.deepEqual(stops.map((stop) => stop.id), ["one", "two", "three", "four"]);
});

test("first company occurrence becomes a filter immediately without any manual company list", () => {
    const first = filters.availableFilters(filters.describeStops(stops, []));
    assert.ok(!first.sources.includes("TRESMOLINO"));
    const next = filters.availableFilters(filters.describeStops(stops, gigs));
    assert.ok(next.sources.includes("TRESMOLINO"));
    assert.ok(next.sources.includes("HNP"));
    assert.ok(next.sources.includes("Gigs"));
});

test("towns are inferred only from clearly delimited city and state, and unknown counties are not guessed", () => {
    const rows = filters.describeStops(stops, gigs);
    assert.deepEqual(rows.map((row) => row.town), [
        "Elk City", "Lawton", "Unknown town", "Elk City",
    ]);
    assert.deepEqual(rows.map((row) => row.county), [
        "Unknown county", "Unknown county", "Unknown county", "Unknown county",
    ]);
    assert.deepEqual(
        filters.filterRows(rows, { town: "Unknown town" }).map((row) => row.stop.id),
        ["three"],
    );
    assert.deepEqual(
        filters.filterRows(rows, { county: "Unknown county" }).map((row) => row.stop.id),
        ["one", "two", "three", "four"],
    );
});

test("search, company, town and county combine without modifying original data", () => {
    const saved = JSON.stringify({ stops, gigs });
    const rows = filters.describeStops(stops, gigs);
    assert.deepEqual(
        filters.filterRows(rows, {
            query: "101 main",
            source: "GIS",
            town: "Elk City",
            county: "Unknown county",
        }).map((row) => row.stop.id),
        ["one"],
    );
    assert.deepEqual(
        filters.filterRows(rows, {
            query: "101 main",
            source: "DCFS",
            town: "Elk City",
        }),
        [],
    );
    assert.equal(JSON.stringify({ stops, gigs }), saved);
});

test("Saved Addresses UI connects four filters and starts at all addresses", () => {
    const savedPane = html.match(
        /<div class="addressViewPane" data-address-view="saved-addresses">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/,
    );
    assert.ok(savedPane);
    for (const id of [
        "addressSearch",
        "addressSourceFilter",
        "addressTownFilter",
        "addressCountyFilter",
        "addressFilterCount",
    ]) assert.match(savedPane[1], new RegExp(`id="${id}"`));
    assert.match(savedPane[1], /<option value="All">All companies \/ sources<\/option>/);
    assert.match(savedPane[1], /<option value="All">All towns<\/option>/);
    assert.match(savedPane[1], /<option value="All">All counties<\/option>/);
    assert.ok(html.indexOf("address-filters.js?v=1.0.0") < html.indexOf("app.js?v="));
    assert.doesNotMatch(savedPane[1], /localStorage|sessionStorage|onchange=/);
});

test("app filters the displayed address list and Select All through one read-only boundary", () => {
    const begin = app.indexOf("function updateAddressFilterOptions(");
    const end = app.indexOf("\nfunction formatJobLine(", begin);
    assert.ok(begin >= 0 && end > begin);
    const excerpt = app.slice(begin, end);
    const createSelect = () => {
        const options = [];
        return {
            value: "All",
            options,
            replaceChildren() { options.splice(0); },
            appendChild(option) { options.push(option); },
        };
    };
    const ctx = {
        FMRAddressFilters: filters,
        jobs: stops.slice(),
        gigs: gigs.slice(),
        localStorage: {},
        document: { createElement() { return { value: "", textContent: "" }; } },
        els: {
            addressSearch: { value: "" },
            addressSourceFilter: createSelect(),
            addressTownFilter: createSelect(),
            addressCountyFilter: createSelect(),
        },
        readGigs: (_storage, _ids) => ctx.gigs,
        savedJobIds: () => new Set(ctx.jobs.map((stop) => stop.id)),
    };
    vm.runInNewContext(excerpt, ctx);
    assert.deepEqual(
        Array.from(vm.runInNewContext("getFilteredJobs().map((stop) => stop.id)", ctx)),
        ["one", "two", "three", "four"],
    );
    ctx.els.addressSourceFilter.value = "HNP";
    ctx.els.addressTownFilter.value = "Elk City";
    assert.deepEqual(
        Array.from(vm.runInNewContext("getFilteredJobs().map((stop) => stop.id)", ctx)),
        ["one"],
    );

    ctx.gigs.push({ id: "gig-3", stopId: "four", source: "NEW CLIENT" });
    ctx.els.addressSourceFilter.value = "All";
    vm.runInNewContext("getFilteredJobs()", ctx);
    assert.ok(ctx.els.addressSourceFilter.options.some((option) => option.value === "NEW CLIENT"));
    assert.match(app, /const filtered = getFilteredJobs\(\);[\s\S]*for \(const j of filtered\)/);
    assert.match(app, /for \(const row of filtered\) \{\s*const job = row.stop/);
});
