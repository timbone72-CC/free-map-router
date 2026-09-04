# Phase 2G — Work-Item Planning Foundation Implementation Record

**Date:** 2026-09-03  
**Status:** IMPLEMENTATION IN PROGRESS / AUTOMATED + ISOLATED REAL-BROWSER BUILD ROUTE/MANUAL-GIG VALIDATION PASSED / NOT MERGE-READY  
**Change class:** Level 3  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/phase-2g-work-item-planning-20260903`  
**Governed base:** `7fc6d1a26aec36abf39500b4f34e7449ddfe2c4c`  
**Validation PR:** draft PR `#77` — validation only, not merge authorization  
**Impact record:** `docs/PHASE_2G_WORK_ITEM_PLANNING_IMPACT_RECORD_2026-09-03.md`

## Purpose

Record the Phase 2G runtime foundation as it is implemented so later work does not have to reconstruct the data model, backup boundary, route-snapshot seam, mutation boundary, operator-control boundary, validation evidence, or deferred scope from commit history.

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

## Build Route + manual-gig regression validation

A draft pull request, **PR #77**, was opened only to run the repository's governed verification workflow without pushing or merging to `main`.

The first exact-head CI run found one stale test expectation in `tests/manual-gig-backup.test.js`:

- 366 of 367 tests passed;
- the sole failure still asserted that the current whole-app backup version was `2`;
- Phase 2G had already intentionally advanced the current backup format to version `3` so planning records can be preserved;
- no runtime defect was identified by that failure.

Only the stale current-version test expectation was updated:

- the current-backup test now expects version `3`;
- the explicit legacy version-2 restore test remains in place;
- the legacy version-1 restore test remains in place;
- no manual-gig runtime or schema file was changed to make the test pass.

On the resulting exact runtime/test head `374103b97705a583ee63e435abf5fd8f2c4640fd`, the governed GitHub verification workflow passed:

- **367 / 367 automated tests passed**;
- **0 failures**;
- complete `node --test tests/*.test.js` regression suite passed;
- first-party root JavaScript syntax checks all passed.

Affected Build Route/manual-gig evidence inside that green suite includes:

- Build Route keeps separate InspectorADE/manual-gig clear controls;
- existing clear controls retain their previous ownership and behavior;
- one included manual gig adds its physical stop once to both route variants;
- two manual gigs at one physical property never create two driving stops;
- removing a gig does not remove a stop that still has other route work;
- workbook Order IDs protect shared stops;
- stop-ID remaps carry Gig_ID route metadata correctly;
- normal gig edits preserve route selection and new gigs remain unchecked;
- manual-gig dates and completion behavior remain intact;
- current backup v3 preserves gigs while legacy v1/v2 backups remain restorable;
- route numbering, Google/Basic route slots, route order return, navigation, pay summaries, source identity, and address-correction identity tests remain green;
- the new planning panel uses only the exact runtime planning API;
- multiple exact work items at one address remain separate planning choices;
- stale planning edits fail closed and reload current saved state;
- no unauthorized observer or polling behavior was introduced.

### Isolated real-browser smoke validation

A controlled browser validation was run against Phase 2G without replacing or publishing the live production app. The test environment used the PR checkout served only on the GitHub Actions runner's localhost, a disposable headless Chrome session, and synthetic localStorage route/gig/planning fixtures. It did not sign in to the production Google account, write Google Drive data, change GitHub Pages, change Cloud Run, merge the PR, or deploy production.

The first browser attempt exposed a harness-counting mistake, not an app defect: Build Route intentionally renders Start + physical stops + Finish as top-level list rows. The smoke selector was corrected to count only the existing `li[data-stop-id]` physical-stop rows. A later console check also initially flagged the expected unsigned-preview message `Not signed in with the identity provider.`; the final harness excluded only that exact expected test-environment message plus the already-irrelevant favicon/Google-sign-in network noise. No first-party uncaught browser errors were present.

On isolated browser-validation head `30bd951c69e08d726f6f284d670933cbe47eab31`, the governed workflow passed the normal **367 / 367** automated tests and root JavaScript syntax checks before the browser smoke. The browser smoke then passed **22 / 22** checks, including:

- exactly one Plan Work Item panel is present;
- the Google route renders each physical stop once;
- six exact synthetic work items are visible across three physical stops;
- two workbook Order IDs and two manual Gig_IDs can share one physical stop without duplicating the driving stop;
- a workbook Order ID and a Gig_ID with the same text remain separate exact identities;
- the manual-gig planning label retains source, work-order text, Gig_ID, and address context;
- switching Google Route → Basic Route rerenders the route and retains all exact work identities;
- exact workbook planning saves service minutes, assigned day, locked-day state, and revision 1;
- a same-text manual Gig_ID saves independently without writing the workbook identity;
- saved planning survives browser refresh and reloads into the visible editor;
- manual-gig records remain intact after planning edits;
- the shared physical stop remains one stop in both Google and Basic route snapshots;
- planning edits do not rewrite route Order-ID/Gig_ID metadata;
- repeated page navigation does not duplicate the planning UI;
- the planning surface shows no meaningful horizontal overflow at a 390-pixel phone viewport;
- Build Route remains interactive after a 31-second dwell;
- no first-party uncaught browser errors were captured;
- no unexpected first-party severe console entries remained.

The successful browser run stored evidence as one-day CI artifact `phase-2g-browser-smoke-evidence` (artifact ID `9923033432`, workflow run `33835127324`). The artifact contains the exact passing check results and the synthetic planning/route state used for the smoke.

After evidence capture, the temporary Selenium smoke script was deleted and `.github/workflows/verify.yml` was restored byte-for-byte to its standard verification content. A compare from the pre-smoke documentation head `85bb5996ff2a0b68649400f45d5f0939f433a649` to cleanup head `099170e5e9101b9a16f09df3e5ed66f1cb999822` shows **no file-content differences**; the temporary validation harness survives only in branch history/evidence, not in the resulting tree.

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

## Next Phase 2G step

The affected automated regression gate and the isolated real-browser Build Route/manual-gig smoke are now green. The next Phase 2G slice may expose **derived route/stop service-time information** from `route-work-planning.js` without changing Google Route Optimization requests, which remain Phase 2H.

Do not add multi-day Route Plans, route date/departure/home-by controls, Google service-duration requests, generic priority, or unverified interior-code mappings as part of that next Phase 2G slice.

## Final gate still required

This branch is not merge-ready until the remaining Level-3 evidence is completed on the final governed head:

- automated full repository suite: **PASSED on runtime/test head `374103b97705a583ee63e435abf5fd8f2c4640fd`**;
- first-party root JavaScript syntax checks: **PASSED on the same runtime/test head**;
- affected automated saved-data/manual-gig/Build Route regression checks: **PASSED**;
- isolated real-browser smoke for the new visible planning editor: **PASSED — 22/22 checks on browser-validation head `30bd951c69e08d726f6f284d670933cbe47eab31`**;
- temporary browser-validation harness/workflow changes: **REMOVED / standard workflow restored; no resulting file-content diff versus pre-smoke head**;
- exact final diff review after any remaining Phase 2G implementation/documentation change;
- any required cross-system reality evidence remains governed separately;
- explicit Level-3 operator approval is required before merge.

No merge or deployment is authorized by this implementation record.
