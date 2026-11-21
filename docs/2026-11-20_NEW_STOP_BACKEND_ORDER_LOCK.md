# FMR — Optimize New Stop Only (Google Route)

**Date:** 2026-11-20
**Status:** Backend and Route Builder workflow implemented on draft PR #153; **not merged or deployed**.
**Change level:** 3 — new Google optimization mode and guarded route persistence.
**Base / rollback:** `main` at `4432fe8b893b7b3fd1821df8757aaf0d271e835f`, Cloud Run revision `fmr-route-optimizer-00083-lhj` previously verified healthy.
**Approved original design:** draft PR #142, `docs/2026-11-13_OPTIMIZE_NEW_STOP_ONLY_PLAN.md`.

## Operator flow and acceptance

1. Select **Google Route** (including the active Day's Google Route).
2. Open **Route tools & maintenance**, select exactly one **saved address** not already on that Google route, then tap **Optimize New Stop Only**.
3. While Google calculates, all existing stops retain their order. The chosen new stop may be inserted at any position, Home stays start/finish.
4. Only after validating Google's full response and detecting no intervening edit does FMR save a new Google route. The existing Basic Route, other Days, pending workbook inbox, corrected pins and represented work identities are preserved. The app does **not** automatically send route order back to the workbook.

A first-time address must be saved in FMR before it can be inserted. Existing full-route Google Optimize remains a separate button and behavior.

## Code ownership and protected data

- `google-route-contract.js`: optional request `insertion: {newStopId}`, accepted only when appended after existing stops. Validate the returned order contains every existing stop once in identical relative order, and exactly one new stop. Reject missing, duplicate, invented, skipped or reordered stops.
- `google-route-provider.js`: Google ShipmentModel `precedenceRules` link consecutive old delivery visits; Google chooses the insertion position of the unconstrained new stop. Normal full optimization is unchanged. Google API docs: https://developers.google.com/maps/documentation/route-optimization/reference/rest/v1/ShipmentModel
- `google-route-server.js`: preserve the opt-in insertion descriptor through geocoding and use the existing company-authenticated API endpoint. No new permissions.
- `index.html`: saved-address dropdown and explicit button in the existing Route tools layout; no new top-level page or stylesheet changes.
- `app.js`: show only eligible saved addresses, validate actual saved Home/pin/route plan and selection fingerprint before applying, prohibit cross-day/old completed stop insertion and work-backed stops needing an exact-work assignment. No silent work reassignment.
- `google-route-browser.js`: reuse signed-in Google request, workday and Home By controls, refresh after Google returns, reject stale context, validate full response and schedule before committing.
- `route-history.js`: one guarded localStorage write changes only the active Day's Google Route; fail closed on mismatched plan ID/revision/Day, reordered/missing/duplicated stops, other-day ownership, and invalid schedule. Same Day's Basic, other Days, pending inbox and exact existing Order IDs/Gig IDs remain unchanged.
- `tests/google-route-insertion-backend.test.js`: provider precedence, request validation, geocoding, realistic 40-stop fixture, beginning/middle/end, invalid/reordered results.
- `tests/google-route-insertion-ui.test.js`: route snapshot and workbook handoff, atomic persistence, stale-route refusal, time-aware schedule, multi-day stop eligibility, signed-in control and in-flight edit refusal.

**Reads:** saved stops and corrected pins, current Home, exact active Day/Route Plan, service durations, workday context, company sign-in, Google route provider output.
**Writes:** only active Day Google route, its optimization status, and its new valid Google schedule on explicit successful insertion. No new Drive, workbook, address, work-item or schema writes. The existing Google optimize call can incur the project's ordinary API charges.

## Failure and recovery

- Unknown address, duplicate physical stop, different-Day or completed stop, missing exact work assignment, unverified Home, invalid workday or infeasible Home By, Google timeout/error/invalid response, large precedence rejection, stale route/Day/pin/planning state, or a conflicting workbook send: **no insertion**, no automatic full-route fallback, and a visible error.
- Old stop order is always validated after Google responds. The selected new stop is a saved address ID, not a new work-order ID. Attached existing work never changes identity.
- Normal Google Optimization is unaffected when no `insertion` descriptor is passed. No change to storage/backup schema, client or Google permissions, or backend service.
- Cloud Build is operational following PR #152, but passing GitHub CI does not prove Google accepts a new precedence request live. A controlled live check remains required after an approved merge.
- If the verified baseline changes unexpectedly, restore the prior working `main` commit through the project's rollback process. Avoid unattended retries.

## Verification and release gate

- Run focused insertion tests during development and final complete `npm test` plus root `node --check` once on exact final branch head; passing exact-head GitHub Actions CI satisfies this.
- Confirm the actual Build Route control, single Day/Google persistence, unchanged Basic/other Days and workbook return in tests.
- Before declaring release successful, inspect real Cloud Build deployment and complete one explicit, affected live route check to confirm Google precedence behavior and the final selected stop order. No paid Google calls or live route changes are triggered from this draft.
- **No workbook/router integration change** (existing Send Route Order remains explicit and unchanged).
- **Pre-merge Level 3 approval:** Not requested/granted for this draft; merging deploys the Google backend automatically, so authorization must be explicit.
