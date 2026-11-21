# FMR — New Stop Preview / Backtracking Warning (Phase 2)

**Date:** 2026-11-21
**Change class:** Level 2 — new local confirmation UI around an existing Google insertion request. No new route algorithm, storage contract, API permission, or workbook handoff change.
**Rollback point:** `main` at `c41f95e4964f706f52d4658bfddcb4b586cfe3ea` (merged Phase 1, PR #158).

## Operator request

When inserting a saved address into the already optimized Google Route, first calculate the proposed stop position, show the neighboring addresses and proposed map section, and warn when the new stop would be ordered behind **Heading Here**. **Continue** commits this existing Google response; **Cancel** (or Escape/close) keeps the route as it was. This phase does not create a new route map, introduce a split-capacity algorithm, reorder previously routed stops, or change which jobs are complete.

## Scope and ownership

- `google-route-browser.js`: render one native modal after the existing Google calculation and backend response validation, but **before** invoking the existing atomic insertion writer. Display proposed insertion between named addresses, section from the existing `FMRRouting.buildGoogleMapsRouteSections`, and possible backtracking relative to the current device's confirmed `FMRAssumedRouteLocation`. If assumed stop is not on the active Google route, say that the warning is unavailable rather than guessing. Continue/Cancel/Escape close the dialog. Missing dialog aborts without writing.
- `index.html`: native modal with real Continue/Cancel buttons, status content, and updated `google-route-browser.js` cache pin.
- `tests/google-route-insertion-ui.test.js`: actual signed-in insertion with modal Continue or Cancel, stale-route checks, backtracking cases, existing multi-map section placement, and invalid reorder refusal.

## Read/write boundaries

**Reads:** active Google route and selected saved stop, Google optimization response, current device's opt-in Heading Here preference, existing map-section formatter.

**Writes:** `Continue` alone invokes the **existing** `FMRRouteBridge.applyGoogleInsertionResult` writer. **Cancel** never calls it. Existing computation/timing setup is unchanged. No Drive, workbook, GPS, completion or Basic Route writes added; no permanent preview storage.

## Safety and scope exclusions

- Previously optimized stops remain in their original relative order. A malformed response is rejected before review. Existing expected-plan/guard and atomic commit check are executed again on Continue. Edits in another tab between calculation and Continue must not overwrite the route.
- The warning is **route-order-based**, not a measured geographic detour; it must not infer the driver's GPS.
- The displayed map number is **proposed** based on the existing automatically generated map sections. Map capacity changes, forced new maps, alternate detour map planning, and route re-anchoring are not included in this phase.
- Unrelated pages and import/return workflows must remain unchanged.
- **Cross-system:** No workbook/router integration impact.

## Verification and handoff

**Focused tests:** `node --test tests/google-route-insertion-ui.test.js` plus the related Google UI and route-card tests if modified by changed script loading.

**Final gate:** once on final runtime head, `npm test` plus root `node --check` (or the exact-head GitHub CI if available). Do not merge on a failed gate.

**Operator smoke after merge and Pages publication:** On Build Route, choose an eligible saved address; press **Optimize New Stop Only**; verify the review's position, map label and backtracking statement. Try Cancel first and confirm saved route unchanged; then calculate again and press Continue. Verify it appears at the proposed position with the old order preserved.

**Rollback:** revert this PR to `c41f95e4964f706f52d4658bfddcb4b586cfe3ea`. No data migration or cleanup required.
