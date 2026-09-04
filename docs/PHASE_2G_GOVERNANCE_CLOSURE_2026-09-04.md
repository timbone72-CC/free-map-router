# Phase 2G — Governance Closure Record

**Date:** 2026-09-04  
**Status:** GOVERNANCE EVIDENCE COMPLETE — READY FOR EXPLICIT LEVEL-3 MERGE APPROVAL AFTER FINAL DOC-HEAD CI — NOT MERGED OR DEPLOYED  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/phase-2g-work-item-planning-20260903`  
**Governed base:** `7fc6d1a26aec36abf39500b4f34e7449ddfe2c4c`  
**Validation PR:** draft PR `#77`

## Purpose

Close the remaining Phase 2G governance gates without adding Phase 2H behavior or deploying the branch.

This record supplements:

- `docs/PHASE_2G_WORK_ITEM_PLANNING_IMPACT_RECORD_2026-09-03.md`;
- `docs/PHASE_2G_WORK_ITEM_PLANNING_IMPLEMENTATION_RECORD_2026-09-03.md`.

It does not authorize merge or deployment by itself.

## Final code-level blocker repair

Governance review found one durable-data fail-closed defect before merge approval: `normalizePlanningRecord()` previously used JavaScript truthiness for stored `lockedDay`, so a damaged value such as the string `"false"` could normalize to `true`.

The repair on Phase 2G head `fef46c0d3d0f2cee175b1eb2d1cc35b89e54e8ee` makes durable planning data accept only real booleans for `lockedDay`, while an omitted field remains backward-compatible as `false`.

Focused coverage proves that:

- valid `true` and `false` survive;
- omitted `lockedDay` remains `false`;
- malformed stored values including `"false"`, `"true"`, `0`, `1`, and `null` are rejected/isolated;
- a malformed backup planning row is isolated without damaging valid backup Home/stops/planning data.

The exact governed PR workflow for that head passed:

- **374 / 374 automated tests**;
- **0 failures**;
- complete `node --test tests/*.test.js` suite;
- all first-party root JavaScript syntax checks.

The suite includes `durable locked-day data accepts only real booleans and isolates malformed values` and all previously established Phase 2G planning, route-work, Build Route, backup, manual-gig, inbox, route-history, and identity regressions.

## Cross-System Reality Gate — PASSED

Phase 2G depends on exact workbook work identities reaching Free Map Router route snapshots. That external producer/consumer boundary was validated on 2026-09-04 through the governed Phase 2F sandbox producer and the existing real FMR Drive consumer without deploying Phase 2G or replacing the operator's active route.

### Real workbook producer fixture

The InspectorADE Live Sandbox used existing `Job_Log` rows:

- OPEN + checked `Source_ID` `112615155`;
- OPEN + checked `Source_ID` `112638137`;
- both at the same physical property `12261 US HIGHWAY 283`, Sayre;
- CANCELLED + checked `Source_ID` `112044024` — must not send;
- TURNED_IN + checked `Source_ID` `112467119` — must not send;
- OPEN + unchecked `Source_ID` `112665487` — must not send.

The sandbox ran the exact Phase 2F runtime with only the sandbox identity guard's expected validation branch/upstream names changed. Production Apps Script was not deployed.

### Governed Drive handoff evidence

The governed `Free Map Router Address Inbox.json` in folder `1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf` contained exactly:

- one physical address: `12261 US HIGHWAY 283, Sayre, OK 73662`;
- exact `orderIds`: `112615155`, `112638137`;
- no cancelled, turned-in, or unchecked Order ID;
- combined expected pay `$24`, complete.

The two eligible OPEN selections were consumed after the successful send; excluded terminal rows remained selected.

### Real Free Map Router consumer evidence

The operator used **Check Workbook Route** in the existing Free Map Router app.

Observed result:

- **New Route Available — 1 job / 1 address**;
- the existing active Google route remained unchanged;
- the operator did **not** press **Start New Route**.

A subsequent governed **Back Up Now** created `Free Map Router Backup.json` at `2026-09-04T07:10:48.464Z` and captured:

- existing Google route: 83 physical stops, still `google_optimized`;
- existing Basic route: 83 physical stops;
- pending route: exactly one physical stop;
- pending stop ID: `stop_f047bd6f-1805-40c3-9494-9ed4c4bab64f`;
- pending address: `12261 US HIGHWAY 283, Sayre, OK 73662`;
- pending `orderIdsByStopId` for that stop: exactly `112615155`, `112638137`;
- pending optimization status: `not_optimized`.

This proves that the real workbook producer and real FMR consumer preserved the exact two assignment identities on one physical stop with no extras or omissions, while preserving the operator's existing route behind the pending-route safety boundary.

## Phase 2G consumption of the proven route identity shape

Phase 2G `route-work-planning.js` reads workbook work only from the route snapshot's `orderIdsByStopId` map.

For every route stop it converts each exact Order ID into:

- `kind: "workbook"`;
- `workItemId: <exact Order ID>`;
- the exact physical `stopId` from the route snapshot.

It does not derive work identity from address, source label, route position, or display text. If the same exact `kind + workItemId` appears on two different stops, it fails closed.

Therefore the real pending-route artifact captured above is exactly the governed input shape Phase 2G consumes: one physical stop carrying two distinct workbook work identities. No handoff/schema translation is required between the proven FMR route snapshot and Phase 2G planning projection.

The previously completed isolated real-browser Phase 2G validation already proved that multiple exact workbook work items at one physical stop remain separate planning identities while the stop remains one driving stop, and that read-only service totals derive from those exact identities without rewriting route metadata.

Taken together, the real cross-system artifact plus the branch-level browser/runtime evidence close the Phase 2G external identity dependency without deploying PR #77 to production merely for validation.

## Phase boundary review

Closure review confirms Phase 2G still does **not** add:

- service-duration fields to Google Route Optimization requests;
- Basic optimizer changes;
- route date/departure/preferred-finish/home-by controls;
- generic priority;
- guessed InspectorADE interior work-code mappings;
- a manual-gig default duration;
- workbook Address Inbox schema changes;
- workbook runtime changes;
- new Google Drive filenames/scopes;
- another route-history store;
- production deployment.

Those boundaries remain intact. Route timing affecting Google optimization remains Phase 2H.

## Closure conclusion

Phase 2G governance evidence is now complete subject only to the standard CI result on this documentation-only closure head.

Satisfied gates:

- approved Phase 2G impact/design boundary — satisfied;
- implementation and focused tests — satisfied;
- complete repository regression suite — satisfied on exact runtime head, 374/374;
- first-party JavaScript syntax gate — satisfied;
- isolated real-browser planning-editor validation — satisfied;
- isolated real-browser read-only service-time validation — satisfied;
- durable `lockedDay` fail-closed repair — satisfied;
- final scope/diff review — satisfied before closure documentation;
- Phase 2F workbook producer reality evidence — satisfied;
- governed Address Inbox exact-identity evidence — satisfied;
- real FMR pending-route exact-identity consumer evidence — satisfied;
- preservation of existing active route during cross-system validation — satisfied.

If the standard PR workflow passes on this documentation-only closure commit and the PR remains mergeable with no new diff, **Phase 2G is ready for the operator's explicit Level-3 merge approval**.

No merge or deployment is authorized until that explicit approval is given.
