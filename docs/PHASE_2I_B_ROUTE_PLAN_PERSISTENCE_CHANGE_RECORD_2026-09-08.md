# Phase 2I-B — Route Plan Persistence / Backup Change Record

Date: 2026-09-08
Repository: `timbone72-CC/free-map-router`
Branch: `feat/phase-2i-b-route-plan-persistence`
Governed base: `79d9818a493ea74224af26ad751ddedf570c5de9`
Change level: Level 3 — durable route-plan / backup state migration
Status: IMPLEMENTED ON BRANCH — MERGE REQUIRES EXPLICIT LEVEL-3 APPROVAL

## Authorization

The operator authorized Phase 2I-B after Phase 2I-A was merged. During implementation review, `google-route-browser.js` was found to bypass `route-history.js` and directly read/write the raw `google.schedule` storage path. A canonical route-history v7 shape would otherwise break schedule persistence.

The operator explicitly approved the 2I-B scope amendment to include a narrow `google-route-browser.js` schedule-storage adapter. This change record treats that approval as part of the governed 2I-B scope.

## Purpose

Introduce the durable persistence boundary needed for Phase 2I multi-day Route Plans while preserving the current one-day user experience.

This slice does not add Day 2/Day 3 UI, automatic splitting, Replan Remaining, completion history, new provider calls, or new permissions.

## Runtime changes

### `route-history.js`

- bumps route-history schema from v6 to v7;
- persists one canonical object: `version + activePlan + pending`;
- migrates current v6 Google/Basic/dayContext state into one valid Route Plan / Day;
- retains compatibility getters for the current one-day app (`google`, `basic`, `dayContext`) without persisting duplicate top-level copies;
- preserves independent Google and Basic route orders/status/identity metadata;
- preserves newer workbook route as `pending`;
- keeps missing legacy Workday context null rather than fabricating timing;
- adds plan/day revision updates and stale plan-write conflict protection;
- preserves valid Google schedule only while its governed route/day basis remains current;
- adds canonical `readGoogleSchedule` / `writeGoogleSchedule` APIs;
- supports deliberate backup restore through an explicit restore-replacement marker;
- preserves stop-ID remap and manual-gig membership behavior against the active plan.

### `backup.js`

- bumps whole-app backup from v4 to v5;
- writes canonical route-history v7 / Route Plan state;
- restores backups v1, v2, v3, and v4 through the existing migration path into a one-day v7 plan;
- round-trips v5 plan/day identity and Google schedule;
- keeps invalid v5 Day timing fail-closed;
- preserves existing gig and work-item planning backup ownership.

### `google-route-browser.js`

Approved narrow scope amendment only:

- schedule validation remains in the existing browser owner;
- raw route-history JSON read/write is removed from Google schedule persistence;
- schedule read/write delegates to `FMRRouteHistory.readGoogleSchedule` / `writeGoogleSchedule`;
- stale-route errors retain the existing `STALE_ROUTE` browser error behavior;
- Google authentication, request shape, backend endpoint, optimizer behavior, timeout behavior, and provider calls are unchanged.

### `index.html`

Dependency wiring only:

- loads `route-plan.js` before `route-history.js`;
- bumps route-history, backup, and Google browser cache versions;
- no markup/control/layout behavior changes.

## Non-scope

2I-B does not implement:

- multiple visible Days;
- day selector;
- automatic day assignment/splitting;
- moving/locking work across Days;
- Replan Remaining;
- permanent completion history;
- new route-order/workbook schemas;
- new Drive files or permissions;
- Google API/provider behavior changes;
- automatic Google calls.

## Migration invariants

1. Existing v6 Google and Basic variants migrate independently.
2. Exact workbook Order IDs and manual `Gig_ID`s remain attached to their physical stop.
3. One v6 active route becomes one active Route Plan with one Day.
4. Missing v6 Workday context stays null.
5. Valid Google schedule remains only when its route/day basis remains valid.
6. Newer workbook route remains pending and is not consumed during migration.
7. App-only route stops remain represented as standalone plan stops rather than fabricated jobs.
8. Persisted v7 has no duplicate top-level `google`, `basic`, or `dayContext` copies.
9. Stale plan revisions fail closed.
10. Explicit backup restore may replace the saved plan because the operator deliberately chose restore.

## Verification required before merge

Focused tests must cover:

- v6 → v7 canonical migration;
- Google/Basic differing route orders;
- exact work identity and standalone-stop survival;
- pending route preservation / Start New Route;
- revision conflict;
- stop-ID remap;
- Google schedule canonical persistence and stale route protection;
- backup v5 round trip;
- backup v1–v4 restore compatibility;
- invalid v5 timing rejection;
- Google browser route-history adapter without raw storage access.

The exact PR head must then pass the complete repository test suite and first-party JavaScript syntax gate before Level-3 merge approval is requested.

## Live behavior before merge

None. This branch must not be merged/deployed until the operator receives the exact diff, CI evidence, migration evidence, and rollback path and explicitly approves the Level-3 merge.

## Rollback

Pre-merge rollback is simply branch/PR abandonment; `main` remains at the governed base.

After an approved merge, rollback is to the pre-2I-B main commit `79d9818a493ea74224af26ad751ddedf570c5de9`. Because a live browser may already have written route-history v7 / backup v5 after deployment, post-publication rollback must not silently overwrite newer v7 state with an older runtime. If rollback is needed after live v7 writes, preserve a v5 backup first and use an explicit governed recovery path.
