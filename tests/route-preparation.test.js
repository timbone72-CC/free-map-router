const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Optimize Route prepares selected addresses with Geoapify", () => {
    assert.match(app, /async function optimizeSelectedRoute/);
    assert.match(app, /findAddressWithGeoapify/);
    assert.match(app, /pinStatus:\s*"geocoded"/);
    assert.match(html, /id="routeStatus"/);
});

test("Geoapify attribution is visible", () => {
    assert.match(html, /Batch lookup powered by[\s\S]*Geoapify/);
});
