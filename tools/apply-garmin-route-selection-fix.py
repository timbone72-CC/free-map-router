#!/usr/bin/env python3
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]
app_path = root / "app.js"
ui_path = root / "garmin-export-ui.js"
index_path = root / "index.html"
test_path = root / "tests" / "garmin-route-selection.test.js"
record_path = root / "docs" / "GARMIN_ROUTE_SELECTION_FIX.md"

app = app_path.read_text(encoding="utf-8")
ui = ui_path.read_text(encoding="utf-8")
index = index_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''            if (!job) continue;

            const li = document.createElement("li");

            const label = document.createElement("span");
''',
    '''            if (!job) continue;

            const li = document.createElement("li");
            li.dataset.stopId = job.id;

            const label = document.createElement("span");
''',
    "route stop id marker",
)

old_ui = '''    function formatJobLine(job) {
        const label = job?.label ? `${job.label} — ` : "";
        const address = job?.address || "";
        const notesRaw = String(job?.notes || "").trim();
        const notes = notesRaw ? ` | Notes: ${notesRaw}` : "";
        return `${label}${address}${notes}`;
    }

'''
ui = replace_once(ui, old_ui, "", "remove obsolete visible-text formatter")

old_ordered = '''    function orderedRouteStops() {
        const readResult = globalThis.FMRContract.readStops(localStorage);
        const savedStops = Array.isArray(readResult?.stops)
            ? readResult.stops
            : [];
        const available = savedStops.slice();
        const routeLines = Array.from(
            document.querySelectorAll("#routeList li span"),
        ).map((span) => span.textContent || "");

        return routeLines
            .map((line) => {
                const index = available.findIndex(
                    (stop) => formatJobLine(stop) === line,
                );
                if (index < 0) return null;
                return available.splice(index, 1)[0];
            })
            .filter(Boolean);
    }
'''
new_ordered = '''    function orderedRouteStops() {
        const readResult = globalThis.FMRContract.readStops(localStorage);
        const savedStops = Array.isArray(readResult?.stops)
            ? readResult.stops
            : [];
        const savedById = new Map(
            savedStops.map((stop) => [String(stop?.id || ""), stop]),
        );
        const routeItems = Array.from(
            document.querySelectorAll("#routeList li[data-stop-id]"),
        );

        return routeItems
            .map((item) => savedById.get(String(item.dataset.stopId || "")))
            .filter(Boolean);
    }
'''
ui = replace_once(ui, old_ordered, new_ordered, "Garmin ordered route lookup")

index = replace_once(
    index,
    '<script src="app.js?v=3.10.0"></script>',
    '<script src="app.js?v=3.10.1"></script>',
    "app cache version",
)
index = replace_once(
    index,
    '<script src="garmin-export-ui.js?v=1.0.0"></script>',
    '<script src="garmin-export-ui.js?v=1.1.0"></script>',
    "Garmin UI cache version",
)

test_path.write_text(
    '''const test = require("node:test");
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
        `${extractFunction(uiSource, "orderedRouteStops")}\nthis.result = orderedRouteStops();`,
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
        runOrderedRouteStops(stops, ["b", "a"]).map((stop) => stop.address),
        ["200 Second St", "100 First St"],
    );
});

test("Garmin export ignores visible numbering text and skips stale ids", () => {
    assert.doesNotMatch(uiSource, /formatJobLine\(stop\) === line/);
    assert.doesNotMatch(uiSource, /#routeList li span/);
    const stops = [{ id: "real", address: "420 NW GRANITE AVE" }];
    assert.deepEqual(
        runOrderedRouteStops(stops, ["missing", "real"]).map((stop) => stop.id),
        ["real"],
    );
});
''',
    encoding="utf-8",
)

record_path.write_text(
    '''# Garmin route selection fix — Level 2 change record

- Problem: Build Route now renders numbered/source-prefixed text, while the Garmin UI adapter still compares that visible text with the older detailed Address-line formatter. Every comparison fails and the exporter incorrectly reports an empty route.
- Evidence: `garmin-export-ui.js` reads `#routeList li span` text and compares it with `formatJobLine(stop)`, while `app.js` renders route lines through `formatRouteStopLine(job, i)`.
- Approved behavior: Garmin export reads selected route stops by the stable saved stop ID attached by the owning Build Route renderer. Visible numbering and source wording no longer affect route detection.
- Level: 2 normal interaction fix. No deletion, migration, schema, permission, routing algorithm, or deployment change.
- Owning files: `app.js` adds a `data-stop-id` marker to each rendered route stop; `garmin-export-ui.js` reads those IDs; `index.html` refreshes both changed scripts; focused tests protect the handoff.
- Read surfaces: rendered Build Route stop IDs and existing saved stops in browser storage.
- Write surfaces: none. GPX download behavior is unchanged after the selected stops are resolved.
- Protected behavior: exact Build Route order, route numbering, GIS/DCFS labels, Garmin names, Home start/finish, saved addresses, pins, optimization, Google Maps, workbook inbox, and all page controls.
- Primary risk: a stale rendered ID. Mitigation: unmatched IDs are ignored, current valid IDs preserve order, and the existing empty-route warning remains when no valid selected stop exists.
- Focused verification: one test proves reverse route order is read by saved ID; one proves visible wording is irrelevant and stale IDs are skipped.
- Baseline/expected suite: current main has 78 tests; expected final result is 80 passing tests plus JavaScript syntax checks.
- Rollback: restore main commit `c89ec443d579dd9b7d7c03bccd2386605f5644fa`.
- Smoke check: with visible jobs in Build Route, download Garmin GPX and confirm no false empty-route alert; confirm GPX order and names match Build Route.
- No workbook/router integration impact.
''',
    encoding="utf-8",
)

app_path.write_text(app, encoding="utf-8")
ui_path.write_text(ui, encoding="utf-8")
index_path.write_text(index, encoding="utf-8")
print("Garmin route selection fix applied")
