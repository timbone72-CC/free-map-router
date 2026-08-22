# Manual Gig Foundation Impact Record — 2026-08-22

## Status

PLANNED / STRUCTURAL DESIGN COMPLETE / RUNTIME NOT YET AUTHORIZED

## Change level

Level 3 — high risk.

This first field-work runtime slice introduces a new persistent gig/work identity and therefore changes stored application data and backup behavior. It does not change Google Drive permissions, workbook handoff, routing algorithms, or deployment configuration.

## Baseline and rollback

- Implementation branch: `work/manual-gig-foundation-20260822`
- Branch base after roadmap promotion: `a111f4f8a2560fb739bdac3536afa3c105021945`
- Last live-proven runtime source before this work: `44f814c12bfd379fbfb728d757177e46017db9d1`
- Rollback for any runtime implementation: restore the runtime files from `44f814c12bfd379fbfb728d757177e46017db9d1`.

## Exact user-facing problem

Free Map Router can store and route a physical address, but it cannot represent a manually entered paid job such as HNP as a durable work item. The current stop contract intentionally collapses one normalized physical address into one saved stop, so putting HNP/job identity into labels or notes would lose the distinction between multiple jobs at the same property.

The field-work roadmap requires manually entered gigs to have stable identity and eventually participate in route pay, work-order photos, workbook `Gig_Log`, and multi-device state without entering InspectorADE prediction history.

## Verified evidence

Current `contract.js` uses address identity for stops:

- `SCHEMA_VERSION = 3`
- `STOPS_STORAGE_KEY = "fmr_v2_stops"`
- `normalizeStopList()` merges records by `addressKey`
- `normalizeStop()` creates `stop_*` identity for the physical stop

Current `backup.js` version 1 stores Home, physical stops, and route snapshots only. It has no gig/work-item collection.

The current Addresses page contains the existing Add/Edit Address form; the app still has exactly five protected pages. No new page is required for the first gig slice.

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

## Proposed Phase 1A gig schema

Use a separate gig schema instead of bumping the physical-stop schema merely to hold unrelated work identity.

Proposed storage contract:

- `GIG_SCHEMA_VERSION = 1`
- `GIGS_STORAGE_KEY = "fmr_v1_gigs"`

Each normalized gig contains:

- `schemaVersion`
- `id` — immutable internal `gig_*` ID
- `stopId` — existing physical saved-stop ID
- `source` — manual company/source such as `HNP` or `OTHER`; this is distinct from the governed stop `GIS`/`DCFS` source field
- `workOrderId` — optional vendor/job identifier
- `expectedPay` — optional nonnegative numeric planning value
- `notes` — optional gig-specific notes
- `routeIncluded` — explicit manual-gig route inclusion state
- `createdAt` — immutable creation timestamp
- `updatedAt` — last gig-edit timestamp

`Actual_Pay`, completion lifecycle, submission state, photo state, workbook row identity, and media metadata are deliberately excluded from this first slice.

## Duplicate and identity rules

- `Gig_ID`, not address, is gig identity.
- Two gigs may have the same address and same physical `stopId`.
- A work-order ID is metadata and must not silently replace `Gig_ID` as internal identity.
- Saving a new gig at an already-saved address reuses the existing physical stop; it does not create a duplicate stop.
- Saving a gig at a new address creates exactly one normal physical stop and one gig.
- Editing/correcting the physical stop retains its stop ID so attached gigs remain attached.
- If existing duplicate-stop correction merges IDs, every attached gig must be remapped through the same retained-stop ID map before the write is considered successful.

## Route behavior for this slice

Existing Basic/Google route algorithms remain physical-stop algorithms.

- A route contains a physical stop at most once.
- Multiple included gigs at one property do not create duplicate driving stops.
- The route snapshot may carry the manual `gigIds` associated with that physical stop so later route-pay and work-order views can identify the work represented there.
- Existing workbook `orderIds` remain unchanged and separate from `gigIds`.
- App-only/manual-gig stops continue to produce visible route-number gaps in workbook route-order return; the app must never invent workbook Order IDs for them.

## User interface scope

Use the existing **Addresses** page. Do not add, rename, remove, or reorder app pages.

Planned manual-gig entry fields:

- Address *
- Company/source (`HNP`, `Other`)
- Work order / job ID (optional)
- Expected pay (optional)
- Notes (optional)
- Include in route

The existing Add/Edit Address form remains available for plain address management and pin correction. The gig control must not turn the address form into the authority for gig identity.

## Backup behavior

The downloadable and Drive backup format must preserve manual gigs before Phase 1A can be considered safe.

A backup-version change is expected because the current version-1 backup has no gig collection.

