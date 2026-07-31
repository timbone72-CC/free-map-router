const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function functionBody(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${name} must exist`);
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        if (source[index] === "}") depth -= 1;
        if (depth === 0) return source.slice(open + 1, index);
    }
    throw new Error(`${name} has no closing brace`);
}

test("Addresses and Build Route expose unambiguous clear controls", () => {
    assert.match(htmlSource, /id="clearRoute"[\s\S]*?>\s*Clear Route\s*</);
    assert.match(appSource, /btnClear\.textContent = "Clear Route"/);
    assert.match(appSource, /btnDeleteAll\.textContent = "Delete All Addresses"/);
    assert.match(appSource, /els\.clearRoute\.addEventListener\("click", clearRouteSelection\)/);
});

test("Clear Route removes only route selection and preserves saved jobs", () => {
    const body = functionBody(appSource, "clearRouteSelection");
    assert.match(body, /routeIds = \[\]/);
    assert.match(body, /renderJobsList\(\)/);
    assert.match(body, /renderRouteList\(\)/);
    assert.doesNotMatch(body, /jobs\s*=/);
    assert.doesNotMatch(body, /writeJobs\(/);
});

test("Delete All Addresses clears app stops and route only after confirmation", () => {
    const body = functionBody(appSource, "deleteAllAddresses");
    assert.match(body, /confirm\(/);
    assert.match(body, /jobs = \[\]/);
    assert.match(body, /routeIds = \[\]/);
    assert.match(body, /writeJobs\(jobs\)/);
    assert.match(body, /resetForm\(\)/);
    assert.doesNotMatch(body, /writeHome\(/);
    assert.match(body, /workbook or Google Doc history/);
});
