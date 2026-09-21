"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("one-step route-order UI loads through a fresh cache pin", () => {
    assert.match(indexHtml, /route-order-ui\.js\?v=1\.2\.0/);
    assert.match(indexHtml, /app\.js\?v=3\.34\.0/);
});
