# Phase 2E — Google Print Gig Details Impact Record

**Status:** APPROVED FOR IMPLEMENTATION — PRE-MERGE APPROVAL STILL REQUIRED  
**Date:** 2026-08-25  
**Risk:** Level 3 cross-application handoff change  
**FMR branch:** `work/phase-2e-google-print-gigs-20260825`  
**Workbook branch:** `work/phase-2e-google-print-gigs-20260825`

## Problem and approved behavior

Google Print currently renders InspectorADE `Job_Log` work only. Manual gigs already have immutable `Gig_ID` values in Free Map Router, route history already preserves `gigIdsByStopId`, and the workbook already mirrors gig details in `Gig_Log`, but the selected route-order return does not carry those Gig IDs. A gig-only route stop therefore cannot appear in the workbook-generated Google Print packet.

Phase 2E will make the existing route-order return carry optional `gigIds` for each physical stop. The workbook will resolve those IDs only by exact `Gig_Log.Gig_ID` and include the routed gig details in the current Google Doc route packet at the same visible stop number. A physical stop may contain InspectorADE work, manual gigs, or both.

## Owning files

Free Map Router runtime owner:
- `route-order.js`

Workbook runtime owners:
- `22.1_FreeMapRouterRouteOrder.gs`
- new narrow `22.3_FreeMapRouterGigPrint.gs`

Focused tests may change/add only around route-order and Phase 2E print behavior. No unrelated cleanup is authorized.

## Data and schema

No stored-data schema change. No new Drive file. No new permission.

The existing `routeOrderVersion: 1` gains one backward-compatible optional stop field:
- `gigIds: string[]`

Existing `orderIds` remain unchanged. A returned stop is valid when it has a positive visible stop number, nonblank address, and at least one exact `orderId` or exact `gigId`.

`gigIds` are route context only. They are never copied into `Job_Log`, permanent address identity, Manual Work Library, or prediction/history data.

## Read and write surfaces

FMR reads the selected route snapshot's existing `orderIdsByStopId` and `gigIdsByStopId`; it writes the same explicit `Free Map Router Route Order.json` only after the operator presses **Send Route Order to Workbook**.

Workbook reads:
- current route-order file;
- current address inbox only when returned InspectorADE Order IDs are present and freshness must be verified;
- `Job_Log` for exact Source_ID route numbering;
- `Gig_Log` for exact Gig_ID print details.

Workbook writes:
- existing `Job_Log.Stop` and `Print Order` behavior for returned InspectorADE Order IDs only;
- the existing current Google Doc presentation output.

It does not write `Gig_Log`, `Actual_Pay`, prediction/history sheets, archive, import state, or conflict-soak evidence.

## Required / optional fields and matching

Required route stop fields: positive `stopNumber`, nonblank `address`, and at least one identifier in `orderIds` or `gigIds`.

`orderIds` and `gigIds` are optional arrays individually. Each nonblank ID must be unique across physical stops. Address is display/audit context only and is never a job or gig identity substitute.

Routed Gig IDs must resolve exactly once in healthy `Gig_Log`. Missing or duplicate routed Gig IDs stop before route-number writes. The operator is told to sync gigs first when the routed gig is absent.

## Stale-output behavior

When InspectorADE Order IDs are present, the existing exact inbox freshness and exact returned-Order-ID-set checks remain mandatory. A manual-gig-only route has no workbook source snapshot to compare, so it may omit `sourceUpdatedAt`; it is validated entirely by exact routed Gig IDs and current `Gig_Log` contents.

A failed Phase 2E validation leaves existing Job_Log route numbers unchanged and does not replace the Google Doc.

## Print behavior

The existing InspectorADE job-card renderer remains unchanged. A narrow gig-card renderer adds source, corrected route address, work-order ID, expected pay, due/completed dates, notes, and Gig ID. Mixed entries are ordered by visible route stop number; multiple work items at one physical stop share that stop number.

Blank expected pay remains visibly unknown/blank; it is not silently converted to `$0`.

## Hard limits / permissions

No new hard limit is introduced. Existing Apps Script/Google Doc limits and the existing explicit route-order file continue to govern the workflow. No broader Drive scope is requested.

## Protected behavior

Preserve:
- workbook inbox version and address import behavior;
- Google/Basic optimization and selected route order;
- route-history version 5 and existing Gig_ID storage;
- corrected-address remaps;
- InspectorADE Order ID exact matching and freshness checks;
- existing Job_Log route numbering semantics;
- existing InspectorADE Google Doc cards;
- `Gig_Log.Actual_Pay` ownership;
- Prediction_History and all prediction calculations;
- paused workbook R6 soak restart point.

## Verification and safe rollout

Development: focused FMR route-order tests and focused workbook Phase 2E route/print tests.

Final gate: one complete automated suite on the exact final runtime head of each repository plus FMR JavaScript syntax checks and workbook predeploy checks. Test counts will be reported only from actual final full-suite results.

Safe rollout order:
1. workbook companion to governed sandbox and one representative mixed route check;
2. FMR publication only after both sides are merge-approved and compatible;
3. live workbook/FMR verification using one representative mixed route.

## Rollback

FMR rollback point: `62d354b2c1f9b0e003a468cec3bcf3be856c1b68` (`main` before Phase 2E).

Workbook rollback point: `b9b1ddcd99cb52c1e24a4fa6deec7153d3934240` (governed branch after Step 6 repair, before Phase 2E).

Rollback restores the prior route-order shape/receiver and InspectorADE-only Google Print behavior; `Gig_Log` data is not deleted or rewritten.

## Approval

The operator approved Phase 2E implementation on 2026-08-25. Because this is Level 3, implementation may proceed now but merge/deployment stops for one explicit pre-merge operator approval after final tests and diff review.