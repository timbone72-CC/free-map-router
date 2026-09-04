# Phase 2G — Work-Item Planning Foundation Implementation Record

**Date:** 2026-09-03  
**Status:** IMPLEMENTATION IN PROGRESS / FOUNDATION, EXACT WRITE SEAM, AND MINIMAL OPERATOR CONTROLS BUILT / NOT MERGE-READY  
**Change class:** Level 3  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/phase-2g-work-item-planning-20260903`  
**Governed base:** `7fc6d1a26aec36abf39500b4f34e7449ddfe2c4c`  
**Impact record:** `docs/PHASE_2G_WORK_ITEM_PLANNING_IMPACT_RECORD_2026-09-03.md`

## Purpose

Record the Phase 2G runtime foundation as it is implemented so later work does not have to reconstruct the data model, backup boundary, route-snapshot seam, mutation boundary, operator-control boundary, or deferred scope from commit history.

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

### Revision and conflict model

Planning edits require the expected current revision. An older edit cannot silently overwrite a newer record.

Same-revision conflicting records fail closed rather than choosing a winner by timestamp alone.

The exact runtime mutation seam uses compare-and-save semantics:

- `expectedRevision: 0` means create this exact work item only if it does not already exist;
- an existing record can be edited only when `expectedRevision` equals its exact current saved revision;
- a stale or duplicate create/edit attempt fails with a reload-before-edit error;
- runtime mutation re-reads durable local planning storage immediately before every save so a stale in-memory copy does not blindly overwrite a newer stored revision;
- a same-value save is a no-op and does not manufacture another revision.

This local revision boundary reduces stale-write risk. It is not a substitute for a future transactional cross-device synchronization provider.

### Exact per-work-item write API

`work-item-planning-runtime.js` exposes targeted runtime operations:

- `list()` — read-only copies of all normalized planning records;
- `get(kind, workItemId)` — one exact planning record or `null`;
- `save(kind, workItemId, draft, { expectedRevision, now })` — create or edit one exact work item;
- `projectRoute(...)` — existing read-only route planning projection seam.

The previous public whole-collection `replace(records)` mutation surface is removed. Whole-collection persistence remains internal for governed initialization, normalization, and backup restore only.

The write API accepts only the Phase 2G planning fields:

- `serviceMinutes`;
- `assignedDate`;
- `lockedDay`.

Identity, address, route position, revision, schema version, and timestamps supplied inside a caller draft are not accepted as write fields.

Exact identity comes only from the API arguments `kind` and `workItemId`.

Validation behavior:

- service minutes must remain a positive number when supplied, or may be cleared to `null`/blank;
- assigned date must remain a valid local `YYYY-MM-DD` value, or may be cleared;
- `lockedDay` must be an actual boolean `true` or `false` so a string such as `"false"` cannot accidentally become a locked day;
- at least one supported planning field must be supplied.

`assignedDate` and `lockedDay` remain independent planning fields exactly as approved by the Phase 2G model. This UI slice does not invent an additional rule requiring one field to be present before the other can be saved.

Workbook and manual-gig records with the same text ID remain separate because `kind + workItemId` is the identity key.

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

It initializes and normalizes local planning storage, participates in the existing backup restore hook, returns copies of records to consumers, exposes exact per-item read/write operations, and exposes a route-projection seam.

The route-projection dependency remains intentionally lazy. `route-work-planning.js` is not loaded merely to support the minimal editor because the editor reads the exact Order IDs and Gig_IDs already present in the active route snapshot and does not need route-level optimization output.

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

Example supported by the foundation:

- one physical stop;
- workbook Order A = 5 minutes;
- workbook Order B = 20 minutes through a verified interior resolver;
- one driving stop;
- two distinct work identities;
- derived stop service time = 25 minutes.

### Minimal operator planning controls

Added `work-item-planning-controls.js` as an isolated Build Route editor rather than expanding every route row into its own form.

The existing `route-work-controls.js` keeps ownership of its proven InspectorADE/manual clear behavior and only loads the planning-control module. The planning module is safe whether it finishes loading before or after `DOMContentLoaded`.

The Build Route planning surface is intentionally compact:

- one **Plan Work Item** panel;
- one exact work-item selector for the active Google or Basic route;
- one service-minutes field;
- one assigned-day field;
- one locked-day checkbox;
- one **Save Planning** action;
- one small status area.

The selector is derived only from the exact identities already attached to the active route snapshot:

- workbook work from `orderIdsByStopId`;
- manual work from `gigIdsByStopId`.

Several work items at one physical address remain separate choices. A workbook Order ID and a Gig_ID with the same text also remain separate because the selector key includes `kind + workItemId`.

If the same exact work identity is attached to two different route stops, the editor fails closed instead of presenting a potentially unsafe choice.

The form never writes planning storage directly. It uses only the exact runtime `get()` and `save()` operations.

When a record is loaded, its current revision is carried in the form. A stale save is not silently retried: the current saved record is reloaded and the operator is told to review it before saving again.

The editor does not add:

- generic priority;
- route date/departure/home-by controls;
- Google optimization request changes;
- work-code inference;
- workbook handoff fields;
- another route-history store;
- another page or a repeated form under every stop.

## Focused verification completed

Committed focused coverage includes:

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
- missing route-projection browser module not breaking existing app startup;
- exact per-item creation at revision zero;
- exact per-item edit with revision increment;
- unrelated planning records preserved during one-item edits;
- clearing service minutes, assigned day, and locked-day state;
- same-value save avoiding revision churn;
- stale edit rejection after a newer write;
- re-read-before-save rejection of an externally newer stored revision;
- duplicate create-only attempts rejected;
- unsupported-only/invalid drafts rejected;
- absence of a public whole-collection replace mutation API;
- minimal planning UI using the exact runtime API rather than direct storage writes;
- exact Order-ID/Gig_ID selector derivation from route snapshot metadata;
- same-address multi-work-item separation;
- same-text workbook/Gig_ID separation;
- duplicate exact identity across two route stops failing closed in the editor;
- stale form revision being retained and reloaded rather than silently retried;
- assigned-day and locked-day remaining independent approved fields.

The exact write-seam focused harness previously passed **7/7** mutation checks and the runtime passed Node syntax checking.

For the minimal operator-control slice, the final local focused harness passed **6/6** checks and `work-item-planning-controls.js` passed Node syntax checking.

The repository currently has no branch-push GitHub Actions run for this branch, so no CI result is claimed for this slice.

The complete repository suite has **not** been run yet. Per the testing contract, that remains part of the exact-final-head runtime gate rather than a claim made after every intermediate slice.

## Current non-effects

Phase 2G now changes the Build Route UI only by adding the compact exact-work-item planning editor described above.

It still does **not** change:

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

## Next Phase 2G slice

The exact planning store, backup protection, route projection, revision-safe write seam, and minimal operator editing surface now exist.

The next safe step should validate this first visible planning surface against the affected Build Route/manual-gig regression boundary before expanding Phase 2G further. After that validation, a later Phase 2G slice can expose derived route/stop service-time information from `route-work-planning.js` without changing Google Route Optimization requests, which remain Phase 2H.

Do not add multi-day Route Plans, route date/departure/home-by controls, Google service-duration requests, or unverified interior-code mappings as part of this minimal editor.

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
