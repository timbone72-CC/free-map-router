# Free Map Router — Field Work Expansion Roadmap

**Status:** IN PROGRESS — PHASE 2 PRODUCTION-VALIDATED / PHASE 3 DESIGN AUDIT STARTED  
**Updated:** 2026-08-27  
**Primary repo:** `timbone72-CC/free-map-router`

## Purpose

Make this document the durable execution roadmap for expanding Free Map Router from a workbook-fed route optimizer into a broader field-work tool that can also handle manually entered gigs, route pay, HNP work orders, job-site photos, business Drive storage, and later file-organizer integration.

This is the single planning source of truth for this expansion. Add future ideas here instead of scattering the same plan across multiple documents.

## Data Ownership Rules

- Every manually created gig receives a stable internal `Gig_ID` or equivalent permanent job identity. Address alone is never the job identity.
- Vendor work-order IDs remain stored separately when available.
- InspectorADE jobs and HNP/other gigs may share one route experience, but HNP/other gigs must not enter InspectorADE prediction history or be treated as InspectorADE repeats.
- The app owns route-stop state and field capture state.
- `Gig_Log` is the durable workbook mirror/ledger for manual gig/pay data; workbook-owned `Actual_Pay` must survive later FMR syncs.
- Google Drive owns job media files once the Phase 4 storage design is approved; the app will record upload state and location rather than treating transient browser state as the durable media archive.
- Existing InspectorADE/workbook address corrections remain owned by the permanent address-corrections store. They are not replaced by the Manual Work Library or by point-in-time backups.
- Cross-device writes must be stale-safe so an older phone/PC state cannot silently replace newer job data.

## Target User Flow

1. Receive InspectorADE jobs from the workbook and/or manually add an HNP or other gig in Free Map Router.
2. Mix all selected stops into one route.
3. Optimize using the existing Basic or Google route paths.
4. Show expected route pay across all paid stops.
5. Tap an HNP stop to open its job/work-order view.
6. Capture or attach required job-site photos from the phone using an evidence plan tied to the exact gig/work order, not merely a loose camera roll.
7. Keep each photo tied to the correct `Gig_ID`, work order, evidence category/line item, and capture session from the moment it enters the job workflow.
8. Preserve the original field evidence and any required capture metadata; derivative resize/compression is allowed only after the client-specific requirement is known.
9. Save/upload job media safely to the configured Google Drive destination, with recoverable pending state when offline or interrupted.
10. Send the HNP/gig record and relevant work-order information to the gig side of the workbook and include it on the Google Print route output where appropriate.
11. Record actual pay later without overwriting what the route was expected to earn when planned.

## Planned Job Lifecycle

Initial lifecycle to validate during implementation:

`RECEIVED -> ROUTE_PLANNED -> IN_PROGRESS -> PHOTOS_PENDING -> COMPLETE -> UPLOADED -> SUBMITTED -> PAID`

The exact labels may change before implementation, but the build must have an explicit lifecycle rather than unrelated checkboxes scattered across the app and workbook.

Rules:

- Completion and upload are separate states.
- A job can be complete in the field while media upload is still pending.
- A failed upload cannot silently mark a job uploaded.
- Later workbook/pay edits must not erase field evidence or route history.

## Roadmap

### Phase 1 — Safe Baseline and Manual Stops

Before runtime work:

- Record the current live app commit/version and rollback point.
- Preserve current workbook import, Basic/Google route selection, corrected-address behavior, route persistence/backups, navigation, and current Google Print behavior.

Build:

- Add manual stop creation directly in Free Map Router.
- Minimum planned fields:
  - stable internal `Gig_ID`
  - source/company (`HNP`, `Other`, etc.)
  - address
  - work-order/job ID when available
  - expected pay when known
  - notes
  - route inclusion state
- Manual stops must behave like normal stops for selection, ordering, Basic optimization, Google optimization, navigation, saving/restoring, and printing.
- Repeated visits to the same address must remain distinct gigs when their IDs/work orders differ.

Acceptance direction:

- Existing workbook-fed routes still work unchanged.
- Manual and workbook stops can coexist in the same route.
- A stale device state cannot silently delete or replace a newer manually entered gig.

