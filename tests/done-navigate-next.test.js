"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${name} must exist`);
    const open = source.indexOf("{", start);
    let depth = 0;

    for (let index = open; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        if (source[index] === "}") depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }

    throw new Error(`${name} has no closing brace`);
}

function runDoneAndNext({ home, jobs, routeIds }) {
    const context = {
        alerts: [],
        opens: [],
        renderRouteCalls: 0,
        renderJobsCalls: 0,
        autosaveCalls: 0,
        persistRouteCalls: 0,
    };

    vm.runInNewContext(
        `
        let home = ${JSON.stringify(home)};
        let jobs = ${JSON.stringify(jobs)};
        let routeIds = ${JSON.stringify(routeIds)};
        const els = { routeStatus: { textContent: "" } };
        const alert = (message) => alerts.push(message);
        const window = { open: (url, target) => opens.push({ url, target }) };
        const buildGoogleMapsNavigationUrl = (destination) =>
            destination?.address
                ? "navigate:" + destination.address
                : "";
        const renderRouteList = () => { renderRouteCalls += 1; };
        const renderJobsList = () => { renderJobsCalls += 1; };
        const persistActiveRoute = () => { persistRouteCalls += 1; };
        const scheduleDriveAutosave = () => { autosaveCalls += 1; };
        ${extractFunction(app, "completeCurrentStopAndNavigate")}
        completeCurrentStopAndNavigate();
        this.result = {
            routeIds: routeIds.slice(),
            jobs: jobs.map((job) => ({ ...job })),
            status: els.routeStatus.textContent,
        };
        `,
        context,
    );

    return context;
}

test("Build Route exposes one Done and Navigate Next control", () => {
    assert.match(html, /id="completeAndNavigateNext"/);
    assert.match(html, /Done &amp; Navigate Next/);
    assert.match(
        app,
        /els\.completeAndNavigateNext\.addEventListener\([\s\S]*completeCurrentStopAndNavigate/,
    );
});

test("Done removes only the current route stop and navigates to the next", () => {
    const jobs = [
        { id: "a", address: "100 First St" },
        { id: "b", address: "200 Second St" },
        { id: "saved", address: "300 Saved St" },
    ];
    const context = runDoneAndNext({
        home: { address: "Home" },
        jobs,
        routeIds: ["a", "b"],
    });

    assert.deepEqual(Array.from(context.result.routeIds), ["b"]);
    assert.deepEqual(
        Array.from(context.result.jobs, (job) => job.id),
        ["a", "b", "saved"],
    );
    assert.equal(context.opens.length, 1);
    assert.equal(context.opens[0].url, "navigate:200 Second St");
    assert.equal(context.opens[0].target, "_blank");
    assert.equal(context.renderRouteCalls, 1);
    assert.equal(context.renderJobsCalls, 1);
    assert.equal(context.autosaveCalls, 1);
    assert.equal(context.persistRouteCalls, 1);
    assert.match(context.result.status, /Completed 100 First St/);
    assert.match(context.result.status, /1 stop remain/);
});

test("Done on the last stop keeps saved addresses and navigates Home", () => {
    const context = runDoneAndNext({
        home: { address: "222 Blackburn Blvd" },
        jobs: [{ id: "a", address: "100 Last St" }],
        routeIds: ["a"],
    });

    assert.deepEqual(Array.from(context.result.routeIds), []);
    assert.equal(context.result.jobs.length, 1);
    assert.equal(context.opens.length, 1);
    assert.equal(context.opens[0].url, "navigate:222 Blackburn Blvd");
    assert.equal(context.opens[0].target, "_blank");
    assert.equal(context.persistRouteCalls, 1);
    assert.match(context.result.status, /Route complete/);
});

test("Done does nothing when no current route stop exists", () => {
    const context = runDoneAndNext({
        home: { address: "Home" },
        jobs: [{ id: "saved", address: "300 Saved St" }],
        routeIds: [],
    });

    assert.deepEqual(Array.from(context.result.routeIds), []);
    assert.equal(context.opens.length, 0);
    assert.equal(context.renderRouteCalls, 0);
    assert.equal(context.autosaveCalls, 0);
    assert.equal(context.persistRouteCalls, 0);
    assert.deepEqual(context.alerts, [
        "No current stop remains in this route.",
    ]);
});
