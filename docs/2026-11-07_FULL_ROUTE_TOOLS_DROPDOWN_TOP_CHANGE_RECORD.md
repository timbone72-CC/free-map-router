# Move the complete Route tools dropdown up — 2026-11-07

**Change level:** Level 2 UI-control relocation.
**Status:** Staged on `ui/move-complete-route-tools-dropdown-top-20261107`; requires CI and live operator smoke check.
**Rollback:** `7c5646748f893c839dd04c8fd0cc870e78f90d6d` (last published main commit).

## Problem / operator correction

After PR #121 moved three frequently used buttons into a Quick Actions row at the top, the operator clarified that they use **more than those three** and requested **the whole Route tools & maintenance dropdown** near the top. The current app has a standalone Quick Actions row, and the remaining dropdown stays below Today's Route, creating unnecessary scrolling.

## Minimal approved scope

- Move the existing, complete collapsible **Route tools & maintenance** `<details>` immediately beneath the Google/Basic Route selector, ahead of the large Multi-Day Plan and Workday settings.
- Return the three PR #121 buttons to **that same dropdown**, alongside Clear Route, Garmin GPX, Clear InspectorADE Jobs, and Clear Manual Gig Work. Keep the same button labels, element IDs, `disabled` states and event ownership.
- Keep the map-link output and workbook-send status inside the moved dropdown alongside their actions.
- Remove the now-unused Quick Actions wrapper and CSS; make the dropdown compact while collapsed. Keep it collapsed by default, exactly as the existing dropdown was.
- No change to Multi-Day or Workday settings, navigation buttons, route selection, route data, route order, Drive, workbook, Google Maps, app permissions, or storage. No new JS or event listeners.

## Files and gates

- `index.html`: move existing DOM and update CSS cache pin to `1.2.4`.
- `styles.css`: existing `.plannerUtilities` styling with a compact `.plannerContext > .plannerUtilities` override.
- `tests/route-quick-actions-layout.test.js`: replace PR #121's placement expectations; verify **all** original controls appear **once** inside the single top dropdown and output/status nodes remain attached.
- No workbook/router integration impact: HTML relocation only. The workbook receiver and FMR sender stay unchanged.
- Focused test: `node --test tests/route-quick-actions-layout.test.js`. Final CI: `npm test` and `node --check` on all first-party root JS files.
- After GitHub Pages publication, operator checks the dropdown appears near the top, expands to show all existing buttons, Maps opens as before and route selection, Workday controls, and navigation retain their behavior.
- Revert PR if affected UI does not work; no data migration or external rollback needed.
