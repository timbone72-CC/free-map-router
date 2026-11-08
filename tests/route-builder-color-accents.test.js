"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const marker = "/* Route Builder color accents:";

function theme() {
    const start = css.indexOf(marker);
    assert.ok(start >= 0, "Route Builder accent block exists");
    return css.slice(start);
}

test("Route Builder color accents are scoped to Route Builder only", () => {
    const accentCss = theme().replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = Array.from(accentCss.matchAll(/([^{}]+)\{([^{}]*)\}/g));
    assert.ok(blocks.length >= 10, "color block has distinct route components");
    for (const [, selectors] of blocks) {
        for (const selector of selectors.split(",")) {
            assert.ok(
                selector.trim().startsWith("#routePage"),
                "the color accent selector must stay on Route Builder: " + selector,
            );
        }
    }
    assert.doesNotMatch(accentCss, /(?:^|;)\s*(?:display|width|height|position|grid-template-columns|margin|flex)\s*:/m);
});

test("Route Builder has distinct colors for sections, optimizers, and visible progress", () => {
    const accents = theme();
    for (const component of [
        "#routePage .plannerContext",
        "#routePage .plannerSurface",
        "#routePage .plannerActionSection",
        "#routePage .plannerUtilities",
        "#routePage #optimizeRoute",
        "#routePage #googleOptimizeRoute",
        "#routePage #routeOptimizeFeedback",
        "#routePage #googleOptimizeRoute:disabled",
    ]) {
        assert.ok(accents.includes(component + " {"), component + " has colors");
    }
    assert.match(accents, /#routePage #routeOptimizeFeedback\s*\{[^}]*background:/s);
    assert.match(accents, /#routePage #optimizeRoute\s*\{[^}]*color:\s*#fff/s);
    assert.match(accents, /#routePage #googleOptimizeRoute\s*\{[^}]*color:\s*#fff/s);
    assert.match(html, /styles\.css\?v=1\.2\.6/);
    assert.match(html, /id="routePage"/);
    assert.match(html, /id="routeOptimizeFeedback"/);
});
