# FMR — Search and filter saved addresses for Optimize New Stop Only

**Date:** 2026-11-21
**Change level:** 2 — small Route Builder interaction, no route algorithm/storage/permissions changes.
**Operator request:** The new-stop address dropdown is long. Let the operator search saved jobs/addresses and use simple City and County dropdown filters instead of scrolling.
**Baseline/rollback:** main `05293cbde82d4c05c8b0e6bd5c99ffbbd1dc7ff5` (PR #153 deployed to Cloud Run `fmr-route-optimizer-00084-5dw`).

## Scope

- `index.html`: a search input and City/County dropdowns immediately above the existing new-stop selector, inside Route Builder's Route tools & maintenance. Reuse existing responsive two-column address filter layout; no new page or CSS rules.
- `app.js`: filter only addresses already eligible for insert-one mode, in-memory; search address, label, notes, city and county; intersect City, County, and typed words. Keep selected stop if still visible, clear selection and disable Optimize when excluded. Reuse the existing conservative `FMRAddressFilters` city/county helper and options update (no invented county or external lookup).
- `index.html` app.js cache pin and the tests that check it.
- `tests/google-insert-stop-filters.test.js`: focused dynamic render fixtures with eligible/ineligible addresses, combination of City+County+search, selection retention/clearing, disabled button, no localStorage write.

## Boundaries and risk

**Reads:** saved address list and optional explicit county metadata; existing current Google route eligibility; the typed search/filter values. Town/city is inferred only when the saved address has a clear comma-delimited city and state. In the current saved-stop schema county is generally not available; those entries show **Unknown county** instead of claiming a county or doing paid geocoding.

**Writes:** DOM options and button disabled state only, never saved routes, stored stops, Google Drive, workbook, navigation, backend, or Google route API. Existing sign-in, stale-route checks, exact stop identity, Google insertion request and atomic commit remain unchanged.

**Testing:** focused filter tests and existing insertion tests; final exact-head complete `npm test` and root JavaScript syntax gate from CI. Live smoke: in Route Builder, type a street, choose City/County, confirm only matching eligible saved addresses appear, choose one, verify search clear and selection behavior. Do not trigger paid Google Optimize for this UI-only update.

**Rollback:** revert the scoped search/filter PR to baseline as governed if picker becomes unusable. No storage migration required.

**Integration:** No workbook/router integration impact.
