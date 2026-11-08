# Start New Route within Route tools dropdown — 2026-11-07

**Change level:** Level 2 — moving one existing interactive control without changing behavior.
**Approved request:** The operator wants **Start New Route** in the same top **Route tools & maintenance** dropdown as Check Workbook Route and the other route tools.
**Rollback baseline:** `b9b7daca8b76a66d3a88f489641d45f92e60ba4d`.

## Existing behavior verified

`renderNewRouteAvailable()` in `app.js` shows `newRouteAvailable` and enables `startNewRoute` only when `routeHistory.pending?.routeIds.length` is nonzero. Usually a newer pending workbook route is loaded by **Check Workbook Route**, but a previously saved pending route can survive a reload. Clicking Start New Route checks pending work again, asks for explicit confirmation before replacing the active Route Plan and both route versions, and leaves existing work in place if cancelled.

## Minimal change

Move the **existing** `newRouteAvailable` wrapper, including its existing `newRouteAvailableStatus` and `startNewRoute` button, from just below the route planner context into the existing complete tools dropdown next to the workbook-check controls. Keep `hidden`, the current status wording, button text, element IDs, and everything in `app.js` unchanged. There is no new action, disabled rule, persistence, route snapshot, navigation, workbook handoff, Google Drive access, or CSS behavior.

**Owning file:** `index.html` only for runtime DOM movement. Existing `tests/route-quick-actions-layout.test.js` now guards location, unique IDs, pending-only rendering and the original confirmation boundary. **No workbook/router integration impact.**

## Test and live check

- Focused: `node --test tests/route-quick-actions-layout.test.js`.
- Final PR head: `npm test` and first-party `node --check` through GitHub Actions.
- Live: Open the top dropdown. Without a pending workbook route the Start New Route notice/button is absent, as before. When a new route is staged, the status and button appear in the dropdown. Cancelling the confirmation leaves the current route unchanged; accepting uses the already-approved replacement flow.
- Recovery: revert this narrowly scoped PR to restore the old notice position. No data migration, stored-state rewrite, workbook changes, or route renumbering are involved.