**Current status:** Implemented and live-tested. Manual gigs remain separate from InspectorADE history and can share one physical stop with workbook work.

### Phase 1B — Manual Work Library and Due Dates

Keep the next step narrow: add durable reuse and simple scheduling for manual/HNP work without turning Free Map Router into a calendar system.

Permanent Manual Work Library:

- Store reusable manual/HNP properties in one permanent Google Drive Manual Work Library.
- A property record owns the reusable physical address, corrected address/pin when applicable, and property-level notes.
- The library is independent of today's route membership. Removing work from Build Route must not delete the permanent property.
- The library must not replace or duplicate the existing InspectorADE permanent address-corrections file.
- Saving a manual property should update its durable library record automatically when Drive is available; **Back Up Now** remains a separate whole-app recovery snapshot.

Repeat-job templates:

- A repeat template attaches to one permanent manual property and may store company/source, normal expected pay, default notes, cadence, next due date, and alert lead time.
- The template is not today's gig. When the operator chooses **Add to Route**, Free Map Router creates or activates a distinct gig occurrence with its own `Gig_ID`.
- Keep recurrence intentionally small at first: every X days, every X weeks, or every X months.
- The next scheduled occurrence should normally advance from the scheduled due date rather than drifting from a late completion date.

Due alerts:

- Free Map Router automatically evaluates due status when the app opens or refreshes.
- Initial statuses: **Overdue**, **Due Today**, **Due Soon**, and **Upcoming**.
- A small Home summary may show counts such as `2 due soon • 1 overdue` and link to the existing manual-work surface; do not add another top-level page just for alerts.
- A due alert may offer **Add to Route**, but due work is **never automatically added** to Google Route or Basic Route.
- The operator always decides whether a due job belongs on today's route.
- No Google Calendar, background push-notification service, or new notification permission is part of Phase 1B.

Deletion safety:

- **Remove from Route** changes route membership only.
- **Delete Gig** removes only that gig occurrence and keeps the reusable property.
- Normal property removal should prefer **Archive** so an accidental cleanup is recoverable.
- Permanent property deletion must use an explicit destructive warning and must not silently destroy the only durable copy.
- A Build Route removal that deletes the saved address is a defect, not intended behavior and not something the Drive library should mask.

Phase 1B exclusions:

- no InspectorADE workbook schema/runtime changes;
- no changes to InspectorADE `Job_Log`, `Prediction_History`, or prediction scoring;
- no Google Calendar integration;
- no background push notification service;
- no new Google permissions unless a later approved implementation proves they are required;
- no route auto-add from schedules;
- no photo/media workflow yet.

**Current status:** Implemented as the durable Manual Work Library / repeat-template foundation used by the later Phase 2 gig flow.

### Phase 2 — Gig Workbook Handoff, Route Pay, and Mixed Print

Create a separate gig data path rather than reusing InspectorADE `Job_Log`.

Implemented behavior:

- manual gigs carry due/completed dates while preserving immutable `Gig_ID` identity;
- expected route pay combines InspectorADE and manual-gig work without combining their histories;
- manual gig records sync explicitly through the governed Gig Handoff into workbook `Gig_Log`;
- workbook `Actual_Pay` remains workbook-owned and is preserved by later FMR syncs;
- route return carries exact workbook Order IDs and exact manual `Gig_ID` values by visible physical stop;
- Google Print can show InspectorADE and manual-gig cards in the same current route packet;
- blank manual expected pay remains visibly unknown rather than silently becoming `$0`;
- visible **Include in Route** checkboxes show and control manual-gig route membership directly;
- Drive identity is pinned to the governed Free Map Router folder/resources rather than name-based duplicate-folder lookup.

**Production checkpoint — 2026-08-27:** Phase 2A through Phase 2E were production-validated after an ordered workbook-first rollout. The governed workbook handoff produced a current 13-job LIVE route, the production FMR read it successfully, and the mixed exact Order-ID/Gig-ID round trip had already passed in the Live Sandbox/shared handoff with mixed Google Doc output. See `docs/2026-08-27_PHASE_2_PRODUCTION_COMPLETION_RECORD.md`.

