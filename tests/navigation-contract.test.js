const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
);

test("the approved five-page dropdown menu remains intact", () => {
    const expectedOptions = [
        '<option value="home">Home</option>',
        '<option value="addresses">Addresses</option>',
        '<option value="import">Import Addresses</option>',
        '<option value="route">Build Route</option>',
        '<option value="settings">Settings</option>',
    ];

    assert.match(html, /<select id="pageMenu">/);
    for (const option of expectedOptions) {
        assert.ok(html.includes(option), `Missing menu option: ${option}`);
    }
});

test("only Home is visible when the app first opens", () => {
    assert.match(
        html,
        /class="section appPage" data-page="home">/,
    );
    assert.match(
        html,
        /class="section appPage" data-page="addresses" hidden>/,
    );
    assert.match(html, /data-page="import"\s+hidden/);
    assert.match(html, /class="section appPage" data-page="route" hidden>/);
    assert.match(
        html,
        /class="section appPage" data-page="settings" hidden>/,
    );
});
