"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const manualGigs = fs.readFileSync(path.join(root, "manual-gigs.js"), "utf8");

test("Addresses keeps the approved five top-level pages and adds four internal views", () => {
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

    for (const id of [
        "addressViewAddEdit",
        "addressViewManualGigs",
        "addressViewWorkLibrary",
        "addressViewSaved",
    ]) {
        assert.match(html, new RegExp(`id="${id}"`));
    }

    for (const pane of [
        "add-edit",
        "manual-gigs",
        "work-library",
        "saved-addresses",
    ]) {
        assert.match(html, new RegExp(`data-address-view="${pane}"`));
    }

    assert.match(
        html,
        /id="addressViewSaved"[\s\S]{0,120}\bchecked\b/,
        "Saved Addresses should be the default internal view",
    );
});

test("Saved Addresses Edit reveals the Add / Edit pane before the existing edit handler runs", () => {
    assert.match(
        html,
        /getElementById\("jobList"\)\?\.addEventListener\([\s\S]*"click"[\s\S]*button\.textContent\.trim\(\) !== "Edit"[\s\S]*getElementById\("addressViewAddEdit"\)[\s\S]*addEditView\.checked = true[\s\S]*true,/,
    );
});

test("Manual Gig edit controls stay with the Manual Gigs view", () => {
    const manualPane = html.match(
        /<div class="addressViewPane" data-address-view="manual-gigs">([\s\S]*?)<div class="addressViewPane" data-address-view="work-library">/,
    );
    assert.ok(manualPane, "Manual Gigs pane must exist");
    assert.match(manualPane[1], /id="gigForm"/);
    assert.match(manualPane[1], /id="gigList"/);
    assert.match(manualPane[1], /id="cancelGigEdit"/);
});

test("Work Library hides archived rows by default without changing archive data", () => {
    const libraryPane = html.match(
        /<div class="addressViewPane" data-address-view="work-library">([\s\S]*?)<div class="addressViewPane" data-address-view="saved-addresses">/,
    );
    assert.ok(libraryPane, "Work Library pane must exist");
    assert.match(libraryPane[1], /id="syncManualWork"/);
    assert.match(libraryPane[1], /id="showArchivedManualWork"/);
    assert.match(libraryPane[1], /Show Archived/);
    assert.match(libraryPane[1], /id="manualWorkList"/);
    assert.doesNotMatch(
        libraryPane[1].match(/id="showArchivedManualWork"[\s\S]{0,120}/)?.[0] || "",
        /\bchecked\b/,
    );

    assert.match(
        manualGigs,
        /li\.dataset\.archived = property\.archived \? "true" : "false"/,
    );
    assert.match(
        css,
        /#showArchivedManualWork:not\(:checked\) ~ #manualWorkList li\[data-archived="true"\][\s\S]*display: none/,
    );
    assert.doesNotMatch(manualGigs, /property\.archived\s*=\s*false/);
});

test("Address-page checkbox state stays visible and saved-address selection stays inline", () => {
    assert.match(
        css,
        /#showArchivedManualWork\s*\{[\s\S]*position:\s*static;[\s\S]*display:\s*inline-block;[\s\S]*width:\s*auto;/,
    );
    assert.match(
        css,
        /#jobList input\[type="checkbox"\]\s*\{[\s\S]*display:\s*inline-block;[\s\S]*width:\s*auto;[\s\S]*vertical-align:\s*middle;/,
    );
});

test("internal view switching is presentation-only", () => {
    assert.match(
        css,
        /#addressViewSaved:checked ~ \.addressViewPanes \[data-address-view="saved-addresses"\]/,
    );
    assert.match(css, /\.addressViewPane\s*\{[\s\S]*display: none/);
    assert.doesNotMatch(html, /localStorage/);
    assert.doesNotMatch(css, /localStorage/);
});
