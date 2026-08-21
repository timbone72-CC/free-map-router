# Free Map Router — Field Work Expansion Plan

**Status:** Planning only — no runtime change authorized by this document  
**Date:** 2026-08-21  
**Primary repo:** `timbone72-CC/free-map-router`

## Purpose

Record and streamline the planned expansion of Free Map Router from a workbook-fed route optimizer into a broader field-work tool that can also handle manually entered gigs, route pay, HNP work orders, job-site photos, and business Drive storage.

This document is the single planning source of truth. Do not duplicate the full plan across repositories. Cross-repository contracts should be updated only when a specific integration phase is approved for implementation.

## Core Boundary

InspectorADE work and non-InspectorADE gigs must remain logically separate underneath the shared route experience.

- InspectorADE jobs may continue to feed `Job_Log`, prediction history, forecast logic, route export, and route pay.
- HNP and other manually entered gigs must not be inserted into InspectorADE prediction history or treated as InspectorADE repeats.
- Free Map Router may display and optimize both types of work in one route.
- Non-InspectorADE work should use a separate workbook surface such as `Gig_Log` when that integration is implemented.

## Target User Flow

1. Receive InspectorADE jobs from the workbook and/or manually add an HNP or other gig in Free Map Router.
2. Mix all selected stops into one route.
3. Optimize using the existing Basic or Google route paths.
4. Show total route pay across all paid stops.
5. Tap an HNP stop to open its work-order view.
6. Capture required job-site photos from the phone, grouped by work-order category such as Outside and Inside.
7. Save/upload the job media safely to the configured Google Drive destination.
8. Send the HNP/gig record and relevant work-order information to the gig side of the workbook and include it on the Google Print route output where appropriate.

## Streamlined Workstreams

### 1. Manual Jobs and Mixed Routes

Add manual stop creation in Free Map Router.

Minimum planned fields:

- Source/company (`HNP`, `Other`, etc.)
- Address
- Work-order/job ID when available
- Pay amount when known
- Notes
- Route inclusion state

Manual stops must behave like normal route stops for selection, ordering, Basic optimization, Google optimization, navigation, and printing.

### 2. Gig Workbook Handoff and Route Pay

Create a separate gig data path rather than reusing InspectorADE `Job_Log`.

Planned behavior:

- HNP/other gig records can be sent from the app to a dedicated workbook area such as `Gig_Log`.
- Route pay totals can combine InspectorADE pay plus HNP/other gig pay without merging their underlying histories.
- Google Print can show both InspectorADE stops and gig/work-order details in the same daily route packet.

### 3. HNP Work Orders and Field Photos

An HNP stop can open a job/work-order screen in the app.

Initial photo concept:

- Outside photos
- Inside photos
- Optional future required-shot categories driven by the work order
- Photo count/status
- Job notes
- Complete Job action

Photos should be associated with the job at capture time so later filing does not have to guess which property they belong to.

For reliability, the preferred design is to compress/process each image as it is captured or queued rather than waiting to process a large full-resolution batch at job completion. Failed or offline uploads must remain recoverable and visibly pending.

### 4. Google Drive Job Media

Photo/work-order storage must use a configurable Drive destination and must not hard-code the current personal Google account.

The design should support transition to the business Google Drive/account without rebuilding the field-photo system.

Candidate job structure:

```text
Field Jobs/
  HNP/
    2026/
      <ADDRESS>/
        Work Order/
        Outside Photos/
        Inside Photos/
        <ADDRESS>.zip
```

Exact folder names and ZIP behavior are not yet approved.

### 5. Existing File Organizer Integration

The existing file-organizer workbook should be reviewed before designing its role.

Preferred separation of responsibility:

- Free Map Router owns the relationship between route stop, job/work order, and captured photos.
- The organizer may handle later filing, cleanup, retention, movement, or indexing.
- The organizer should not be required to infer which unsorted photos belong to which job.

## Recommended Implementation Order

### Phase 0 — Keep Current Prediction Upgrade Separate

Do not mix this field-work expansion into the current InspectorADE prediction-accuracy upgrade.

### Phase 1 — Manual Stops

Implement and validate manually entered stops in Free Map Router while preserving existing workbook-fed routes.

### Phase 2 — Gig Data and Route Pay

Add the separate gig workbook handoff, pay fields, combined route pay, and Google Print representation.

### Phase 3 — Work-Order View and Photo Capture

Add HNP work-order display, categorized photo capture, safe local/queued state, compression, and completion status.

### Phase 4 — Business Drive Media Storage

Connect photo/work-order uploads to a configurable business Drive destination, with safe retry and clear upload state.

### Phase 5 — File Organizer Integration

Review the existing organizer workbook and connect only the parts that reduce duplicate work without creating competing ownership of job files.

## Decisions Still Needed Before Photo Implementation

- Whether HNP requires original-resolution images or accepts compressed JPGs.
- Whether HNP work orders use only broad groups such as Inside/Outside or individual required-shot checklists.
- Whether Drive should retain individual image files, a ZIP package, or both.
- Exact business Drive account/folder ownership and authorization method.
- Exact `Gig_Log` schema and which system is authoritative for gig completion/pay edits.
- Whether HNP work-order details are entered manually, imported from a file, or later parsed from another source.

## Protected Existing Behavior

Future work must preserve:

- Existing InspectorADE workbook-to-router import.
- Basic and Google route choices.
- Corrected-address behavior and source association.
- Route persistence and backup behavior.
- Google Print output for current InspectorADE work.
- InspectorADE prediction/history isolation from unrelated gigs.

## Risk Note

Manual-stop UI is likely a normal feature change, but automatic workbook writes, new storage schemas, Google Drive media permissions, account migration, and automatic photo uploads are higher-risk changes. Each implementation phase must follow the repository contracts and use a branch, focused tests, rollback protection, and any required integration review.
