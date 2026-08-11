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

test("ordinary app changes do not schedule Google Drive activity", () => {
    assert.doesNotMatch(app, /scheduleDriveAutosave/);
    assert.doesNotMatch(app, /driveAutosaveEnabled/);
    assert.doesNotMatch(app, /refreshWorkbookInboxIfConnected/);
    assert.doesNotMatch(app, /currentDriveToken/);
    assert.match(
        contract,
        /Ordinary address,[\s\S]*do not trigger an automatic Drive write/,
    );
});

test("Back Up Now writes the complete current recovery snapshot", async () => {
    const context = {
        home: { address: "222 Blackburn Blvd" },
        jobs: [{ id: "a", address: "100 First St" }],
        routeIds: ["a"],
        routeHistory: {
            current: { routeIds: ["a"] },
            previous: { routeIds: ["old"] },
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
        Array.from(context.saved[0].backup.routes.current.routeIds),
        ["a"],
    );
    assert.deepEqual(
        Array.from(context.saved[0].backup.routes.previous.routeIds),
        ["old"],
    );
    assert.match(context.els.googleDriveStatus.textContent, /Backup complete/);
});

test("business-authenticated inbox keeps the protected import path", () => {
    assert.match(app, /async function syncWorkbookInboxFrom/);
    assert.match(app, /applyWorkbookInboxFromBackend/);
    assert.match(
        app,
        /applyWorkbookInboxFromBackend[\s\S]*syncWorkbookInboxFrom/,
    );
    assert.match(app, /applyAddressInbox\(jobs, inbox\)/);
    assert.match(app, /applyWorkbookRoute\([\s\S]*imported\.routeIds/);
    assert.match(html, /id="googleDriveInboxStatus"/);
});

test("manual restore still waits for a pending backup and requires confirmation", () => {
    assert.match(
        app,
        /els\.restoreGoogleDrive\.addEventListener\("click"[\s\S]*requestDriveToken\(\)[\s\S]*driveSaveQueue\.whenIdle\(\)/,
    );
    assert.match(
        app,
        /Replace the saved Home, addresses, pins, Current Route, and Previous Route/,
    );
});
