const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manualGigSource = fs.readFileSync(
    path.join(root, "manual-gigs.js"),
    "utf8",
);
const driveSource = fs.readFileSync(
    path.join(root, "manual-work-drive.js"),
    "utf8",
);
const librarySource = fs.readFileSync(
    path.join(root, "manual-work-library.js"),
    "utf8",
);

function scriptIndex(filename) {
    return html.indexOf(`src="${filename}`);
}

test("Manual Work Library stays on the existing Addresses page with no sixth page", () => {
    const pageOptions = Array.from(
        html.matchAll(/<option value="(home|addresses|import|route|settings)">/g),
    ).map((match) => match[1]);
    assert.deepEqual(pageOptions, [
        "home",
        "addresses",
        "import",
        "route",
        "settings",
    ]);
    assert.match(html, /id="syncManualWork"/);
    assert.match(html, /id="manualWorkStatus"/);
    assert.match(html, /id="manualWorkList"/);
});

test("Manual Work Library contracts load before manual-gigs and app", () => {
    assert.ok(scriptIndex("manual-work-library.js") >= 0);
    assert.ok(scriptIndex("google-drive.js") >= 0);
    assert.ok(scriptIndex("manual-work-drive.js") >= 0);
    assert.ok(scriptIndex("manual-gigs.js") >= 0);
    assert.ok(scriptIndex("app.js") >= 0);
    assert.ok(scriptIndex("manual-work-library.js") < scriptIndex("manual-gigs.js"));
    assert.ok(scriptIndex("google-drive.js") < scriptIndex("manual-work-drive.js"));
    assert.ok(scriptIndex("manual-work-drive.js") < scriptIndex("manual-gigs.js"));
    assert.ok(scriptIndex("manual-gigs.js") < scriptIndex("app.js"));
});

