const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "gig-handoff-ui.js"), "utf8");

function scriptIndex(filename) {
    return html.indexOf(`src="${filename}`);
}

test("manual gigs surface owns one explicit Sync Gigs to Workbook action", () => {
    assert.match(html, /id="syncGigsToWorkbook"/);
    assert.match(html, />\s*Sync Gigs to Workbook\s*</);
    assert.match(html, /id="gigHandoffStatus"/);
    assert.doesNotMatch(uiSource, /setInterval|setTimeout|MutationObserver/);
});

test("gig handoff scripts load before app without adding a page", () => {
    assert.ok(scriptIndex("gig-handoff.js") >= 0);
    assert.ok(scriptIndex("manual-gigs.js") >= 0);
    assert.ok(scriptIndex("gig-handoff-ui.js") >= 0);
    assert.ok(scriptIndex("app.js") >= 0);
    assert.ok(scriptIndex("gig-handoff.js") < scriptIndex("gig-handoff-ui.js"));
    assert.ok(scriptIndex("manual-gigs.js") < scriptIndex("gig-handoff-ui.js"));
    assert.ok(scriptIndex("gig-handoff-ui.js") < scriptIndex("app.js"));

    const pageOptions = Array.from(
        html.matchAll(/<option value="(home|addresses|import|route|settings)">/g),
    ).map((match) => match[1]);
    assert.deepEqual(pageOptions, ["home", "addresses", "import", "route", "settings"]);
});

test("gig sync reads current gigs and saved stops but never changes local gig state", () => {
    assert.match(uiSource, /buildGigHandoff\(manualGigs\.list\(\), jobs, new Date\(\)\)/);
    assert.match(uiSource, /requestDriveToken\(\)/);
    assert.match(uiSource, /saveGigHandoffToDrive\(token, handoff\)/);
    assert.doesNotMatch(uiSource, /writeGigs|applyGigEdit|deleteGig|setGigRouteMembership/);
});
