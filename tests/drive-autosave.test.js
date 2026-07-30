const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const contract = fs.readFileSync(path.join(root, "CONTRACT.md"), "utf8");

test("Drive auto-save is connected to saved route changes", () => {
    assert.match(app, /function scheduleDriveAutosave/);
    assert.match(app, /Google Drive connection expired/);
    assert.match(app, /All changes saved automatically/);
    assert.match(app, /function writeJobs[\s\S]*scheduleDriveAutosave/);
});

test("Drive connection imports the workbook inbox into the current route", () => {
    assert.match(app, /loadAddressInboxFromDrive/);
    assert.match(app, /parseAddressInbox/);
    assert.match(app, /applyAddressInbox\(jobs, inbox\)/);
    assert.match(app, /routeIds = imported\.routeIds/);
    assert.match(app, /saved addresses were kept/);
});

test("Settings explains the active-session auto-save boundary", () => {
    assert.match(html, /Connect &amp; Auto-Save/);
    assert.match(html, /while the app is[\s\S]*open/);
    assert.match(contract, /short-lived Google connection remains active/);
});