Use a real-work soak before adding photo/media runtime. Watch for route-pay mismatches, stale gig sync, wrong route membership, mixed-print identity errors, and Drive handoff failures. Phase 2 completion does not authorize Phase 3 runtime edits.

### Phase 3 — HNP Work-Order View and Field Photo Evidence

**Status:** DESIGN AUDIT IN PROGRESS — NO RUNTIME CODING AUTHORIZED.

An HNP stop should be able to open a job/work-order view in the app, but the photo workflow must preserve field evidence and client-specific requirements rather than reducing every job to a generic Inside/Outside photo bucket.

Initial work-order concept to audit:

- work-order/job details and current instructions;
- evidence plan / required-shot checklist for the active order;
- broad groups such as Identity/Access, Exterior, Interior, Work/Line Item, Damage/Measurements, Notices/Final Secure where useful;
- before/during/after stages for work line items when required;
- required/collected photo counts as a completeness aid, not as a substitute for coverage;
- job notes and unable-to-complete/exception notes;
- field QC before leaving the property;
- completion action that cannot claim evidence-ready status when required evidence is missing.

Photo evidence requirements already established by the Phase 3 audit:

- Every photo entering the job workflow must be associated with exact `Gig_ID`, work-order ID when present, evidence category/line item, and capture/visit context.
- Original field photos are source evidence and must not be overwritten, renamed in place, moved, deleted, or silently stripped of metadata by the workflow.
- The active work order/client instructions control exact shot count, allowed image type/size, date/time/GPS requirements, line-item mapping, and submission deadline.
- Preserve capture date/time and GPS/location when the client requires them; do not invent missing metadata.
- Retakes and true accidental duplicates must remain distinguishable enough to avoid mixing required angles or visits.
- Before/during/after work should retain stage identity and matching-angle context when required.
- The app must support a field QC check before the operator leaves when a return trip would be costly or impossible.
- Compression/resizing may be used only after confirming client acceptance; originals remain retained separately.

Reliability requirements:

- Do not hold a large batch of full-resolution images only in volatile browser memory.
- Captured/attached evidence must have recoverable pending state before it is considered safe.
- Offline or failed uploads remain visibly pending; a failed upload cannot mark the job uploaded.
- Closing/reopening the app must not lose the job/evidence manifest for photos already accepted into the workflow.
- A later visit or correction must not overwrite the original visit record or original submitted package.

#### Phase 3 audit boundary with Field Photo Prep

A separate `field-photo-prep` project already has a contract foundation for protecting original photos while creating resized copies. Its approved role is company-neutral derivative preparation: select existing photos, create separate resized copies, preserve supported metadata, and share/upload those copies through Android. Its contract explicitly excludes a job database, vendor-specific workflow, automatic upload, and direct Drive API integration in the initial release.

Therefore the current design direction is:

- Free Map Router owns job identity, work-order context, evidence requirements, evidence manifest, route linkage, and job-level completion/QC state.
- Field Photo Prep may later remain an optional derivative-processing helper, but it must not become the authority for `Gig_ID`, work-order state, route state, or evidence completeness.
- Do not make Phase 3 depend on Field Photo Prep runtime until that project is itself approved and implemented; its GitHub `main` currently does not contain a production Android runtime.
- Do not duplicate photo-byte ownership in both apps without an explicit handoff contract.

See `docs/2026-08-27_PHASE_3_FIELD_PHOTO_DESIGN_AUDIT.md` for the evidence-based starting audit.

### Phase 4 — Business Google Drive Job Media

Photo/work-order storage must use a configurable Drive destination and must not hard-code the current personal Google account.

The design must support moving new job media to the business Google Drive/account without rebuilding the photo system.

Candidate structure:

```text
Field Jobs/
  HNP/
    2026/
      <ADDRESS>/
        <GIG_OR_WORK_ORDER_ID>/
          Work Order/
          Original Photos/
          Prepared Photos/
          <ADDRESS>-<GIG_OR_WORK_ORDER_ID>.zip
```

Drive requirements to settle before implementation:

- exact business account/folder ownership;
- authorization method used by the app/backend;
- private-by-default sharing behavior;
- who may access job folders;
- retention period for work orders, original photos, prepared copies, and ZIP packages;
- whether old personal-Drive records are migrated or only new jobs use business Drive;
- whether Drive retains individual photos, a ZIP package, or both.

