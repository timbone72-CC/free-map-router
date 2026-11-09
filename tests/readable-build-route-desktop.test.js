"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function cssBlock(text, header) {
    const i = text.indexOf(header);
    assert.ok(i >= 0, "Missing " + header);
    const open = text.indexOf("{", i + header.length);
    let depth = 1;
    for (let j = open + 1; j < text.length; j++) {
        if (text[j] === "{") depth += 1;
        if (text[j] === "}") depth -= 1;
        if (depth === 0) return text.slice(open + 1, j);
    }
    throw new Error("Unclosed block: " + header);
}

test("route-only desktop typography is readable without enlarging other pages", () => {
    const readable = cssBlock(css, "@media (min-width: 761px)");
    assert.match(readable, /#routePage\s*\{\s*font-size:\s*16px/);
    assert.match(readable, /#routePage \.tiny,[\s\S]*?font-size:\s*15px/);
    assert.match(readable, /#routePage \.btn,[\s\S]*?#routePage select\s*\{\s*font-size:\s*16px/);
    assert.match(readable, /#routePage \.plannerStopId\s*\{\s*font-size:\s*14px/);
    assert.match(readable, /#routePage #routePlanControls h3,[\s\S]*?font-size:\s*20px/);
    assert.doesNotMatch(readable, /(^|\n)\s*body\s*\{/);
    assert.match(html, /styles\.css\?v=1\.2\.11/);
});

test("the route page uses the available laptop width but never changes other pages", () => {
    const desktop = cssBlock(css, "@media (min-width: 1001px)");
    assert.match(desktop, /body:has\(#routePage:not\(\[hidden\]\)\)\s*\{\s*max-width:\s*min\(1400px, 92vw\)/);
    assert.match(desktop, /#routePage \.plannerContext,[\s\S]*?#routePage \.plannerSurface\s*\{\s*max-width:\s*none/);
    assert.match(desktop, /#routePage \.plannerSettingsGrid\s*\{\s*align-items:\s*start/);
    assert.match(desktop, /#routePage \.workdayFields\s*\{\s*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%, 160px\), 1fr\)\)/);
    assert.ok(html.includes('id="routePlanControls"'));
    assert.ok(html.includes('id="workdayControls"'));
});

test("narrow layouts still stack planning panels, and phone-specific columns stay unchanged", () => {
    const narrow = cssBlock(css, "@media (max-width: 1000px)");
    assert.match(narrow, /#routePage \.plannerSettingsGrid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    const phoneRules = cssBlock(css.slice(css.indexOf("@media (max-width: 1000px)")), "@media (max-width: 760px)");
    assert.match(phoneRules, /#routePage \.workdayFields\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.ok(css.indexOf("@media (min-width: 761px)") > css.indexOf("@media (max-width: 760px)"));
});
