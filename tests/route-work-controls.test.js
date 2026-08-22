const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const controls = fs.readFileSync(path.join(root, "route-work-controls.js"), "utf8");

function scriptIndex(file) {
    return html.indexOf(`src="${file}`);
}

test("Build Route exposes separate InspectorADE and manual gig clear controls", () => {
    assert.match(
        html,
        /id="clearInspectorAdeJobs"[\s\S]*?>\s*Clear InspectorADE Jobs\s*</,
    );
    assert.match(
        html,
        /id="clearManualGigWork"[\s\S]*?>\s*Clear Manual Gig Work\s*</,
    );
});

test("route work contracts and controls load before app ownership initializes", () => {
    assert.ok(scriptIndex("route-history.js") >= 0);
    assert.ok(scriptIndex("route-work-clear.js") > scriptIndex("route-history.js"));
    assert.ok(scriptIndex("manual-gigs.js") > scriptIndex("route-work-clear.js"));
    assert.ok(scriptIndex("route-work-controls.js") > scriptIndex("manual-gigs.js"));
    assert.ok(scriptIndex("route-work-controls.js") < scriptIndex("app.js"));
});

test("InspectorADE clear is confirmed and changes only route history", () => {
    assert.match(controls, /confirm\([\s\S]*Clear InspectorADE jobs/);
    assert.match(controls, /clearInspectorAdeRouteWork\(/);
    assert.match(controls, /writeRouteHistory\(/);
    assert.doesNotMatch(controls, /writeJobs\(/);
    assert.doesNotMatch(controls, /deleteGig\(/);
});

test("manual gig clear keeps gig records while turning route inclusion off", () => {
    assert.match(controls, /Clear manual gig work/);
    assert.match(controls, /routeIncluded:\s*false/);
    assert.match(controls, /writeGigs\(/);
    assert.match(controls, /clearManualGigRouteWork\(/);
    assert.match(controls, /pay, notes, work-order IDs, and saved addresses will be kept/);
    assert.doesNotMatch(controls, /writeJobs\(/);
    assert.doesNotMatch(controls, /deleteGig\(/);
});

test("manual gig clear reloads only to refresh the gig module's in-memory list", () => {
    assert.match(controls, /sessionStorage\.setItem\(RETURN_PAGE_KEY, "route"\)/);
    assert.match(controls, /window\.location\.reload\(\)/);
    assert.match(controls, /showPage\("route"\)/);
});
