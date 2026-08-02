const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
);
const app = fs.readFileSync(
    path.join(__dirname, "..", "app.js"),
    "utf8",
);

test("the address page contains a location map", () => {
    assert.match(html, /id="locationMap"/);
    assert.match(html, /vendor\/leaflet\.js\?v=1\.9\.4/);
    assert.match(html, /vendor\/leaflet\.css\?v=1\.9\.4/);
    assert.doesNotMatch(html, /unpkg\.com/);
});

test("the Home page has separate lookup and manual pin controls", () => {
    assert.match(html, /id="findHomeLocation"/);
    assert.match(html, /id="homeLocationMap"/);
    assert.match(app, /homeLocationMap\.on\("click"/);
    assert.match(app, /homeDraftPinStatus = "manual"/);
});

test("clicking the map or dragging the pin records a manual location", () => {
    assert.match(app, /draggable:\s*true/);
    assert.match(app, /locationMarker\.on\("dragend"/);
    assert.match(app, /locationMap\.on\("click"/);
    assert.match(app, /setManualPin\(event\.latlng\.lat/);
    assert.match(app, /formPinStatus = "manual"/);
    assert.match(app, /pinStatus:\s*[\s\S]*formPinStatus/);
});

test("Find Location cannot overwrite a complete manual pin", () => {
    const handler = app.slice(
        app.indexOf("async function findFormLocation()"),
        app.indexOf("// SECTION 12"),
    );
    const guard = handler.indexOf('formPinStatus === "manual"');
    const lookup = handler.indexOf("await findAddress(address");

    assert.notEqual(guard, -1);
    assert.notEqual(lookup, -1);
    assert.ok(guard < lookup);
    assert.match(app, /latitude >= -90/);
    assert.match(app, /latitude <= 90/);
    assert.match(app, /longitude >= -180/);
    assert.match(app, /longitude <= 180/);
    assert.match(handler, /Manual pin protected/);
    assert.match(handler, /return;/);
});

test("a late lookup cannot overwrite a newly manual pin or changed address", () => {
    const handler = app.slice(
        app.indexOf("async function findFormLocation()"),
        app.indexOf("// SECTION 12"),
    );
    const lookup = handler.indexOf("await findAddress(address");
    const changedAddressGuard = handler.indexOf(
        "normalizeAddress(els.address?.value) !== address",
    );
    const latestManualGuard = handler.lastIndexOf(
        'formPinStatus === "manual"',
    );
    const applyLookup = handler.indexOf(
        "els.latitude.value = String(result.latitude)",
    );

    assert.ok(lookup < changedAddressGuard);
    assert.ok(changedAddressGuard < applyLookup);
    assert.ok(lookup < latestManualGuard);
    assert.ok(latestManualGuard < applyLookup);
    assert.match(handler, /Manual pin kept/);
});

test("pin maps default to free USGS aerial imagery with a Roads option", () => {
    assert.match(app, /USGSImageryOnly\/MapServer\/tile/);
    assert.match(app, /Aerial:\s*aerial/);
    assert.match(app, /Roads:\s*roads/);
    assert.match(app, /aerial\.addTo\(map\)/);
});

test("saved coordinates stay hidden from readable route labels", () => {
    assert.doesNotMatch(app, /const coords\s*=/);
    assert.match(app, /return `\$\{label\}\$\{addr\}\$\{notes\}`/);
});
