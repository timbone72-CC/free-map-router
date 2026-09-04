# Phase 2G — Work-Item Planning Foundation Implementation Record

**Date:** 2026-09-03  
**Status:** IMPLEMENTATION VALIDATION COMPLETE / GOVERNANCE CLOSURE PENDING / NOT MERGED OR DEPLOYED  
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
- `projectRoute(...)` — read-only route planning projection seam.

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

The route-projection dependency remains lazy rather than becoming a new unconditional startup dependency. `route-work-controls.js` now loads `route-work-planning.js` immediately before the Phase 2G planning-controls consumer when the Build Route planning surface is needed. Existing app startup ownership, route history, and optimizer modules remain unchanged.

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

The existing `route-work-controls.js` keeps ownership of its proven InspectorADE/manual clear behavior and loads the planning projection before the planning-control module. The planning module is safe whether it finishes loading before or after `DOMContentLoaded`.

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

### Read-only Build Route service-time display

The Build Route planning surface now exposes the service-time results that were already derived by `route-work-planning.js`.

This is a display-only consumer of the governed projection; the UI does not independently recalculate or persist route/stop service totals.

For each physical route stop, the existing route row shows its derived service time. Examples:

- complete physical stop: `Service: 25 min`;
- incomplete physical stop with known workbook time and one unknown manual gig: `Service: 25 min known + 1 work item missing duration`.

The planning panel also shows the derived total route service time. Examples:

- complete route: `Route service: 45 min.`;
- incomplete route: `Route service: 30 min known + 1 work item missing duration.`

Unknown manual-gig duration is never treated as zero and never converted into a false complete route total.

A successful exact work-item planning save immediately reruns the read-only projection so the visible stop and route totals refresh without changing route order or running either optimizer.

Google Route and Basic Route may order the same physical stops differently, but the derived service time stays attached to the same physical stop through its exact route work identities.

This display slice does not send service time to Google Route Optimization and does not add departure time, route date, preferred finish, or home-by controls. Those remain Phase 2H.

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
- assigned-day and locked-day remaining independent approved fields;
- compact minute/hour formatting for derived service time;
- complete physical-stop service-time display;
- incomplete physical-stop known-time + missing-duration display;
- complete route service-time display;
- incomplete route known-time + missing-duration display;
- projection loading before the read-only service-time consumer.

The exact write-seam focused harness previously passed **7/7** mutation checks and the runtime passed Node syntax checking.

For the initial minimal operator-control slice, the local focused harness passed **6/6** checks and `work-item-planning-controls.js` passed Node syntax checking. The committed service-time display coverage expanded the complete repository suite to **373 automated tests**.

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
- the planning panel uses only the exact runtime planning API;
- multiple exact work items at one address remain separate planning choices;
- stale planning edits fail closed and reload current saved state;
- no unauthorized observer or polling behavior was introduced.

### Isolated real-browser planning-editor smoke validation

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

The successful browser run stored evidence as one-day CI artifact `phase-2g-browser-smoke-evidence` (artifact ID `9923033432`, workflow run `33835127324`).

After evidence capture, the temporary Selenium smoke script was deleted and `.github/workflows/verify.yml` was restored byte-for-byte to its standard verification content. A compare from the pre-smoke documentation head `85bb5996ff2a0b68649400f45d5f0939f433a649` to cleanup head `099170e5e9101b9a16f09df3e5ed66f1cb999822` shows **no file-content differences**; the temporary validation harness survives only in branch history/evidence, not in the resulting tree.

### Isolated real-browser service-time display validation

The read-only service-time slice received a second targeted browser smoke using the same isolated localhost + disposable headless Chrome method. No production account or Drive data was used.

The synthetic route intentionally combined:

- workbook Order 1 using the ordinary 5-minute default;
- workbook Order 2 using an exact 20-minute override;
- a manual Gig_ID at the same physical stop with no duration initially;
- a second workbook-only physical stop using the ordinary 5-minute default.

Before the manual duration was supplied, the real browser showed:

