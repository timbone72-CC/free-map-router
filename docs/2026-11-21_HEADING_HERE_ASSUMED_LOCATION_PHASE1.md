# FMR — Heading Here / Assumed Location Phase 1

**Date:** 2026-11-21
**Change class:** Level 2, explicitly requested interactive route-card feature with one isolated opt-in device-local preference. No Route Plan/storage schema migration, stored work mutation, delivery or API changes.
**Rollback point:** `main` at `03613f100464c2ca1b74064561b010d153b7cc16` (PR #157).

## Request / approved first piece

On each Route Builder stop card, **Heading Here** opens a confirmation showing the exact address and two real buttons: **Continue** saves this address as the driver's **assumed location**; **Cancel** makes no change. The assumption is deliberate, **not GPS**. No stop is marked complete, no route changes and no Google navigation is triggered. The selected address is displayed in a modest, always-readable status indicator. Choosing another card changes the assumed location. The selection should survive refresh on the same device but be ignored after the active route day, plan, route slot or membership changes.

## Narrow implementation

- `assumed-route-location.js`: optional new browser-local preference `fmr_assumed_route_location_v1`. Stores only `{version,planId,dayId,routeDate,routeSlot,stopId}` on explicit Continue; validates the selected route slot on opening and confirmation, then reads that physical stop as an assumed position for the **whole active day** (any route view). This preserves it when the app resets from Basic Route to Google Route on refresh. Only `getItem` on display; invalid/stale preferences are not shown (and never rewrite route history).
- `app.js`: add a button to every existing stop card, native dialog Continue/Cancel handler, and clear "Assumed location" display with the verified saved address. No backtracking preview, Google optimizer changes, completion action or route ordering changes in this first piece.
- `index.html`: one dialog, one indicator, one cached dependency, one refreshed `app.js` pin. No new top-level page or map.
- Tests: `tests/assumed-route-location.test.js` exercises real confirmation/Cancel handler and isolated storage, reload, stale route/day/plan/slot/removal, lack of auto navigation or completion; existing route-card tests updated for the one new button, app cache-version tests updated. No external network use.

## Risk control

**Reads:** current active plan/day, currently displayed route slot, saved stop address, confirmed device-local preference.

**Writes:** only one new device-local key after user explicitly presses Continue. No database or Route Plan schema update; no write to saved stops, route IDs, work-order completion, other route versions, Map URLs, Google Drive, workbook, geocoding, or API permissions. The preference intentionally does not sync or join backup files in Phase 1.

**Stale state:** a new plan ID, different active day/date, removal from both route slots, or a deleted saved address makes the saved assumption invisible. Switching Basic/Google route views alone does not remove the assumed location. A route change between opening confirmation and Continue blocks saving. Existing disabled/invalid storage must not break route rendering.

**Scope boundary:** This does *not* yet re-anchor the Google insertion algorithm, choose a Map section, infer current GPS, or create detour maps. These are later dependent pieces; their implementation needs separate approval.

**Focused gates:** new assumed-location and existing route-card action tests, followed by exact-head full `npm test` and root JS syntax checks before merge. Post-publication user smoke: Choose Heading Here on a non-first stop, Cancel, then Continue, confirm displayed location after refresh, and confirm no Done state or stop order changed.

**Rollback:** revert this PR to `03613f100464c2ca1b74064561b010d153b7cc16`. The isolated preference is inert to older code.

**Cross-system:** No workbook/router integration impact.
