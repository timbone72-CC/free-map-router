# Phase 2E — Google Print Gig Details Impact Record

**Status:** REPAIR IN PROGRESS — LIVE HANDOFF CACHE FIX / PRE-MERGE APPROVAL REQUIRED  
**Date:** 2026-08-25  
**Risk:** Level 3 cross-application handoff change  
**Original FMR branch:** `work/phase-2e-google-print-gigs-20260825`  
**Repair FMR branch:** `fix/phase-2e-route-order-live-20260826`  
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

## Post-merge validation repair — 2026-08-26

The first mixed-route validation failed. The actual shared Drive `Free Map Router Route Order.json` created by the operator contained the current InspectorADE Order ID but no `gigIds`, and its shape matched the pre-Phase-2E route-order builder. The Phase 2E pull-request review had already identified that `index.html` still requested `route-order.js?v=1.0.0`, allowing a returning browser or intermediary cache to serve the older builder even though the repository contained the new code.

### Cross-System Reality Gate

Actual operator sequence:

`Workbook Print checkbox → Send Checked Jobs to Free Map Router → FMR Check Workbook Route → Start New Route → reapply routeIncluded manual gigs → selected Google/Basic route snapshot → Send Route Order to Workbook → Free Map Router Route Order.json → workbook exact Order ID/Gig_ID validation → Google Doc Daily Field Notes packet`

Changed boundary map:

`FMR selected route snapshot → route-order.js loaded by index.html → Free Map Router Route Order.json → workbook 22.1 route-order receiver → exact Gig_Log lookup → 22.3 mixed Google Doc renderer`

Environment prerequisites before the next smoke check:

- The workbook target is **workbook sandbox / shared FMR handoff**, not a fully isolated cross-system sandbox.
- InspectorADE Live Sandbox must have a healthy `Gig_Log` before gig sync/print validation. If it is absent, explicit Step 1 owns creating/checking it; normal sync must not create it silently.
- The test manual gig must have `routeIncluded=true`, be attached to a saved FMR stop, and be explicitly synced to the shared gig handoff before the workbook sync action.
- The real route-order file produced after the repair must be inspected before the workbook receiver is treated as validated; the routed manual `gigIds` must actually be present.

Repair scope is intentionally narrow:

- bump the `route-order.js` cache query in `index.html` so the Phase 2E builder is actually fetched;
- add focused coverage that starts from a staged workbook route, starts that route, reapplies a manual gig through the real route-history functions, and then builds the route-order artifact;
- do not change route algorithms, storage schemas, Drive permissions, Gig_ID identity, workbook runtime, or InspectorADE prediction/history behavior.

Repair rollout is a hard ordered gate:

1. verify/create sandbox `Gig_Log` through explicit Step 1;
2. merge/publish the FMR cache-bust repair only after focused/full verification and operator pre-merge approval;
3. use Update App, start a fresh workbook route, include one manual gig, and send the route order;
4. inspect the actual shared `Free Map Router Route Order.json` and require the exact routed `gigIds` before continuing;
5. sync gigs and receive the route in InspectorADE Live Sandbox, then verify the mixed Google Doc packet;
6. only after that sandbox check passes may the Phase 2E workbook companion be deployed to the production workbook.

## Verification and safe rollout

Development: focused FMR route-order tests and focused workbook Phase 2E route/print tests.

Final gate: one complete automated suite on the exact final runtime head of each repository plus FMR JavaScript syntax checks and workbook predeploy checks. Test counts will be reported only from actual final full-suite results.

The post-merge repair sequence above supersedes the original rollout ordering where necessary because the workbook companion is already present in the workbook sandbox and the FMR cache issue prevented the representative mixed-route check from exercising the Phase 2E builder.

## Rollback

Original FMR Phase 2E rollback point: `62d354b2c1f9b0e003a468cec3bcf3be856c1b68` (`main` before Phase 2E).

Repair rollback point: `b0120bd6ad25a734d6000b5a8e3509a1404dc4d7` (FMR `main` after the Cross-System Reality Gate, before this cache-bust repair).

Workbook rollback point: `b9b1ddcd99cb52c1e24a4fa6deec7153d3934240` (governed branch after Step 6 repair, before Phase 2E).

Rollback restores the prior route-order shape/receiver and InspectorADE-only Google Print behavior; `Gig_Log` data is not deleted or rewritten.

## Approval

The operator approved Phase 2E implementation on 2026-08-25 and approved the Cross-System Reality Gate correction on 2026-08-25. Because the validation assumptions proved false, this repair stops again for one explicit Level 3 pre-merge approval after the focused and final verification pass.