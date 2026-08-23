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

test("Manual Work Library does not introduce observers, polling, timers, calendar, or automatic route adds", () => {
    assert.doesNotMatch(manualGigSource, /MutationObserver/);
    assert.doesNotMatch(manualGigSource, /setInterval\(/);
    assert.doesNotMatch(manualGigSource, /setTimeout\(/);
    assert.doesNotMatch(manualGigSource, /Google Calendar/i);
    assert.doesNotMatch(manualGigSource, /Notification\.requestPermission/);
    assert.doesNotMatch(driveSource, /calendar/);
    assert.doesNotMatch(driveSource, /routeIds/);
    assert.doesNotMatch(driveSource, /Order IDs?/i);
});