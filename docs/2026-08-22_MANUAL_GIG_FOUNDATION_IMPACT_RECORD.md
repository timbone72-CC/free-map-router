# Manual Gig Foundation Impact Record — 2026-08-22

## Status

IMPLEMENTED ON WORK BRANCH / AWAITING CI / PRE-MERGE APPROVAL STILL REQUIRED

## Change level

Level 3 — high risk.

This first field-work runtime slice introduces a new persistent gig/work identity and therefore changes stored application data and backup behavior. It does not change Google Drive permissions, workbook handoff, routing algorithms, or deployment configuration.

## Baseline and rollback

- Implementation branch: `work/manual-gig-foundation-20260822`
- Branch base after roadmap promotion: `a111f4f8a2560fb739bdac3536afa3c105021945`
- Last live-proven runtime source before this work: `44f814c12bfd379fbfb728d757177e46017db9d1`
- Rollback for any runtime implementation: restore the runtime files from `44f814c12bfd379fbfb728d757177e46017db9d1`.
- Baseline complete-suite result: 211 tests, 211 pass, 0 fail. This was verified from the successful final CI run on the last live runtime lineage; the roadmap-only commits after that did not change runtime or tests.
- Runtime implementation authorization: user said `CONTINUE` on 2026-08-22 after the Phase 1A scope and Level 3 gate were presented.

## Exact user-facing problem

Free Map Router can store and route a physical address, but it cannot represent a manually entered paid job such as HNP as a durable work item. The current stop contract intentionally collapses one normalized physical address into one saved stop, so putting HNP/job identity into labels or notes would lose the distinction between multiple jobs at the same property.

The field-work roadmap requires manually entered gigs to have stable identity and eventually participate in route pay, work-order photos, workbook `Gig_Log`, and multi-device state without entering InspectorADE prediction history.

## Verified baseline evidence

Baseline `contract.js` uses address identity for stops:

- `SCHEMA_VERSION = 3`
- `STOPS_STORAGE_KEY = "fmr_v2_stops"`
- `normalizeStopList()` merges records by `addressKey`
- `normalizeStop()` creates `stop_*` identity for the physical stop

Baseline `backup.js` version 1 stored Home, physical stops, and route snapshots only. It had no gig/work-item collection.

The Addresses page already contained the existing Add/Edit Address form and the app had exactly five protected pages. Phase 1A preserves those five pages and adds the manual-gig surface inside Addresses.

## Architectural decision

**Do not weaken or replace physical-address stop identity.**

Keep:

- one normalized physical address -> one saved stop;
- stop ID retained across address corrections;
- Basic/Google optimization operating on physical stops;
- workbook Order IDs remaining route-snapshot metadata rather than permanent stop identity.

Add a separate persistent gig/work-item layer:

- one manual job -> one immutable `Gig_ID`;
- many gigs may reference one physical `stopId`;
- one physical route stop may therefore represent zero, one, or many manual gigs plus zero, one, or many InspectorADE Order IDs;
- manual gigs never become InspectorADE `Source_ID`s and never enter InspectorADE prediction history.

This establishes the required distinction:

`Gig/work item -> physical stop -> route position`

## Phase 1A gig schema

The implementation uses a separate gig schema rather than changing physical-stop identity:

- `GIG_SCHEMA_VERSION = 1`
- `GIGS_STORAGE_KEY = "fmr_v1_gigs"`

Each normalized gig contains:

- `schemaVersion`
- `id` — immutable internal `gig_*` ID
- `stopId` — existing physical saved-stop ID
- `source` — manual company/source such as `HNP` or `OTHER`; distinct from the governed stop `GIS`/`DCFS` source field
- `workOrderId` — optional vendor/job identifier
- `expectedPay` — optional nonnegative numeric planning value
- `notes` — optional gig-specific notes
- `routeIncluded` — explicit manual-gig route inclusion state
- `createdAt` — immutable creation timestamp
- `updatedAt` — last gig-edit timestamp

`Actual_Pay`, completion lifecycle, submission state, photo state, workbook row identity, and media metadata remain deliberately excluded from this first slice.

## Duplicate and identity rules

