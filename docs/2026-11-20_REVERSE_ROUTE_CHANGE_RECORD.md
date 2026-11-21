# Reverse Route — Level 2 change record (2026-11-20)

## Problem and approved scope
The operator can manually move stops Up or Down but cannot reverse a route in one action. Add a visible **Reverse Route** button beside **Today's Route**. It reverses the currently selected Google or Basic active-Day route only.

## Owners and boundaries
- `app.js`: one click handler reusing `persistActiveRoute("manually_changed")`, and button availability during rendering.
- `index.html`: visible button and app-script cache bump.
- `tests/reverse-route.test.js`: focused click-path, route-history persistence, and active-Day route-order artifact tests.
- Reads: active route's ordered stop IDs and existing route state. Writes: selected active-Day route snapshot only.
- No new schema, route optimizer, API, Drive permission, workbook source, external write, or global route state.

## Protected behavior
- Home stays the same at both ends; only physical work stops are reversed.
- Google and Basic route snapshots remain independent. Other Days and the pending workbook route remain untouched.
- Original stop identity, workbook Order IDs, manual Gig IDs, saved addresses, pins, pay, work items and day assignments stay attached to their existing physical stops.
- The selected route's optimization status changes to **Manually Changed**; stale Google arrival-time schedule becomes invalid.
- No auto-optimization and no automatic **Send Route Order to Workbook**.
- Disabled for fewer than two stops or while a workbook route-order send is in progress.
- A second reverse restores the prior order; no new undo/history schema is added.
- Existing route-order return version 2 continues to read the saved active-Day order.

## Integration reality boundary
- Operator path: select active Day and Google/Basic slot → click Reverse Route → persisted route snapshot (browser storage) → planner route cards/map renumber → optional explicit Send Route Order to Workbook → existing `Free Map Router Route Order.json` version 2.
- The changed producer is the existing saved route snapshot. No route-order JSON field or format changes; the workbook's existing version-2 receiver continues using exact ordered stop numbers and immutable Order/Gig identities.
- Focused test invokes the actual reverse action with the real route-history writer and builds the real active-Day route-order artifact, checking reversed numbers and unchanged IDs. This does not write the shared LIVE Drive handoff file.
- **No workbook source-code or schema change.** Only the order the operator explicitly elects to send can differ.
- An eventual live UI check should confirm the displayed order reverses and persists after reload, and that Home stays at both ends. It must not require a real workbook send solely to test the button.

## Risk, rollback and verification
- Risk: accidentally reverse the wrong slot/Day, lose IDs, or retain stale schedule. Mitigation: reuse the existing active-slot/Day storage mutation and existing route-order builder; test both slots and linked identities.
- Rollback point: `main` at `1d228d217e105e8ef13670123bdc30188f3fa0a6`.
- Run the focused `node --test tests/reverse-route.test.js`; then final complete `npm test` and `node --check` on first-party JS before merge, plus a short live browser smoke check after publishing.
