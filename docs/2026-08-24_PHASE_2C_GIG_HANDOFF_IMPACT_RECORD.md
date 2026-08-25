# Phase 2C — Manual Gig Handoff to Workbook Impact Record

**Date:** 2026-08-24  
**Change class:** Level 3 — new cross-application Drive handoff  
**Status:** IMPLEMENTATION IN PROGRESS / PRE-MERGE APPROVAL PENDING  
**Rollback commit:** `baf141fdeff5efc5b9194f279ee5aec941844b09`  
**Companion workbook branch:** `work/phase-2c-gig-handoff-20260824`

## Problem

Free Map Router now owns real HNP/Other gig occurrences, dates, and expected pay, but the workbook has no durable gig ledger. Route pay works, yet completed HNP work cannot participate safely in the planned weekly-pay reporting until the workbook receives the exact gigs without using InspectorADE `Job_Log`.

## Approved Phase 2C behavior

Add one explicit **Sync Gigs to Workbook** action on the existing Addresses → Manual Gigs surface. It writes one app-owned file in the already governed Free Map Router Drive folder:

`Free Map Router Gig Handoff.json`

The action is manual only. Saving, editing, completing, deleting, routing, refreshing, opening the app, and syncing the Manual Work Library do not automatically write this handoff.

Each row contains only:

- immutable `gigId`;
- source (`HNP` or `OTHER`);
- current saved physical address;
- optional work-order/job ID;
- optional nonnegative expected pay;
- optional due date;
- optional completed date;
- optional notes;
- gig `updatedAt`.

The handoff does not contain InspectorADE Order IDs, GIS/DCFS source impersonation, route membership, Home, route order, repeat-template identity, Actual Pay, or prediction/history fields.

## Owning files

Runtime:

- `gig-handoff.js` — handoff contract, validation, exact Drive file create/update;
- `gig-handoff-ui.js` — explicit button/status only;
- `index.html` — existing Manual Gigs control and script loading.

Tests:

- `tests/gig-handoff.test.js`;
- `tests/gig-handoff-ui.test.js`.

Documentation/contracts may receive only the narrow Phase 2C protections required by this handoff.

## Read surfaces

- current normalized manual gigs through `FMRManualGigs.list()`;
- current saved stops to resolve each gig's attached address;
- existing Google Drive OAuth token flow;
- exact governed Free Map Router workbook folder.

## Write surfaces

- one file only: `Free Map Router Gig Handoff.json` in the existing governed Free Map Router folder;
- button/status presentation on the existing Manual Gigs pane.

No local gig record, route snapshot, saved stop, Manual Work Library record, address correction, backup, InspectorADE inbox, or route-order file is changed by the handoff action.

## Schema and permission change

New JSON contract:

```json
{
  "app": "free-map-router",
  "gigHandoffVersion": 1,
  "updatedAt": "2026-08-25T01:00:00.000Z",
  "gigs": [
    {
      "gigId": "gig_...",
      "source": "HNP",
      "address": "100 Main St, Lawton, OK 73501",
      "workOrderId": "WO-1",
      "expectedPay": 60,
      "dueDate": "2026-08-25",
      "completedDate": null,
      "notes": "fixture notes",
      "updatedAt": "2026-08-24T23:00:00.000Z"
    }
  ]
}
```

No broader Google permission is added. The existing `https://www.googleapis.com/auth/drive.file` scope remains unchanged. The writer reuses the same exact governed folder/account check as **Send Route Order to Workbook**.

## Required and optional data

Required per gig:

- nonblank immutable `gigId`;
- nonblank `HNP` or `OTHER` source;
- saved attached address;
- valid `updatedAt`.

Optional:

- work order;
- expected pay;
- due date;
- completed date;
- notes.

Blank optional pay is preserved as null, not silently converted to zero. Dates are blank/null or valid `YYYY-MM-DD` local calendar dates.

## Hard limits and refusal behavior

- exactly one governed handoff filename;
- more than one matching Drive file stops the write;
- duplicate Gig_ID in the payload stops the write;
- an orphan gig with no saved address stops the write;
- malformed date/pay/timestamp stops the write;
- failure/cancelled Drive authorization leaves all local gig/route data unchanged.

No fuzzy identity or address-based gig merge is permitted.

## Stale-output behavior

FMR writes a current snapshot of all current local manual gigs only when the operator taps Sync. Omission from a later handoff is not a deletion instruction; the workbook companion must preserve prior `Gig_Log` rows. Per-gig `updatedAt` lets the workbook reject/skip older mirrored values.

## Integration compatibility and deployment order

This change adds a new app → workbook path and therefore has a required companion workbook change. Existing workbook → Address Inbox and app → Route Order paths are unchanged.

Safe deployment order:

1. merge/publish FMR writer first; creating the handoff file cannot alter workbook data by itself;
2. merge/deploy workbook receiver second;
3. live-test explicit FMR sync then explicit workbook receive.

## Realistic fixture plan

Use sanitized equivalents of the current real HNP route work: two HNP gigs at distinct saved addresses with known pay and due dates, plus a completed/blank-pay fixture for optional-field coverage. No real access/lockbox codes are committed to fixtures.

## Verification

Focused coverage must prove:

- exact approved fields and immutable Gig_ID;
- optional blank values remain blank/null;
- duplicate Gig_ID/orphan/bad date/pay/timestamp fail closed;
- exact governed folder and existing `drive.file` scope;
- duplicate Drive files fail closed;
- one explicit Manual Gigs action only;
- no timer/polling/MutationObserver/automatic write;
- no local gig or route mutation by sync.

Final gate:

- focused tests pass;
- complete `npm test` suite passes once on exact final runtime head;
- all first-party root JavaScript syntax checks pass;
- diff contains no unrelated work;
- explicit Level 3 operator pre-merge approval is recorded;
- post-publication live check succeeds.

Baseline immediately before Phase 2C is the live Phase 2B merge `baf141f`; its final implementation head passed 304/304 tests. Final Phase 2C suite count will be recorded from exact-head CI rather than guessed in advance.

## Protected behavior

- manual gig schema/version 2 and backup behavior;
- immutable Gig_ID and one physical stop for multiple gigs;
- Google/Basic route membership and route pay;
- Manual Work Library and repeat schedules;
- InspectorADE Address Inbox and route-order return contracts;
- permanent address corrections;
- five-page navigation;
- no InspectorADE prediction/history contamination;
- Build Route UI cleanup issue #62 remains separate;
- Phase 2D weekly pay and Phase 2E Google Print gig details are not implemented here.

## Failure recovery

Before merge, rollback is deleting/abandoning this branch. After merge but before workbook live use, reverting to `baf141fdeff5efc5b9194f279ee5aec941844b09` removes the new control/writer without touching existing local gigs. A handoff file already created in Drive is inert unless the explicit workbook receiver is run; it is not used by existing routes or backups.