- `Gig_ID`, not address, is gig identity.
- Two gigs may have the same address and same physical `stopId`.
- A work-order ID is metadata and must not silently replace `Gig_ID` as internal identity.
- Saving a new gig at an already-saved address reuses the existing physical stop; it does not create a duplicate stop.
- Saving a gig at a new address creates exactly one normal physical stop and one gig.
- Editing/correcting the physical stop retains its stop ID so attached gigs remain attached.
- If existing duplicate-stop correction merges IDs, attached gigs are remapped to the retained physical stop.
- Address deletion is blocked when it would orphan a manual gig; the gig must be deleted first.

## Route behavior for this slice

Existing Basic/Google route algorithms remain physical-stop algorithms.

- A route contains a physical stop at most once.
- Multiple included gigs at one property do not create duplicate driving stops.
- Google and Basic route snapshots carry manual `gigIdsByStopId` metadata separately from workbook `orderIdsByStopId`.
- `gigManagedStopIds` records only stops added solely by manual-gig inclusion so removing a gig cannot remove a pre-existing/manual/workbook stop.
- Existing workbook `orderIds` remain unchanged and separate from `gigIds`.
- App-only/manual-gig stops continue to produce visible route-number gaps in workbook route-order return; the app never invents workbook Order IDs for them.
- Starting a new workbook route still uses the existing pending-route workflow; after a successful Start New Route, gigs with `routeIncluded=true` are reapplied to both usable route versions.

## User interface scope

The existing **Addresses** page now contains a separate Manual Gig section. No page was added, renamed, removed, or reordered.

Manual-gig entry fields:

- Address *
- Company/source (`HNP`, `Other`)
- Work order / job ID (optional)
- Expected pay (optional)
- Notes (optional)
- Include in route

The existing Add/Edit Address form remains the authority for physical-stop address/pin correction. The gig form owns gig identity and gig-specific metadata only.

## Backup behavior

Backup version 2 preserves manual gigs while version 1 remains accepted.

Requirements implemented:

- existing version-1 backups remain restorable and yield `gigs: []`;
- new backups include normalized `gigs` without changing Home or existing stop meaning;
- existing app backup controls include current browser gigs without requiring new Drive permissions or a new backup button;
- restore applies parsed gigs only when the existing confirmed restore path actually calls `restoreRoutes()`;
- invalid/orphan gig rows are omitted without damaging valid Home/stop/route data;
- restore never converts a gig into an InspectorADE job.

Full multi-device synchronization is **not** part of Phase 1A. Manual Drive backup/restore remains recovery, not live synchronization.

## Workbook/router integration impact

No existing InspectorADE workbook handoff format changes in Phase 1A.

- `Free Map Router Address Inbox.json` stays unchanged.
- workbook `orderIds` stay unchanged.
- `Free Map Router Route Order.json` stays unchanged; route-order code ignores `gigIdsByStopId` and still exports only real workbook Order IDs.
- no `Gig_Log` writes are enabled yet.
- no workbook repository runtime change is required for Phase 1A.

Phase 2 will separately govern `Gig_Log`, route pay, and cross-system gig writes.

## Actual owning files

Runtime/data ownership after implementation:

- new `gig-contract.js` — gig schema, normalization, read/write, edit/delete, and stop-ID remap helpers;
- new `manual-gigs.js` — owns the Manual Gig form/list and the bounded integration with existing saved-stop/route/restore actions;
- `route-history.js` — preserves `gigIdsByStopId`/`gigManagedStopIds`, remaps them with physical stops, and applies/removes gig route membership without changing the optimization algorithms;
- `backup.js` — version-2 gig backup plus version-1 compatibility and confirmed-restore handoff;
- `index.html` — Manual Gig controls and cache-versioned module loads;
- `CONTRACT.md` — approved manual-gig behavior;
- `REGRESSION_CHECKLIST.md` — required manual-gig checks;
- focused tests for gig schema, same-address gigs, route membership, backup compatibility, route-order isolation, and UI/integration boundaries.

`app.js` is deliberately unchanged. `manual-gigs.js` loads before `app.js`, waits for `DOMContentLoaded`, owns only its new gig DOM surface, and uses the existing app-owned state/render functions for route changes rather than rewriting the Address or Build Route lists directly. This avoids an unrelated refactor of the existing ~75 KB app controller.

No backend, Google Drive permission, optimization algorithm, workbook inbox, route-order payload, Cloud Run, or deployment file changed in Phase 1A.

