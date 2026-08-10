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
    assert.match(app, /applyWorkbookRoute\([\s\S]*imported\.routeIds/);
    assert.match(app, /activeRouteSlot = "current"/);
    assert.match(app, /routeHistory\.current\?\.routeIds\.slice\(\)/);
    assert.match(app, /saved addresses were kept/i);
});

test("returning to a connected app refreshes a newer workbook route", () => {
    assert.match(app, /function syncWorkbookInbox/);
    assert.match(app, /function refreshWorkbookInboxIfConnected/);
    assert.match(
        app,
        /window\.addEventListener\("focus", refreshWorkbookInboxIfConnected\)/,
    );
    assert.match(app, /document\.addEventListener\("visibilitychange"/);
    assert.match(app, /document\.visibilityState === "visible"[\s\S]*refreshWorkbookInboxIfConnected/);
    assert.match(app, /if \(!driveAutosaveEnabled \|\| document\.visibilityState === "hidden"\) return/);
    assert.match(app, /const token = currentDriveToken\(\)/);
    assert.match(app, /if \(result === "newer"\) scheduleDriveAutosave\(\)/);
});

test("overlapping focus and visibility refreshes share one inbox read", () => {
    assert.match(app, /let driveInboxSyncPromise = null/);
    assert.match(app, /if \(driveInboxSyncPromise\) return driveInboxSyncPromise/);
    assert.match(app, /finally \{[\s\S]*driveInboxSyncPromise = null/);
});

test("same and older workbook exports cannot replace the optimized current route", () => {
    assert.match(app, /inboxRelation === "same"/);
    assert.match(app, /inboxRelation === "older"/);
    assert.match(app, /Older inbox ignored[\s\S]*Current Route was kept/);
    assert.match(app, /optimized order was kept/);
});

test("Build Route allows Current or Previous and always initializes Current", () => {
    assert.match(html, /id="routeChoice"/);
    assert.match(html, />Current Route</);
    assert.match(html, />Previous Route</);
    assert.match(app, /let activeRouteSlot = "current"/);
    assert.match(app, /Previous Route selected/);
});

test("an inbox not exported today requires confirmation before route replacement", () => {
    const freshnessCheck = app.indexOf("isAddressInboxExportedToday(inbox)");
    const warning = app.indexOf("This workbook inbox was exported on");
    const routeReplacement = app.indexOf("applyAddressInbox(jobs, inbox)");

    assert.ok(freshnessCheck >= 0);
    assert.ok(warning > freshnessCheck);
    assert.ok(routeReplacement > warning);
    assert.match(app, /Inbox not imported[\s\S]*The current route was kept/);
});

test("Settings explains the active-session auto-save boundary", () => {
    assert.match(html, /Connect &amp; Auto-Save/);
    assert.match(html, /while the app is[\s\S]*open/);
    assert.match(contract, /short-lived Google connection remains active/);
});


test("workbook inbox result stays separate from backup auto-save status", () => {
    assert.match(html, /id="googleDriveInboxStatus"/);
    assert.match(
        app,
        /googleDriveInboxStatus: document\.getElementById\("googleDriveInboxStatus"\)/,
    );
    assert.match(
        app,
        /els\.googleDriveInboxStatus\.textContent =[\s\S]*formatInboxImportStatus/,
    );
});