test("saving a manual gig attempts permanent property storage and reports failure without deleting local work", () => {
    assert.match(manualGigSource, /savePropertyPermanently\(/);
    assert.match(manualGigSource, /await savePropertyPermanently\(stopForGig\(nextGig\) \|\| stop\)/);
    assert.match(manualGigSource, /requestDriveToken\(\)/);
    assert.match(manualGigSource, /loadManualWorkFromDrive\(token\)/);
    assert.match(manualGigSource, /saveManualWorkToDrive\(token, manualWorkLibrary\)/);
    assert.match(manualGigSource, /Gig saved on this device/);
    assert.doesNotMatch(manualGigSource, /deleteGig\([^\n]+savePropertyPermanently/);
});

test("Delete Gig and Build Route removal do not delete the permanent property", () => {
    assert.match(
        manualGigSource,
        /Delete this \$\{gig\.source\} manual gig\? The saved address and Manual Work Library property will be kept\./,
    );
    assert.match(manualGigSource, /setPropertyArchived\(/);
    assert.match(manualGigSource, /Archive the property first/);
    assert.doesNotMatch(manualGigSource, /Delete Gig[\s\S]{0,500}setPropertyArchived/);
});

test("Manual Work Library uses archive and restore without a permanent delete control", () => {
    assert.match(manualGigSource, /action\.textContent = property\.archived \? "Restore" : "Archive"/);
    assert.match(manualGigSource, /setArchived\(property\.propertyId, !property\.archived\)/);
    assert.doesNotMatch(html, /Delete Manual Work Property/i);
    assert.doesNotMatch(html, /Permanently Delete Property/i);
});

test("repeat schedule editor stays inside Work Library and keeps the initial cadence small", () => {
    assert.match(manualGigSource, /Add Schedule/);
    assert.match(manualGigSource, /Edit Schedule/);
    assert.match(manualGigSource, /Save Repeat Schedule/);
    assert.match(manualGigSource, /recurrenceCount/);
    assert.match(manualGigSource, /recurrenceUnit/);
    assert.match(manualGigSource, /nextDueDate/);
    assert.match(manualGigSource, /<option value="days">Days<\/option>/);
    assert.match(manualGigSource, /<option value="weeks">Weeks<\/option>/);
    assert.match(manualGigSource, /<option value="months">Months<\/option>/);
    assert.match(manualGigSource, /Due Soon starts \$\{DEFAULT_ALERT_LEAD_DAYS\} days/);
    assert.doesNotMatch(manualGigSource, /years/i);
});

test("due work is automatic to display but route insertion requires the Add to Route button", () => {
    assert.match(manualGigSource, /renderHomeDueSummary\(\)/);
    assert.match(manualGigSource, /dueCounts\(manualWorkLibrary, new Date\(\)\)/);
    assert.match(manualGigSource, /button\.textContent = "View Due Work"/);
    assert.match(manualGigSource, /add\.textContent = "Add to Route"/);
    assert.match(
        manualGigSource,
        /add\.addEventListener\("click", \(\) => \{[\s\S]{0,160}addScheduledWorkToRoute\(template\.templateId\)/,
    );
    assert.doesNotMatch(
        manualGigSource.match(/function initialize\(\)[\s\S]*?root\.FMRManualGigs/)?.[0] || "",
        /addScheduledWorkToRoute\(/,
    );
});

test("Add to Route creates one normal manual gig and advances the schedule without workbook identity", () => {
    const addBlock = manualGigSource.match(
        /async function addScheduledWorkToRoute\(templateId\) \{([\s\S]*?)\n    async function setArchived/,
    );
    assert.ok(addBlock, "scheduled Add to Route handler must exist");
    assert.match(addBlock[1], /createGig\(/);
    assert.match(addBlock[1], /workOrderId: ""/);
    assert.match(addBlock[1], /routeIncluded: true/);
    assert.match(addBlock[1], /persistManualGigs\(\[\.\.\.manualGigs, gig\]\)/);
    assert.match(addBlock[1], /changeGigRouteMembership\(gig, true\)/);
    assert.match(addBlock[1], /advanceTemplateDue\(manualWorkLibrary, template\.templateId/);
    assert.doesNotMatch(addBlock[1], /orderIds|Order ID|workbook/i);
});

test("schedule saves and advancements reuse the existing narrow Manual Work Drive path", () => {
    assert.match(manualGigSource, /upsertRepeatTemplate\(/);
    assert.match(manualGigSource, /Repeat schedule saved permanently in Google Drive/);
    assert.match(manualGigSource, /saveManualWorkToDrive\(token, manualWorkLibrary\)/);
    assert.match(driveSource, /Free Map Router Manual Work\.json/);
    assert.doesNotMatch(driveSource, /calendar/i);
    assert.doesNotMatch(driveSource, /routeIds/);
    assert.doesNotMatch(driveSource, /Order IDs?/i);
});

test("version 2 schedule contract keeps a four-day lead without a new gig schema", () => {
    assert.match(librarySource, /const MANUAL_WORK_VERSION = 2/);
    assert.match(librarySource, /const LEGACY_MANUAL_WORK_VERSION = 1/);
    assert.match(librarySource, /const DEFAULT_ALERT_LEAD_DAYS = 4/);
    assert.match(librarySource, /templates:/);
    assert.match(librarySource, /templateId/);
    assert.doesNotMatch(librarySource, /GIG_SCHEMA_VERSION\s*=\s*2/);
});

test("Manual Work scheduling does not introduce observers, polling, timers, calendar, push notifications, or automatic route adds", () => {
    assert.doesNotMatch(manualGigSource, /MutationObserver/);
    assert.doesNotMatch(manualGigSource, /setInterval\(/);
    assert.doesNotMatch(manualGigSource, /setTimeout\(/);
    assert.doesNotMatch(manualGigSource, /Google Calendar/i);
    assert.doesNotMatch(manualGigSource, /Notification\.requestPermission/);
    assert.doesNotMatch(librarySource, /setInterval\(/);
    assert.doesNotMatch(librarySource, /setTimeout\(/);
    assert.doesNotMatch(driveSource, /calendar/);
});