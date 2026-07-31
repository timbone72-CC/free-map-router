#!/usr/bin/env python3
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


root = Path(__file__).resolve().parents[1]
app_path = root / "app.js"
index_path = root / "index.html"
contract_path = root / "CONTRACT.md"
test_path = root / "tests" / "clear-controls.test.js"
record_path = root / "docs" / "CLEAR_CONTROLS_CHANGE_RECORD.md"

app = app_path.read_text(encoding="utf-8")
index = index_path.read_text(encoding="utf-8")
contract = contract_path.read_text(encoding="utf-8")

if "function deleteAllAddresses()" in app:
    raise SystemExit("clear-controls patch already applied")

app = replace_once(
    app,
    '    routeMapLinks: document.getElementById("routeMapLinks"),\n',
    '    routeMapLinks: document.getElementById("routeMapLinks"),\n'
    '    clearRoute: document.getElementById("clearRoute"),\n',
    "app clearRoute element",
)

app = replace_once(
    app,
    "function deleteSelectedJobs() {\n",
    '''function clearRouteSelection() {
    routeIds = [];
    renderJobsList();
    renderRouteList();
    scheduleDriveAutosave();
    if (els.routeStatus) {
        els.routeStatus.textContent =
            "Route cleared. Saved addresses were kept.";
    }
}

function deleteAllAddresses() {
    if (jobs.length === 0) {
        alert("No saved addresses to delete.");
        return;
    }

    const ok = confirm(
        `Delete all ${jobs.length} saved address(es) from this app? ` +
            "This clears Build Route but does not delete workbook or Google Doc history. " +
            "Restore a backup or import the jobs again to bring them back.",
    );
    if (!ok) return;

    jobs = [];
    routeIds = [];
    editingJobId = null;
    writeJobs(jobs);
    resetForm();
    renderAll();
    if (els.routeStatus) {
        els.routeStatus.textContent =
            "All saved addresses were deleted from this app.";
    }
}

function deleteSelectedJobs() {
''',
    "bulk action functions",
)

app = replace_once(
    app,
    '    btnClear.textContent = "Clear";\n',
    '    btnClear.textContent = "Clear Route";\n',
    "clear label",
)

app = replace_once(
    app,
    '''    const btnDeleteSelected = document.createElement("button");
    btnDeleteSelected.type = "button";
    btnDeleteSelected.textContent = "Delete";

    wrap.appendChild(btnSelectAll);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnDeleteSelected);
''',
    '''    const btnDeleteSelected = document.createElement("button");
    btnDeleteSelected.type = "button";
    btnDeleteSelected.textContent = "Delete";

    const btnDeleteAll = document.createElement("button");
    btnDeleteAll.type = "button";
    btnDeleteAll.textContent = "Delete All Addresses";

    wrap.appendChild(btnSelectAll);
    wrap.appendChild(btnClear);
    wrap.appendChild(btnDeleteSelected);
    wrap.appendChild(btnDeleteAll);
''',
    "delete all address control",
)

app = replace_once(
    app,
    '''    // Clear = clear route selection only
    btnClear.addEventListener("click", () => {
        routeIds = [];
        renderJobsList();
        renderRouteList();
        scheduleDriveAutosave();
    });
''',
    '''    // Clear Route = clear route selection only
    btnClear.addEventListener("click", clearRouteSelection);
''',
    "clear route handler",
)

app = replace_once(
    app,
    '''    btnDeleteSelected.addEventListener("click", () => {
        deleteSelectedJobs();
    });
}
''',
    '''    btnDeleteSelected.addEventListener("click", () => {
        deleteSelectedJobs();
    });

    btnDeleteAll.addEventListener("click", deleteAllAddresses);
}
''',
    "delete all event handler",
)

app = replace_once(
    app,
    '''if (els.optimizeRoute) {
    els.optimizeRoute.addEventListener("click", optimizeSelectedRoute);
}

if (els.exportRoute) {
''',
    '''if (els.optimizeRoute) {
    els.optimizeRoute.addEventListener("click", optimizeSelectedRoute);
}

if (els.clearRoute) {
    els.clearRoute.addEventListener("click", clearRouteSelection);
}

if (els.exportRoute) {
''',
    "build route clear handler",
)

index = replace_once(
    index,
    '''                <button id="optimizeRoute" type="button" class="btn btnSmall">
                    Optimize Route
                </button>
                <button id="exportRoute" type="button" class="btn btnSmall">
''',
    '''                <button id="optimizeRoute" type="button" class="btn btnSmall">
                    Optimize Route
                </button>
                <button id="clearRoute" type="button" class="btn btnSmall">
                    Clear Route
                </button>
                <button id="exportRoute" type="button" class="btn btnSmall">
''',
    "route clear button",
)