- shared physical stop: `Service: 25 min known + 1 work item missing duration`;
- second physical stop: `Service: 5 min`;
- route total: `Route service: 30 min known + 1 work item missing duration.`

The smoke then saved `15` minutes to the exact manual `GIG-1`. Without reoptimizing or changing route order, the browser immediately changed to:

- shared physical stop: `Service: 40 min`;
- route total: `Route service: 45 min.`

The targeted smoke also confirmed:

- the 15-minute override was saved only to exact `GIG-1` at planning revision 1;
- switching to Basic Route retained the same 45-minute route service total despite physical-stop reordering;
- the 5-minute second-stop service time remained attached to that physical stop after reorder;
- the completed 45-minute route service total survived browser reload;
- no unexpected severe browser console entries remained after excluding only exact preview-environment favicon and unsigned Google/FedCM noise.

On targeted browser-validation head `076a91d0301926e4ba5e853a158d5141ae16f8d9`, the normal repository verification also passed **373 / 373 automated tests** and all first-party root JavaScript syntax checks before the browser smoke completed successfully.

The successful targeted browser run stored one-day evidence artifact `phase-2g-service-time-browser-smoke-evidence` (artifact ID `9925306772`, workflow run `33842268441`).

After evidence capture, the temporary service-time Selenium script was deleted and `.github/workflows/verify.yml` was again restored exactly to the standard verification workflow. Comparing committed service-time code head `760903139bcf2954a2a56167372f5241beb9c5bb` to cleanup head `33a6fb54499a97dbc4d9ad3dd8fdec272392fd17` shows **zero file-content differences**.

## Current non-effects

Phase 2G now changes the Build Route UI only by adding:

- the compact exact-work-item planning editor;
- read-only service time beside each physical route stop;
- one read-only total route service-time summary.

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

The approved Phase 2G data foundation, exact mutation seam, compact planning editor, derived physical-stop service display, derived route service total, automated regression gate, and isolated browser validations are now implemented and green.

The next safe Phase 2G action is governance closure work rather than adding Phase 2H behavior: confirm the remaining cross-system boundary/evidence requirements and decide whether the branch is ready for explicit operator merge approval.

Do not add multi-day Route Plans, route date/departure/home-by controls, Google service-duration requests, generic priority, or unverified interior-code mappings as part of Phase 2G closure.

## Validation and remaining governance gate

Phase 2G implementation validation is complete on the governed branch:

- automated full repository suite: **PASSED — 373/373 on targeted service-time browser-validation head `076a91d0301926e4ba5e853a158d5141ae16f8d9`**;
- first-party root JavaScript syntax checks: **PASSED**;
- affected automated saved-data/manual-gig/Build Route/service-time regression checks: **PASSED**;
- isolated real-browser planning-editor smoke: **PASSED — 22/22 checks on browser-validation head `30bd951c69e08d726f6f284d670933cbe47eab31`**;
- isolated real-browser service-time display smoke: **PASSED on browser-validation head `076a91d0301926e4ba5e853a158d5141ae16f8d9`**;
- temporary browser-validation harness/workflow changes: **REMOVED / standard workflow restored; no resulting file-content diff versus committed service-time code head**;
- exact service-time-slice diff review from prior validated head `1c9b75cf00caac301e62c97db41987bddb94c485`: **PASSED — only `route-work-controls.js`, `work-item-planning-controls.js`, `tests/work-item-planning-controls.test.js`, and this implementation record differ**;
- final standard workflow on documentation head `1ec64e26adec1ca355a631c3e4448905358ec6cc`: **PASSED — complete regression suite and first-party JavaScript syntax checks**;
- PR #77 resulting file list after cleanup: **15 intended Phase 2G files; no temporary Selenium smoke script or preview-workflow content remains**.

Remaining governance boundaries before merge:

- any required cross-system reality evidence remains governed separately, including the Phase 2F producer boundary;
- explicit Level-3 operator approval is required before merge.

No merge or deployment is authorized by this implementation record.