## Read surfaces

- existing physical stops
- existing Home
- existing Google/Basic route snapshots
- new local gig collection
- existing backup payload during restore

## Write surfaces

- new local gig collection
- existing physical stops only when a new gig introduces a previously unsaved address or governed physical-stop correction/merge changes an attached stop ID
- Google/Basic route snapshots only for explicit manual-gig route inclusion/removal and the existing Start New Route path
- existing backup payload only when the operator uses the existing backup controls

## Protected behavior

Must remain unchanged:

- current InspectorADE workbook import
- one physical saved stop per normalized address
- corrected-address aliases, GIS/DCFS source, and strongest-pin protection
- Home storage
- the five-page menu
- existing plain Add/Edit Address behavior
- Basic and Google optimization algorithms
- Google/Basic route slot independence and status
- navigation, Google Maps, and Garmin behavior
- workbook Order-ID preservation and route-order return
- manual Drive access model and `drive.file` permission
- InspectorADE prediction/history isolation

## Primary risks

1. **Duplicate physical stops** if gig identity is incorrectly added to stop identity.
   - Mitigation: gigs reference stop IDs; `normalizeStopList()` remains address-based.
2. **Lost gig attachment after address correction/duplicate merge.**
   - Mitigation: capture the pre-edit physical-stop set, derive only exact address/alias remaps after the governed edit, and apply gig stop-ID remap against the current valid stop set.
3. **Backup loss.**
   - Mitigation: version-2 backup, version-1 compatibility, parsed-gig restore handoff, and focused restore fixtures.
4. **Route duplication at same property.**
   - Mitigation: optimization receives physical stops, never raw gigs; route history de-duplicates stop IDs.
5. **Removing an existing/workbook stop when a gig is removed.**
   - Mitigation: `gigManagedStopIds` distinguishes gig-created route membership and workbook `orderIdsByStopId` protects workbook stops.
6. **InspectorADE contamination.**
   - Mitigation: no `Source_ID`, `Job_Log`, Prediction_History, workbook inbox, or `Gig_Log` write in this slice; route-order export ignores gig IDs.
7. **Pretending manual backup is synchronization.**
   - Mitigation: explicitly defer live multi-device conflict resolution and do not advertise it as solved.

## Realistic fixtures

Focused tests now cover:

1. one HNP gig at a saved/new physical stop contract boundary;
2. two distinct HNP gigs with different `Gig_ID`s at the same stop;
3. a manual gig sharing a physical stop with workbook `orderIds`;
4. physical-stop remap retaining gig attachment;
5. duplicate route-stop remap merging gig metadata;
6. old version-1 backup without gigs;
7. version-2 backup with gigs and existing Google/Basic route snapshots;
8. invalid/negative expected pay and malformed/orphan gig identity;
9. app-only gig stop in route-order return with no invented workbook ID;
10. UI/script-order, address-delete guard, Start New Route reapply, and backup-restore integration boundaries.

## Test and validation plan

During implementation, focused tests were added but have not yet been reported as passed. Before merge, the exact final runtime head must pass:

- all focused gig/storage/backup/route tests;
- complete `npm test` suite once;
- `for file in *.js; do node --check "$file"; done` once;
- contract gates;
- affected Address, Build Route, saved-data, backup/restore, and responsiveness smoke checks.

Baseline complete-suite count: **211**.

New Phase 1A test cases added: **23**.
Expected final complete-suite count: **234**.

Final complete-suite verification will be performed by CI on the exact pull-request head before pre-merge approval. A failure stops merge/publication.

## Recovery

If focused or full tests fail, stop before merge/publication and repair the branch first.

If live validation fails after eventual publication:

1. restore the runtime files to `44f814c12bfd379fbfb728d757177e46017db9d1`;
2. preserve the user's local browser/backup data for diagnosis rather than deleting it;
3. do not attempt a second migration or cleanup until the failing state is understood.

## Explicit authorization gates

- Runtime implementation is authorized for the documented Phase 1A scope.
- Because this is Level 3 storage work, a second explicit pre-merge operator approval is required after implementation/testing and before merge to `main`.
- Phase 2 `Gig_Log`/route-pay, photo capture, Business Drive media, and multi-device synchronization are separate approvals.
