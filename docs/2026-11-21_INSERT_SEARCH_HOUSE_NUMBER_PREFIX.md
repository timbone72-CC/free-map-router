# FMR — Numeric new-stop search must match the house-number prefix

**Date:** 2026-11-21  
**Level:** 2, narrow Route Builder interaction fix  
**Base/rollback:** `main` at `f03439e863c163f084c51276b7abcce03d528a11` (PR #155).

## Problem and requested behavior

In **Optimize New Stop Only → Search saved addresses**, typing `1` previously matched any occurrence of "1" in the entire saved address, including street name and ZIP, and in labels/notes. The operator wants left-to-right house-number matching: `1` matches numbers beginning with 1, `12` narrows to numbers beginning with 12, and `121` narrows to 121. Existing City and County filters continue to limit the candidates. Normal street/text search remains available.

## Narrow scope

- `app.js` owning `renderGoogleInsertionChoices`: when the query starts with a standalone numeric token, compare those digits **only** with the beginning of the saved street-address string. Match any remaining words across the existing text search fields. Retain ordinary string search for nonnumeric queries, including `1st` (a street-name query), and preserve eligible-stops-only filtering, exact selection and disabled state. The placeholder reflects numeric matches as well.
- `index.html`: bump only `app.js` cache pin, so loaded clients receive the fix.
- `tests/google-insert-stop-filters.test.js`: focused tests for left-to-right digit narrowing, street-number prefix versus digits elsewhere, City/County intersections, text remainder, no-match feedback and unrelated text searches. Update tests that pin app script version.

**Read:** already saved eligible address display names and current City/County/search selections.  
**Write:** only filtered dropdown options and disabled UI state. No address/route storage writes, Google optimizer requests, Google Drive operations, workbook handoff, schema migrations, or permissions changes.

## Verification and release

Focused test `node --test tests/google-insert-stop-filters.test.js`; final CI `npm test` plus root JavaScript syntax gate on exact final head. After release, type `1`, `12`, `121` in saved-stop search under a selected City/County; ensure only address house numbers starting with those digits remain, then confirm a street-name search still works. Do not trigger the paid Optimize action for this UI smoke check.

**Rollback:** revert this narrow feature PR to prior working main commit if the picker regresses.  
**Cross-system:** no workbook/router integration change.
