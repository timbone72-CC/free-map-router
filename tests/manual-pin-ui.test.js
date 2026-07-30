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
    assert.match(html, /leaflet@1\.9\.4/);
});

test("clicking the map or dragging the pin records a manual location", () => {
    assert.match(app, /draggable:\s*true/);
    assert.match(app, /locationMarker\.on\("dragend"/);
    assert.match(app, /locationMap\.on\("click"/);
    assert.match(app, /setManualPin\(event\.latlng\.lat/);
    assert.match(app, /formPinStatus = "manual"/);
    assert.match(app, /pinStatus:\s*[\s\S]*formPinStatus/);
});
