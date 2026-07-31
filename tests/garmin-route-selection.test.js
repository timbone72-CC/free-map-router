const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "garmin-export-ui.js"), "utf8");

function extractFunction(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${name} must exist`);
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        if (source[index] === "}") depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`${name} has no closing brace`);
}

function runOrderedRouteStops(stops, ids) {
    const context = {
        localStorage: {},
        document: {
            querySelectorAll(selector) {
                assert.equal(selector, "#routeList li[data-stop-id]");
                return ids.map((id) => ({ dataset: { stopId: id } }));
            },
        },
        globalThis: {
            FMRContract: {
                readStops() {
                    return { stops };
                },
            },
        },
    };
    vm.runInNewContext(
        `${extractFunction(uiSource, "orderedRouteStops")}
this.result = orderedRouteStops();`,
        context,
    );
    return context.result;
}

test("Garmin export reads the exact Build Route stop order by saved id", () => {
    assert.match(appSource, /li\.dataset\.stopId = job\.id/);
    const stops = [
        { id: "a", address: "100 First St" },
        { id: "b", address: "200 Second St" },
    ];
    assert.deepEqual(
        Array.from(runOrderedRouteStops(stops, ["b", "a"]), (stop) => stop.address),
        ["200 Second St", "100 First St"],
    );
});

test("Garmin export ignores visible numbering text and skips stale ids", () => {
    assert.doesNotMatch(uiSource, /formatJobLine\(stop\) === line/);
    assert.doesNotMatch(uiSource, /#routeList li span/);
    const stops = [{ id: "real", address: "420 NW GRANITE AVE" }];
    assert.deepEqual(
        Array.from(runOrderedRouteStops(stops, ["missing", "real"]), (stop) => stop.id),
        ["real"],
    );
});
