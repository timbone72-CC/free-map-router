# Free Map Router — Field Work Expansion Roadmap

**Status:** PLANNED / NOT YET IMPLEMENTED  
**Date:** 2026-08-21  
**Primary repo:** `timbone72-CC/free-map-router`

## Purpose

Make this document the durable execution roadmap for expanding Free Map Router from a workbook-fed route optimizer into a broader field-work tool that can also handle manually entered gigs, route pay, HNP work orders, job-site photos, business Drive storage, and later file-organizer integration.

This is the single planning source of truth for this expansion. Add future ideas here instead of scattering the same plan across multiple documents.

## Data Ownership Rules

- Every manually created gig receives a stable internal `Gig_ID` or equivalent permanent job identity. Address alone is never the job identity.
- Vendor work-order IDs remain stored separately when available.
- InspectorADE jobs and HNP/other gigs may share one route experience, but HNP/other gigs must not enter InspectorADE prediction history or be treated as InspectorADE repeats.
- The app owns route-stop state and field capture state.
- A dedicated workbook surface such as `Gig_Log` becomes the durable gig/pay record when that integration is implemented.
- Google Drive owns job media files; the app records their upload state and location.
- Cross-device writes must be stale-safe so an older phone/PC state cannot silently replace newer job data.

## Target User Flow

1. Receive InspectorADE jobs from the workbook and/or manually add an HNP or other gig in Free Map Router.
2. Mix all selected stops into one route.
3. Optimize using the existing Basic or Google route paths.
4. Show expected route pay across all paid stops.
5. Tap an HNP stop to open its job/work-order view.
6. Capture required job-site photos from the phone, grouped by work-order category such as Outside and Inside.
7. Keep each photo tied to the correct `Gig_ID`, work order, category, and capture session from the moment it is taken.
8. Save/upload job media safely to the configured Google Drive destination, with recoverable pending state when offline or interrupted.
9. Send the HNP/gig record and relevant work-order information to the gig side of the workbook and include it on the Google Print route output where appropriate.
10. Record actual pay later without overwriting what the route was expected to earn when planned.

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

### Phase 2 — Gig Workbook Handoff and Route Pay

Create a separate gig data path rather than reusing InspectorADE `Job_Log`.

Planned behavior:

- HNP/other gig records can be sent from the app to a dedicated workbook area such as `Gig_Log`.
- `Gig_ID` is preserved across app, workbook, print output, photo storage, and later updates.
- Store at least `Expected_Pay` and later `Actual_Pay` as separate concepts.
- Route pay can combine InspectorADE expected pay plus HNP/other expected pay without merging their underlying histories.
- Later reconciliation can compare expected versus actual pay without rewriting the original route-planning value.
- Google Print can show both InspectorADE stops and gig/work-order details in the same daily route packet.
- Define field ownership before writes are enabled: which system is authoritative for gig creation, field completion, pay edits, and submission state.

### Phase 3 — HNP Work-Order View and Field Photo Capture

An HNP stop can open a job/work-order screen in the app.

Initial photo/work-order concept:

- work-order/job details
- Outside photos
- Inside photos
- optional future required-shot categories driven by the work order
- required/collected photo counts
- job notes
- completion action

Photo evidence requirements:

- Every photo is associated at capture time with `Gig_ID`, work-order ID when present, photo category, and capture session.
- Decide before implementation whether capture time and location metadata must be preserved.
- Retakes/duplicates must be identifiable rather than silently mixed with required evidence.
- Compression may be used only after confirming the client accepts the resulting image quality and metadata behavior.
- The app must verify required photo state before claiming the job is ready for submission.

Reliability requirements:

- Prefer processing/compressing each image as it is captured or queued instead of waiting to process a large full-resolution batch at job completion.
- Offline or failed uploads remain recoverable and visibly pending.
- Closing/reopening the app must not lose captured-but-not-yet-uploaded job state.

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
          Outside Photos/
          Inside Photos/
          <ADDRESS>-<GIG_OR_WORK_ORDER_ID>.zip
```

Drive requirements to settle before implementation:

- exact business account/folder ownership
- authorization method used by the app/backend
- private-by-default sharing behavior
- who may access job folders
- retention period for work orders, individual photos, and ZIP packages
- whether old personal-Drive records are migrated or only new jobs use business Drive
- whether Drive retains individual photos, a ZIP package, or both

Upload integrity:

- The app records pending, uploaded, and failed media state.
- A job is not marked fully uploaded until the expected files are verified at the destination.
- Cross-device retries must not duplicate or overwrite unrelated job media.

### Phase 5 — Existing File Organizer Integration

Review the existing file-organizer workbook before assigning it responsibilities.

Preferred separation:

- Free Map Router owns the relationship between route stop, gig/work order, and captured photos.
- The organizer may handle later filing, cleanup, retention, movement, indexing, or archival.
- The organizer must not be required to infer which unsorted photos belong to which job.
- Do not duplicate a filing function in both systems unless one is explicitly the authoritative writer and the other is read-only/supporting.

### Phase 6 — Field Workflow Cleanup and Soak

After the core features work together:

- streamline taps and status visibility for phone use
- clearly show job state, photo state, upload state, and pay state
- confirm remote/multi-device edits cannot overwrite newer field state
- add practical recovery for interrupted work
- validate representative real HNP jobs before broad use

A successful test run is not the end of the rollout. Use a controlled soak period with real jobs and watch for sync conflicts, missing photos, duplicate uploads, Drive filing errors, route-pay mismatches, and workbook handoff problems before expanding the feature set.

## Decisions Still Needed Before Photo Implementation

- Whether HNP requires original-resolution images or accepts compressed JPGs.
- Whether HNP work orders use only broad groups such as Inside/Outside or individual required-shot checklists.
- Whether HNP requires capture-time or GPS metadata to remain intact.
- Whether Drive should retain individual image files, a ZIP package, or both.
- Exact business Drive account/folder ownership and authorization method.
- Exact `Gig_Log` schema and which system is authoritative for gig completion, submission, and pay edits.
- Whether HNP work-order details are entered manually, imported from a file, or later parsed from another source.

## Protected Existing Behavior

Future work must preserve unless a later approved change explicitly says otherwise:

- existing InspectorADE workbook-to-router import
- Basic and Google route choices
- corrected-address behavior and source association
- route persistence and backup behavior
- Google Print output for current InspectorADE work
- navigation/export behavior
- InspectorADE prediction/history isolation from unrelated gigs

## Risk and Change-Control Notes

- Manual-stop UI is likely a normal feature change when it does not alter storage contracts or broad permissions.
- New persistent gig schemas, cross-device synchronization, automatic workbook writes, Drive permissions/account migration, and automatic photo uploads are higher-risk changes.
- Each implementation phase must use the repository's change-control process, the smallest honest scope, focused tests during development, a recoverable rollback point, and required integration review when workbook handoff is affected.
- Do not combine all phases into one release. Each phase must establish a stable baseline for the next.
