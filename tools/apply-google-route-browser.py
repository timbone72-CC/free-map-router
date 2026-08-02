#!/usr/bin/env python3
"""Apply the test-only Google route browser integration once."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"STOP: Expected one {label} anchor but found {count}.")
    return text.replace(old, new, 1)


def patch_app() -> None:
    path = ROOT / "app.js"
    text = path.read_text(encoding="utf-8")
    marker = "// GOOGLE ROAD ROUTE BRIDGE"
    if marker in text:
        print("app.js already patched")
        return

    anchor = 'showPage("home");\nrenderAll();\nrefreshAddressSuggestions();\n'
    bridge = r'''// GOOGLE ROAD ROUTE BRIDGE
// Narrow app-owned bridge for the authenticated test-only Google optimizer.
// It exposes copies of the current selection and applies only a fully validated
// order. Route rendering and routeIds remain owned by app.js.
if (!globalThis.FMRGoogleRouteContract) {
    throw new Error("Google route contract failed to load.");
}

globalThis.FMRRouteBridge = Object.freeze({
    selectedRouteSnapshot() {
        return {
            home: home ? { ...home } : null,
            stops: selectedRouteJobs().map((job) => ({ ...job })),
        };
    },

    applyGoogleRouteResult(request, response) {
        const validated =
            globalThis.FMRGoogleRouteContract.validateBackendResponse(
                request,
                response,
            );
        const currentSelection = selectedRouteJobs();
        const ordered = globalThis.FMRGoogleRouteContract.applyOrderedStopIds(
            currentSelection,
            validated.orderedStopIds,
        );

        routeIds = ordered.map((job) => job.id);
        renderRouteList();
        renderJobsList();
        scheduleDriveAutosave();

        return {
            orderedStopIds: routeIds.slice(),
            totalDistanceMeters: validated.totalDistanceMeters,
            totalDurationSeconds: validated.totalDurationSeconds,
        };
    },

    setRouteStatus(message) {
        if (els.routeStatus) {
            els.routeStatus.textContent = String(message || "");
        }
    },
});

'''
    text = replace_once(text, anchor, bridge + anchor, "app init")
    path.write_text(text, encoding="utf-8")
    print("patched app.js")


def patch_index() -> None:
    path = ROOT / "index.html"
    text = path.read_text(encoding="utf-8")

    if 'id="googleOptimizeRoute"' not in text:
        optimize_anchor = '''                <button id="optimizeRoute" type="button" class="btn btnSmall">
                    Optimize Route
                </button>
'''
        optimize_with_google = optimize_anchor + '''                <button
                    id="googleOptimizeRoute"
                    type="button"
                    class="btn btnSmall"
                    disabled
                >
                    Google Optimize (Test)
                </button>
'''
        text = replace_once(
            text,
            optimize_anchor,
            optimize_with_google,
            "Optimize Route button",
        )

    if 'id="googleRouteSignIn"' not in text:
        route_actions_end = '''                </button>
            </div>
            <div id="routeMapLinks" class="btnRow" hidden></div>
'''
        auth_controls = '''                </button>
            </div>
            <div id="googleRouteSignIn" class="googleRouteSignIn"></div>
            <p id="googleRouteAuthStatus" class="tiny muted">
                Google road optimization is test-only and requires the approved
                company Google account.
            </p>
            <div id="routeMapLinks" class="btnRow" hidden></div>
'''
        text = replace_once(
            text,
            route_actions_end,
            auth_controls,
            "Route Builder action row",
        )

    if 'google-route-contract.js?v=1.0.0' not in text:
        script_anchor = '        <script src="routing.js?v=1.4.0"></script>\n'
        text = replace_once(
            text,
            script_anchor,
            '        <script src="google-route-contract.js?v=1.0.0"></script>\n'
            + script_anchor,
            "routing script",
        )

    if 'google-route-browser.js?v=1.0.0' not in text:
        app_anchor = '        <script src="app.js?v=3.10.1"></script>\n'
        text = replace_once(
            text,
            app_anchor,
            '        <script src="app.js?v=3.11.0"></script>\n'
            '        <script src="google-route-browser.js?v=1.0.0"></script>\n',
            "app script",
        )

    path.write_text(text, encoding="utf-8")
    print("patched index.html")


def patch_runtime_exceptions() -> None:
    path = ROOT / "RUNTIME_EXCEPTIONS.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    scripts = data.setdefault("postAppScripts", [])
    if not any(item.get("file") == "google-route-browser.js" for item in scripts):
        scripts.append(
            {
                "file": "google-route-browser.js",
                "reason": (
                    "Owns only the test-only Google sign-in and optimization "
                    "button. It requests a validated order through the narrow "
                    "app-owned FMRRouteBridge and may not rewrite route lists "
                    "or page state directly."
                ),
            }
        )
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("patched RUNTIME_EXCEPTIONS.json")


def write_ui_test() -> None:
    path = ROOT / "tests" / "google-route-ui.test.js"
    content = r'''"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Build Route exposes separate free and test-only Google optimizers", () => {
    const html = read("index.html");
    assert.match(html, /id="optimizeRoute"/);
    assert.match(html, /id="googleOptimizeRoute"/);
    assert.match(html, /Google Optimize \(Test\)/);
    assert.match(html, /id="googleRouteSignIn"/);
    assert.match(html, /google-route-contract\.js\?v=1\.0\.0/);
    assert.match(html, /google-route-browser\.js\?v=1\.0\.0/);
});

test("app owns Google route application through a narrow bridge", () => {
    const app = read("app.js");
    assert.match(app, /globalThis\.FMRRouteBridge = Object\.freeze/);
    assert.match(app, /validateBackendResponse/);
    assert.match(app, /applyOrderedStopIds/);
    assert.match(app, /routeIds = ordered\.map/);
});

test("Google browser adapter does not rewrite route DOM", () => {
    const browser = read("google-route-browser.js");
    assert.doesNotMatch(browser, /MutationObserver/);
    assert.doesNotMatch(browser, /routeList\.innerHTML/);
    assert.doesNotMatch(browser, /querySelectorAll\([^)]*routeList/);
});
'''
    path.write_text(content, encoding="utf-8")
    print("wrote tests/google-route-ui.test.js")


def main() -> None:
    patch_app()
    patch_index()
    patch_runtime_exceptions()
    write_ui_test()
    print("Google route browser integration patch applied.")


if __name__ == "__main__":
    main()
