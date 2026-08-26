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
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

function scriptIndex(filename) {
    return html.indexOf(`src="${filename}`);
}

test("manual gigs use the existing five-page navigation and Addresses page", () => {
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
    assert.match(html, /<form id="gigForm">/);
    assert.match(html, /id="gigAddress"/);
    assert.match(html, /id="gigSource"/);
    assert.match(html, /id="gigWorkOrderId"/);
    assert.match(html, /id="gigExpectedPay"/);
    assert.match(html, /id="gigDueDate"/);
    assert.match(html, /id="gigCompletedDate"/);
    assert.doesNotMatch(html, /id="gigRouteIncluded"/);
    assert.match(html, /id="gigList"/);
});

test("manual gig list exposes visible Include in Route checkboxes", () => {
    assert.match(
        manualGigSource,
        /function setManualGigRouteIncluded\(gigId, included\)/,
    );
    assert.match(manualGigSource, /routeToggle\.type = "checkbox"/);
    assert.match(manualGigSource, /routeToggle\.checked = gig\.routeIncluded/);
    assert.match(manualGigSource, /Include in Route/);
    assert.match(
        manualGigSource,
        /changeGigRouteMembership\(nextGig, nextIncluded\)/,
    );
    assert.match(manualGigSource, /const previousHistory = routeHistory/);
    assert.match(manualGigSource, /persistManualGigs\(previousGigs\)/);
    assert.match(manualGigSource, /persistRouteHistory\(previousHistory\)/);
});

test("normal gig edits preserve route selection and new gigs start unchecked", () => {
    const start = manualGigSource.indexOf("async function submitManualGig");
    const end = manualGigSource.indexOf("function deriveStopRemap", start);
    assert.ok(start >= 0);
    assert.ok(end > start);

    const submit = manualGigSource.slice(start, end);
    assert.doesNotMatch(submit, /gigRouteIncluded/);
    assert.match(submit, /routeIncluded: previous\.routeIncluded/);
    assert.match(submit, /routeIncluded: false/);
});

test("manual gig dates stay in the existing form with one local Complete Today action", () => {
    assert.match(manualGigSource, /function completeGigToday\(gigId\)/);
    assert.match(manualGigSource, /localCalendarDate\(new Date\(\)\)/);
    assert.match(manualGigSource, /complete\.textContent = "Complete Today"/);
    assert.match(manualGigSource, /completedDate: localCalendarDate/);
    assert.doesNotMatch(manualGigSource, /setGigRouteMembership[\s\S]{0,250}completedDate/);
});

test("scheduled Add to Route copies the current due date before cadence advancement", () => {
    const addStart = manualGigSource.indexOf("async function addScheduledWorkToRoute");
    const advance = manualGigSource.indexOf("advanceTemplateDue(", addStart);
    const dueCopy = manualGigSource.indexOf("dueDate: template.nextDueDate", addStart);
    assert.ok(addStart >= 0);
    assert.ok(dueCopy > addStart);
    assert.ok(advance > dueCopy);
});

test("manual gig contracts load before the app and do not use a post-app UI rewrite", () => {
    assert.ok(scriptIndex("gig-contract.js") >= 0);
    assert.ok(scriptIndex("manual-gigs.js") >= 0);
    assert.ok(scriptIndex("app.js") >= 0);
    assert.ok(scriptIndex("gig-contract.js") < scriptIndex("manual-gigs.js"));
    assert.ok(scriptIndex("manual-gigs.js") < scriptIndex("app.js"));
    assert.doesNotMatch(manualGigSource, /MutationObserver/);
    assert.doesNotMatch(manualGigSource, /routeList\.innerHTML/);
    assert.doesNotMatch(manualGigSource, /jobList\.innerHTML/);
});

test("manual gig integration remaps attached gigs after governed stop edits", () => {
    assert.match(manualGigSource, /beforeAddressSubmitJobs/);
    assert.match(manualGigSource, /deriveStopRemap/);
    assert.match(manualGigSource, /remapGigStopIds\(/);
    assert.match(manualGigSource, /addressAliases/);
    assert.match(manualGigSource, /currentStopIds\(\)/);
});

test("manual gigs are reapplied after Start New Route without changing pending inbox logic", () => {
    assert.match(manualGigSource, /pendingStartWasAvailable/);
    assert.match(manualGigSource, /reapplyIncludedGigsAfterWorkbookStart/);
    assert.match(manualGigSource, /setGigRouteMembership\(/);
    assert.match(manualGigSource, /if \(routeHistory\.pending\?\.routeIds\.length\) return/);
    assert.doesNotMatch(manualGigSource, /stageWorkbookRoute\(/);
    assert.match(appSource, /const started = startPendingRoute\(routeHistory, savedJobIds\(\)\)/);
});

test("address deletion is blocked before it can orphan manual gigs", () => {
    assert.match(manualGigSource, /guardIndividualAddressDelete/);
    assert.match(manualGigSource, /guardSelectionDelete/);
    assert.match(manualGigSource, /stopImmediatePropagation\(\)/);
    assert.match(manualGigSource, /Delete the manual gig/);
    assert.match(manualGigSource, /Delete All Addresses/);
});

test("existing backup restore path consumes parsed gig data only when restoreRoutes runs", () => {
    assert.match(manualGigSource, /installBackupRestoreHook/);
    assert.match(manualGigSource, /const originalRestoreRoutes = restoreRoutes/);
    assert.match(manualGigSource, /backupContract\.takeParsedGigsForRestore\(\)/);
    assert.match(manualGigSource, /persistManualGigs\(restoredGigs\)/);
});
