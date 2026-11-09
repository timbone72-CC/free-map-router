"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const controls = fs.readFileSync(path.join(root, "work-item-planning-controls.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const loader = fs.readFileSync(path.join(root, "route-work-controls.js"), "utf8");

test("desktop Work Item panel collapses by default but phone editor stays open", () => {
    assert.match(controls, /panel = document\.createElement\("details"\)/);
    assert.match(controls, /panel\.id = "workItemPlanningPanel"/);
    assert.match(controls, /panel\.open = !globalThis\.matchMedia\?\.\("\(min-width: 1101px\)"\)\?\.matches/);
    assert.match(controls, /<summary class="workItemPlanningSummary">/);
    for (const id of [
        "workItemPlanningRouteSummary", "workItemPlanningServiceSummary",
        "workItemPlanningForm", "workItemPlanningSelect",
        "workItemPlanningMinutes", "workItemPlanningDate",
        "workItemPlanningLocked", "saveWorkItemPlanning",
        "workItemPlanningStatus",
    ]) {
        assert.equal(controls.split('id="' + id + '"').length - 1, 1, id);
    }
    assert.match(controls, /if \(panel\) return panel;/);
    assert.match(controls, /anchor\.insertAdjacentElement\("beforebegin", panel\)/);
    assert.match(css, /#routePage #workItemPlanningPanel\s*\{[\s\S]*?max-width:\s*680px/);
    assert.match(css, /#routePage #workItemPlanningPanel > summary:focus-visible/);
    assert.match(html, /styles\.css\?v=1\.2\.12/);
    assert.match(html, /app\.js\?v=3\.34\.7/);
    assert.match(html, /route-work-controls\.js\?v=1\.0\.1/);
    assert.match(loader, /work-item-planning-controls\.js\?v=1\.1\.1/);
});

test("Workbook Check status appears inside tools and navigation retains its original status node", () => {
    const toolsOpen = html.indexOf('<details class="plannerUtilities">');
    const toolsEnd = html.indexOf("</details>", toolsOpen);
    const drive = html.indexOf('<section class="plannerActionSection"');
    const help = html.indexOf('id="workbookRouteCheckStatus"');
    const checkButton = html.indexOf('id="checkWorkbookRoute"');
    const routeStatus = html.indexOf('id="routeStatus"');
    assert.ok(toolsOpen >= 0 && toolsOpen < checkButton && checkButton < help && help < toolsEnd);
    assert.ok(toolsEnd < drive && drive < routeStatus);
    assert.match(html.slice(toolsOpen, toolsEnd), /Check Workbook Route loads new jobs and saved address corrections/);
    assert.equal(html.split('id="workbookRouteCheckStatus"').length - 1, 1);
    assert.equal(html.split('id="routeStatus"').length - 1, 1);
    assert.match(app, /workbookRouteCheckStatus: document\.getElementById\("workbookRouteCheckStatus"\)/);
});

test("checking workbook updates adjacent check status rather than route-driving status", async () => {
    const start = app.indexOf("async function checkWorkbookRouteFromDrive() {");
    const end = app.indexOf("\nif (els.checkWorkbookRoute) {", start);
    assert.ok(start >= 0 && end > start);
    const checkStatus = { textContent: "" };
    const drivingStatus = { textContent: "Driving to the next stop" };
    const sandbox = {
        els: {
            checkWorkbookRoute: { disabled: false },
            workbookRouteCheckStatus: checkStatus,
            routeStatus: drivingStatus,
        },
        requestDriveToken: async () => "test-token",
        loadAddressInboxFromDrive: async () => ({ verified: true }),
        syncWorkbookInboxFrom: async (load) => {
            await load();
            return "pending";
        },
    };
    vm.runInNewContext(app.slice(start, end), sandbox);
    assert.equal(await sandbox.checkWorkbookRouteFromDrive(), "pending");
    assert.match(checkStatus.textContent, /New Route Available/);
    assert.equal(drivingStatus.textContent, "Driving to the next stop");
    assert.equal(sandbox.els.checkWorkbookRoute.disabled, false);

    sandbox.requestDriveToken = async () => { throw new Error("Drive unavailable"); };
    assert.equal(await sandbox.checkWorkbookRouteFromDrive(), null);
    assert.equal(checkStatus.textContent, "Drive unavailable");
    assert.equal(drivingStatus.textContent, "Driving to the next stop");
    assert.equal(sandbox.els.checkWorkbookRoute.disabled, false);
});

test("permanent-address-correction connection prompt is routed to the workbook check tool only", () => {
    const start = app.indexOf("const routeBridgeBeforePlanner = globalThis.FMRRouteBridge;");
    const end = app.indexOf('\nsetPlannerView("list");', start);
    assert.ok(start >= 0 && end > start);
    const checkStatus = { textContent: "Check Workbook Route" };
    const drivingStatus = { textContent: "Driving status" };
    const sandbox = {
        els: {
            workbookRouteCheckStatus: checkStatus,
            routeStatus: drivingStatus,
        },
        refreshPlannerRouteHistory() {},
        renderRouteList() {},
        FMRRouteBridge: {},
    };
    vm.runInNewContext(app.slice(start, end), sandbox);
    const prompt = "Tap Check Workbook Route to connect Google Drive and safely load saved address corrections.";
    sandbox.FMRRouteBridge.setRouteStatus(prompt);
    assert.equal(checkStatus.textContent, prompt);
    assert.equal(drivingStatus.textContent, "Driving status");
    sandbox.FMRRouteBridge.setRouteStatus("Completed stop 1.");
    assert.equal(drivingStatus.textContent, "Completed stop 1.");
    assert.equal(checkStatus.textContent, prompt);
});