index = replace_once(
    index,
    '<script src="app.js?v=3.9.0"></script>',
    '<script src="app.js?v=3.10.0"></script>',
    "app cache version",
)

contract = replace_once(
    contract,
    '''10. Pin placement provides free **Aerial** and **Roads** views, with Aerial
    shown first so the user can identify the physical property.

## 4. Page and menu rules
''',
    '''10. Pin placement provides free **Aerial** and **Roads** views, with Aerial
    shown first so the user can identify the physical property.
11. **Clear Route** removes every stop from the current route selection without
    deleting any saved address, pin, note, Home value, or setting.
12. **Delete All Addresses** requires confirmation and removes all currently
    saved stops plus the current route from this app. It does not delete Home,
    settings, workbook history, Google Doc history, or older backup files.

## 4. Page and menu rules
''',
    "saved-data contract",
)

app_path.write_text(app, encoding="utf-8")
index_path.write_text(index, encoding="utf-8")
contract_path.write_text(contract, encoding="utf-8")

test_path.write_text(
    '''const test = require("node:test");
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
    assert.match(htmlSource, /id="clearRoute"[\\s\\S]*?>\\s*Clear Route\\s*</);
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
''',
    encoding="utf-8",
)

record_path.write_text(
    '''# Clear saved jobs controls — Level 3 impact record

- Problem: the existing Addresses **Clear** control only removed route selection, and Build Route had no whole-route clear control. The user could not plainly remove every saved job from the app.
- Evidence: `ensureSelectionControls()` labels selection clearing as `Clear`; Build Route provides only per-stop `Remove`; no confirmed delete-all action exists.
- Approved behavior: **Clear Route** clears route selection but preserves saved addresses. **Delete All Addresses** requires confirmation, removes all app-saved stops and the current route, and preserves Home, settings, workbook history, Google Doc history, and older backups.
- Level: 3 because the change adds bulk deletion of stored app data.
- Owning files/functions: `app.js` (`clearRouteSelection`, `deleteAllAddresses`, selection controls and event wiring), `index.html` (Build Route control and cache version), `CONTRACT.md`, and `tests/clear-controls.test.js`.
- Read surfaces: in-memory `jobs`, `routeIds`, edit state, and current DOM controls.
- Write surfaces: the existing browser stop storage through `writeJobs`; current route selection; normal Drive auto-save only when already connected.
- Required data: none beyond the current saved-stop list. Optional data such as labels, notes, source, and pins is deleted only as part of the confirmed all-stop deletion.
- Schema and permissions: no schema, Drive scope, API permission, inbox format, routing algorithm, or deployment configuration change.
- Hard limits: one synchronous pass over the current in-memory stop list; no polling, observer, retry loop, new network request, or background deletion.
- Stale-output behavior: Clear Route immediately removes selection only. A cancelled Delete All leaves all state unchanged. Confirmed deletion updates the current app list; an older backup or a later workbook inbox can restore/re-send addresses.
- Protected behavior: Home, Geoapify key, page menu, individual Edit/Delete, selected Delete, pins, imports, workbook inbox, optimization, Google Maps, Garmin, backups, and all unrelated pages.
- Realistic fixtures: tests distinguish route-only clearing from confirmed all-stop deletion and prove the delete-all function does not write Home.
- Baseline and expected verification: current `main` has 75 tests. This change adds 3 focused tests; expected complete result is 78 passing tests plus JavaScript syntax checks.
- Primary risks: accidental broad deletion or misleading control wording. Mitigation: explicit labels, a count-bearing confirmation, no deletion on cancellation, and separate route-only logic.
- Failure recovery: before live deletion testing, download or save a Drive backup. If publication or behavior fails, restore app `main` commit `0d349d427491bae48e7447ff0640f4d4d280afc9`; restore the backup only if test data was deleted.
- Smoke checks: confirm Home remains intact; Clear Route empties Build Route while Addresses remain; cancel Delete All leaves addresses; confirm Delete All empties Addresses, Build Route, and suggestions; refresh preserves the empty app list; an existing backup can restore stops.
- Workbook/router integration impact: none. The workbook inbox contract and import behavior are unchanged; a later inbox may send jobs back after deletion.
- Approval status: implementation approved; explicit pre-merge Level 3 approval still required.
''',
    encoding="utf-8",
)

print("clear-controls patch applied")
