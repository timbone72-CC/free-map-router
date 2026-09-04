# Phase 2G — Work-Item Planning Foundation Implementation Record

**Date:** 2026-09-03  
**Status:** IMPLEMENTATION IN PROGRESS / FOUNDATION SLICES BUILT / NOT MERGE-READY  
**Change class:** Level 3  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/phase-2g-work-item-planning-20260903`  
**Governed base:** `7fc6d1a26aec36abf39500b4f34e7449ddfe2c4c`  
**Impact record:** `docs/PHASE_2G_WORK_ITEM_PLANNING_IMPACT_RECORD_2026-09-03.md`

## Purpose

Record the Phase 2G runtime foundation as it is implemented so later work does not have to reconstruct the data model, backup boundary, route-snapshot seam, or deferred scope from commit history.

This record does not authorize merge or deployment.

## Implemented foundation

### Exact work-item planning store

Added `work-item-planning.js` with independent local storage key:

`fmr_work_item_planning_v1`

Planning identity is exact and structured:

- `workbook` + exact workbook Order ID / Source_ID;
- `gig` + exact immutable Gig_ID.

The store does not use address or stop ID as work identity.

The planning record carries only:

- schema version;
- work-item kind;
- exact work-item ID;
- optional explicit service-minute override;
- optional local assigned date;
- locked-day state;
- monotonic revision;
- updated-at timestamp.

### Duration rules implemented

Current governed behavior:

- ordinary workbook work resolves to 5 minutes when no exact override exists;
- a stored exact work-item override wins;
- 20 minutes is available only through an explicitly supplied verified-interior resolver;
- no InspectorADE work code is guessed or hard-coded as interior;
- a manual gig with no exact duration override remains unknown rather than inheriting an invented default.

Defaults are resolved at use time and are not bulk-written into planning storage.

### Stale-write protection

Planning edits require the expected current revision. An older edit cannot silently overwrite a newer record.

Same-revision conflicting records fail closed rather than choosing a winner by timestamp alone.

### Backup and restore

Whole-app backup format was advanced to version 3.

Version 3 preserves planning records.

Older supported backup versions remain readable:

- backup version 1 restores with no planning records;
- backup version 2 restores gigs normally and restores an empty planning collection;
- backup version 3 restores its normalized planning collection.

Planning restore is isolated from stops, gigs, and route identity. Invalid planning rows are filtered independently.

### Browser planning runtime

Added `work-item-planning-runtime.js`.

It initializes and normalizes local planning storage, participates in the existing backup restore hook, returns copies of records to consumers, and exposes a route-projection seam.

The route-projection dependency is intentionally lazy. The current app can load and operate without `route-work-planning.js` being loaded because no current UI consumes route planning yet. Calling the projection API without that module fails explicitly rather than breaking app startup.

### Exact route-work projection

Added `route-work-planning.js`.

It derives planning context from the exact work already retained by route snapshots:

- `orderIdsByStopId` for workbook work;
- `gigIdsByStopId` for manual work.

The projection:

1. preserves route stop order;
2. preserves every exact work-item identity;
3. attaches planning metadata only to the matching exact work item;
4. resolves each work item's service duration independently;
5. sums work-item duration into a derived physical-stop service time;
6. sums stop service time into a route service-time result;
7. reports known service minutes separately when a manual duration is still unknown;
8. does not mutate route snapshots or planning records;
9. ignores planning records for work that is not in the supplied route snapshot;
10. fails closed if the same exact `kind + workItemId` is attached to two different physical route stops.

Example now supported by the foundation:

- one physical stop;
- workbook Order A = 5 minutes;
- workbook Order B = 20 minutes through a verified interior resolver;
- one driving stop;
- two distinct work identities;
- derived stop service time = 25 minutes.

## Focused verification completed

The implementation has focused automated coverage for:

- workbook 5-minute default;
- explicit duration override;
- verified-only interior duration;
- shared-stop aggregation without identity merging;
- workbook + Gig_ID shared-stop aggregation;
- manual unknown duration behavior;
- planning storage normalization/read/write;
- timezone-safe local assigned dates;
- stale revision rejection;
- same-revision conflict rejection;
- address/stop correction independence;
- backup version compatibility;
- planning backup preservation;
- isolated invalid planning rows;
- backup restore runtime hook;
- route projection stop order;
- exact planning metadata attachment;
- same-text workbook and gig IDs remaining distinct;
- planning records outside the route being ignored;
- duplicate exact identity across two stops failing closed;
- projection input immutability;
- missing route-projection browser module not breaking existing app startup.

For the latest route-projection/runtime slice, 13 focused tests passed and the touched JavaScript/test files passed syntax checks in the local verification harness.

The complete repository suite has **not** been run yet. Per the testing contract, that remains part of the exact-final-head runtime gate rather than a claim made after every intermediate slice.

## Current non-effects

Phase 2G still does **not** change:

- visible app UI;
- Build Route controls;
- Google Route Optimization requests;
- Basic optimizer behavior;
- route date/departure/home-by controls;
- workbook Address Inbox schema;
- workbook runtime;
- Google Drive filenames or OAuth scopes;
- InspectorADE interior-code mapping;
- manual-gig default service duration;
- Phase 2F selectable-sync producer behavior;
- production deployment.

## Phase 2F boundary remains

Workbook Phase 2F selectable sync remains a separate governed dependency. Phase 2G uses the exact work identities already present in FMR route snapshots and does not compensate for or replace unfinished Phase 2F producer validation.

Before production planning relies on the selected workbook work pool, Phase 2F still requires its Cross-System Reality Gate evidence.

## Next Phase 2G foundation slice

The next safe slice should add exact per-item runtime write operations for planning metadata before any UI is attached to them.

That write seam should:

- create planning state only for an exact workbook Order ID or Gig_ID;
- edit an existing record only with the expected revision;
- allow service duration, assigned local day, and locked-day state to be changed or cleared without replacing the whole planning collection;
- preserve unrelated planning records;
- reject stale edits;
- remain independent of addresses and route positions;
- have focused tests before planner controls call it.

Only after that safe write seam exists should Phase 2G expose operator controls for work-item planning.

## Final gate still required

This branch is not merge-ready until the Phase 2G final runtime gate is completed on the exact final head:

- all focused Phase 2G tests pass;
- full repository test suite passes;
- all first-party root JavaScript files pass syntax checks;
- affected saved-data/manual-gig/Build Route regression checks pass;
- exact diff is reviewed for unrelated behavior;
- any cross-system field change completes the Integration Contract reality gate;
- explicit Level-3 operator approval is obtained before merge.

No merge or deployment is authorized by this implementation record.