Upload integrity:

- The app records pending, uploaded, and failed media state.
- A job is not marked fully uploaded until the expected files are verified at the destination.
- Cross-device retries must not duplicate or overwrite unrelated job media.
- Original evidence and prepared/upload copies must remain distinguishable.

### Phase 5 — Existing File Organizer Integration

Review the existing file-organizer workbook before assigning it responsibilities.

Preferred separation:

- Free Map Router owns the relationship between route stop, gig/work order, and the job evidence manifest.
- The organizer may handle later filing, cleanup, retention, movement, indexing, or archival.
- The organizer must not be required to infer which unsorted photos belong to which job.
- Do not duplicate a filing function in both systems unless one is explicitly the authoritative writer and the other is read-only/supporting.

### Phase 6 — Field Workflow Cleanup and Soak

After the core features work together:

- streamline taps and status visibility for phone use;
- clearly show job state, photo state, upload state, and pay state;
- confirm remote/multi-device edits cannot overwrite newer field state;
- add practical recovery for interrupted work;
- validate representative real HNP jobs before broad use.

A successful test run is not the end of the rollout. Use a controlled soak period with real jobs and watch for sync conflicts, missing photos, duplicate uploads, Drive filing errors, route-pay mismatches, and workbook handoff problems before expanding the feature set.

## Decisions Still Needed Before Phase 3 Photo Runtime

- Exact HNP/client image requirements: original resolution versus accepted resized copies, maximum/minimum dimensions, file type, and file-size limits.
- Exact HNP/client metadata requirements: visible timestamp, EXIF capture time, GPS/location metadata, or combinations of these.
- Whether work-order evidence is entered manually, imported from a file/message, or later parsed from another source.
- Whether the first Phase 3 runtime slice attaches existing camera photos to the exact gig or launches a camera/capture path from inside the job view.
- Whether required-shot rules begin as operator-entered checklists or use a small set of reusable work-type templates.
- Whether and how Field Photo Prep participates in derivative preparation without becoming a second job database.
- Exact business Drive account/folder ownership and authorization method for Phase 4.
- Whether Drive retains originals plus prepared copies, originals plus ZIP, or all three.
- Retention/deletion rules for original evidence, prepared copies, and corrected/resubmitted packages.

## Protected Existing Behavior

Future work must preserve unless a later approved change explicitly says otherwise:

- existing InspectorADE workbook-to-router import;
- exact workbook Order-ID and manual `Gig_ID` identity handoff;
- permanent InspectorADE/workbook address corrections: once a correction is successfully stored in Google Drive, future matching workbook imports should reuse it rather than requiring the operator to correct the same incoming address again;
- governed Free Map Router Drive resource identity and limited `drive.file` scope unless a later approved design proves a permission change is required;
- Basic and Google route choices;
- corrected-address behavior and source association;
- manual **Include in Route** selections and shared-stop behavior;
- route persistence and backup behavior;
- route expected-pay behavior and blank-pay warning semantics;
- Google Print output for current InspectorADE and manual gig work;
- navigation/export behavior;
- InspectorADE prediction/history isolation from unrelated gigs;
- workbook ownership of `Actual_Pay`.

## Risk and Change-Control Notes

- This 2026-08-27 roadmap/status update and Phase 3 audit are documentation-only Level 1 work. They authorize no runtime, permission, schema, Drive-media, or deployment change.
- A work-order view that only presents already-stored gig data may be normal feature work, but any new persistent evidence/job schema must be classified by its real storage impact.
- Photo persistence, automatic uploads, business Drive media creation, new OAuth scopes, cross-device media state, and deletion/retention behavior are Level 3 candidates and require their own impact record and explicit pre-merge approval.
- Do not combine work-order UI, photo-byte storage, compression, Drive upload, and file-organizer integration into one release.
- Each implementation slice must establish one durable ownership boundary and rollback point before the next slice starts.
- Phase 2 remains in real-work soak while Phase 3 is designed; do not reopen or modify R6 conflict reconciliation as part of this expansion.
