"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const contract = fs.readFileSync(path.join(root, "CONTRACT.md"), "utf8");

function extractFunction(source, name) {
    const marker = `async function ${name}(`;
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

test("Settings offers one manual Google Drive backup control", () => {
    assert.match(html, /id="backupGoogleDrive"[\s\S]*Back Up Now/);
    assert.doesNotMatch(html, /Connect &amp; Auto-Save/);
    assert.doesNotMatch(html, /Save to App Folder/);
    assert.match(html, /Nothing is saved to Google Drive automatically/);
    assert.match(
        app,
        /els\.backupGoogleDrive\.addEventListener\("click"[\s\S]*await backUpNow\(\)/,
    );
});

test("ordinary app changes do not schedule Google Drive backup activity", () => {
    assert.doesNotMatch(app, /scheduleDriveAutosave/);
    assert.doesNotMatch(app, /driveAutosaveEnabled/);
    assert.doesNotMatch(app, /refreshWorkbookInboxIfConnected/);
    assert.doesNotMatch(app, /currentDriveToken/);
    assert.match(
        contract,
        /Ordinary address,[\s\S]*do not trigger an automatic Drive write/,
    );
    assert.match(
        app,
        /void savePermanentAddressCorrections\(jobs\)/,
    );
    assert.match(
        contract,
        /Correcting a saved address is the sole exception to the manual-backup rule/,
    );
    assert.match(
        app,
        /const corrections = await loadPermanentAddressCorrections\(\);[\s\S]*applyCorrectionsToInbox\(inbox, corrections\)/,
    );
});

test("Back Up Now writes the complete current recovery snapshot", async () => {
    const context = {
        home: { address: "222 Blackburn Blvd" },
        jobs: [{ id: "a", address: "100 First St" }],
        routeIds: ["a"],
        routeHistory: {
            google: { routeIds: ["a"] },
            basic: { routeIds: ["old"] },
            pending: { routeIds: ["new"] },
        },
        driveSaveRevision: 0,
        tokens: 0,
        saved: [],
        els: { googleDriveStatus: { textContent: "" } },
        requestDriveToken: async () => {
            context.tokens += 1;
            return "drive-token";
        },
        createBackup: (snapshot) => ({
            app: "free-map-router",
            backupVersion: 1,
            ...snapshot,
        }),
        driveSaveQueue: {
            async enqueue(token, backup) {
                context.saved.push({ token, backup });
            },
        },
    };

    vm.runInNewContext(
        `${extractFunction(app, "backUpNow")}; this.promise = backUpNow();`,
        context,
    );
    await context.promise;

    assert.equal(context.tokens, 1);
    assert.equal(context.saved.length, 1);
    assert.equal(context.saved[0].token, "drive-token");
    assert.equal(context.saved[0].backup.home.address, "222 Blackburn Blvd");
    assert.equal(context.saved[0].backup.stops[0].address, "100 First St");
    assert.deepEqual(
        Array.from(context.saved[0].backup.routeIds),
        ["a"],
    );
    assert.deepEqual(
        Array.from(context.saved[0].backup.routes.google.routeIds),
        ["a"],
    );
    assert.deepEqual(
        Array.from(context.saved[0].backup.routes.basic.routeIds),
        ["old"],
    );
    assert.deepEqual(
        Array.from(context.saved[0].backup.routes.pending.routeIds),
        ["new"],
    );
    assert.match(context.els.googleDriveStatus.textContent, /Backup complete/);
});

test("Build Route manually sends the displayed Google or Basic order", async () => {
    assert.match(
        html,
        /id="sendRouteOrder"[\s\S]*Send Route Order to Workbook/,
    );
    assert.match(html, /id="workbookRouteOrderStatus"/);
    assert.match(
        app,
        /els\.sendRouteOrder\.addEventListener\("click"[\s\S]*sendDisplayedRouteOrderToWorkbook/,
    );

    const sent = [];
    const context = {
        activeRouteSlot: "basic",
        routeHistory: {
            basic: {
                routeIds: ["b"],
                orderIdsByStopId: { b: ["ORDER-2"] },
            },
        },
        routeOrderSendPromise: null,
        els: {
            workbookRouteOrderStatus: { textContent: "" },
        },
        selectedRouteJobs: () => [{ id: "b", address: "200 Second St" }],
        buildWorkbookRouteOrder: ({ routeSlot, routeSnapshot, routeStops }) => ({
            routeSlot,
            routeSnapshot,
            routeStops,
            stops: [{ stopNumber: 1, orderIds: ["ORDER-2"] }],
        }),
        workbookOrderIdCount: () => 1,
        requestDriveToken: async () => "drive-token",
        saveRouteOrderToDrive: async (token, payload) => {
            sent.push({ token, payload });
        },
        renderRouteList: () => {},
    };

    vm.runInNewContext(
        `${extractFunction(app, "sendDisplayedRouteOrderToWorkbook")}; this.promise = sendDisplayedRouteOrderToWorkbook();`,
        context,
    );
    await context.promise;

    assert.equal(sent.length, 1);
    assert.equal(sent[0].token, "drive-token");
    assert.equal(sent[0].payload.routeSlot, "basic");
    assert.match(
        context.els.workbookRouteOrderStatus.textContent,
        /Basic Route order sent for 1 workbook job/,
    );
});

test("business-authenticated inbox keeps the protected import path", () => {
    assert.match(app, /async function syncWorkbookInboxFrom/);
    assert.match(app, /applyWorkbookInboxFromBackend/);
    assert.match(
        app,
        /applyWorkbookInboxFromBackend[\s\S]*syncWorkbookInboxFrom/,
    );
    assert.match(app, /applyAddressInbox\(jobs, inbox\)/);
    assert.match(app, /stageWorkbookRoute\([\s\S]*imported\.routeIds/);
    assert.match(app, /New Route Available/);
    assert.match(app, /startPendingRoute/);
    assert.match(html, /id="googleDriveInboxStatus"/);
});

test("manual restore still waits for a pending backup and requires confirmation", () => {
    assert.match(
        app,
        /els\.restoreGoogleDrive\.addEventListener\("click"[\s\S]*requestDriveToken\(\)[\s\S]*driveSaveQueue\.whenIdle\(\)/,
    );
    assert.match(
        app,
        /Replace the saved Home, addresses, pins, Google Route, Basic Route, and pending new route/,
    );
});