Requirements:

- existing version-1 backups remain restorable;
- new backups include `gigs` without changing Home or existing stop meaning;
- restore never converts a gig into an InspectorADE job;
- invalid gig records are rejected or omitted without damaging valid existing stop/Home data;
- failure leaves the prior local state recoverable.

Full multi-device synchronization is **not** part of Phase 1A. The roadmap's eventual stale-device requirement remains a later synchronization gate. This slice must not claim that manual Drive backup/restore is live multi-device sync.

## Workbook/router integration impact

No existing InspectorADE workbook handoff format changes in Phase 1A.

- `Free Map Router Address Inbox.json` stays unchanged.
- workbook `orderIds` stay unchanged.
- `Free Map Router Route Order.json` stays unchanged except that existing app-only physical stops may still occupy visible route positions without workbook IDs, behavior already supported by contract.
- no `Gig_Log` writes are enabled yet.
- no workbook repository runtime change is required for Phase 1A.

Phase 2 will separately govern `Gig_Log`, route pay, and cross-system gig writes.

## Expected owning files

Likely runtime ownership, subject to final verification before code edits:

- new `gig-contract.js` — normalized gig schema/read/write helpers
- `contract.js` — only if stop-ID remap integration requires a narrow exported helper; physical stop meaning must otherwise remain unchanged
- `app.js` — gig page state, create/edit/delete interaction, stop/gig attachment, route inclusion/render integration
- `backup.js` — backward-compatible gig backup/restore
- `index.html` — manual-gig controls on the existing Addresses page and new script load if a dedicated gig module is used
- `styles.css` — presentation only if required
- focused tests for gig schema, repeated same-address gigs, route attachment, backup compatibility, and stop-ID remap

No backend, Drive permission, optimization algorithm, workbook inbox, route-order contract, or deployment file should change in Phase 1A.

## Read surfaces

- existing physical stops
- existing Home
- existing Google/Basic route snapshots
- new local gig collection
- existing backup payload during restore

## Write surfaces

- new local gig collection
- existing physical stops only when a new gig introduces a previously unsaved address or a governed physical address edit/merge occurs
- Google/Basic route snapshots only for explicit manual-gig route inclusion/removal
- backup payload only when the operator uses existing backup controls

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
   - Mitigation: remap gig `stopId` using the same retained-stop ID mapping before persistence.
3. **Backup loss.**
   - Mitigation: backward-compatible backup-version change and focused restore fixtures.
4. **Route duplication at same property.**
   - Mitigation: optimization receives physical stops, never raw gigs.
5. **InspectorADE contamination.**
   - Mitigation: no `Source_ID`, `Job_Log`, Prediction_History, workbook inbox, or `Gig_Log` write in this slice.
6. **Pretending manual backup is synchronization.**
   - Mitigation: explicitly defer live multi-device conflict resolution and do not advertise it as solved.

## Realistic fixtures

Focused fixtures must include:

1. one HNP gig at a brand-new address;
2. two distinct HNP gigs with different `Gig_ID`s at the same address/stop;
3. one HNP gig sharing a physical stop with workbook `orderIds`;
4. an address correction that retains the stop ID and gig attachment;
5. duplicate-stop merge that remaps gig attachment;
6. old backup without gigs;
7. new backup with gigs and existing Google/Basic route snapshots;
8. invalid expected pay and malformed gig identity;
9. app-only gig stop in a route-order return with no invented workbook ID.

## Test and validation plan

During implementation, run focused tests only for the changed behavior. Before merge, the exact final runtime head must pass:

- all focused gig/storage/backup/route tests;
- complete `npm test` suite once;
- `for file in *.js; do node --check "$file"; done` once;
- contract gates;
- affected Address, Build Route, saved-data, backup/restore, and responsiveness smoke checks.

The current full-suite baseline count must be measured from the branch locally before runtime edits and recorded here before pre-merge approval. The expected final count must also be recorded once focused tests are written.

## Recovery

If focused or full tests fail, stop before commit/merge/publication.

If live validation fails after eventual publication:

1. restore the runtime files to `44f814c12bfd379fbfb728d757177e46017db9d1`;
2. preserve the user's local browser/backup data for diagnosis rather than deleting it;
3. do not attempt a second migration or cleanup until the failing state is understood.

## Explicit authorization gates

- This impact record and branch are documentation/planning only.
- Runtime implementation requires the user's explicit approval of this Phase 1A scope.
- Because this is Level 3 storage work, a second explicit pre-merge operator approval is required after implementation/testing and before merge to `main`.
- Phase 2 `Gig_Log`/route-pay, photo capture, Business Drive media, and multi-device synchronization are separate approvals.
