# InspectorADE Work-Order Due Dates: FMR Receiver and Display — 2026-11-08

## Approved behavior

User explicitly approved automatic `Job_Log.Due_Date` handoff from InspectorADE for GIS/DCFS work, displaying the date beside each exact work order inside FMR. Separate planned mileage display on Home / Route Base is out of scope. No new requests to Google, route optimizations, automatic Day priority, or route revisions from due dates.

FMR baseline: `main` tree `f1e16547ea5a809931f79589f10ee40ffc349fd9`; branch `feature/workbook-order-due-dates-20261108`.
Upstream companion: InspectorADE draft PR #45 (`feature/fmr-workorder-due-date-export-20261108`), NOT merged or deployed.
Risk: **Level 3** because existing route snapshots acquire optional work-order metadata and the forward Drive handoff changes. Operator has approved development only; no merge or deployment is performed by this PR.

## Exact contract and ownership

Workbook version-1 Address Inbox remains `Free Map Router Address Inbox.json`, with optional
`addresses[].dueDates: [{ "orderId": "exact Source_ID", "dueDate": "YYYY-MM-DD" }]`.
Each `orderId` must already appear in that address's `orderIds` list. The array is absent on old exports and when there are no valid due dates. Two jobs at the same physical stop can have independent dates. The app rejects malformed calendar dates, wrong/missing IDs and conflicting dates at the same exact work-order ID before staging a route.

FMR consumes the optional entries in `inbox.js`. An app-owned corrected-address alias maps the physical stop but does not change the due-date identity. The due-date map is carried only in that route's pending and Google/Basic per-Day snapshots under `workbookDueDatesByOrderId`, keyed by exact work-order ID; it is not stored as an address attribute or as manual-gig data. The existing work rows in `planner-model.js` and `app.js` display `Due YYYY-MM-DD` when present. Old route snapshots remain readable. When an Order ID drops out of a route snapshot, the now-unrepresented due date is removed by normalization.

`route-plan.js`, `route-history.js`, and `route-plan-days.js` preserve the optional metadata through pending promotion, reload, saving, route reorder, manual-gig interaction, corrected address remap, and multi-Day rebuild. An absent date stays absent. No new storage key or database is created; existing route-history V7 and Route Plan schema remain backward-compatible. No automatic visit scheduling or due-date priority change is authorized.

## Explicitly protected

- No change to routing algorithms, Google Optimize, coordinates, Home, route mileage, billing, API permissions, Google Drive credentials, or navigation.
- No change to workbook Source_ID, Address, Due_Date, Print/Cancel/Complete selection, Google Doc print, or route-order return.
- One physical address remains one stop, with separate per-Order-ID work rows.
- Manual gigs retain their established independent `Gig_ID` and due-date behavior.
- Duplicate/unknown metadata is not guessed, misassigned by address, or silently associated with another job.
- Existing inboxes lacking `dueDates` still parse and import.

## Verification and rollout gates

Focused tests: `tests/inbox.test.js`, `tests/route-history.test.js`, `tests/phase-2h-c-planner-model.test.js`, and `tests/phase-2i-c-day-management.test.js`. Cover per-ID ingestion at shared addresses, correction aliases, malformed/conflicting dates, legacy imports, pending and reload, both route slots, removed stops, and multi-day splitting.

Final required checks: focused tests, full suite + syntax on exact final commit, diff/contract review, and the cross-system Reality Gate. Required operator path: check GIS/DCFS jobs in InspectorADE > Send Checked Jobs to Free Map Router > verify actual exported inbox fields, version and timestamp > Check Workbook Route in FMR > Start New Route > confirm both independent due dates on the existing Route Builder work rows, through refresh and Day selection. The sandbox may share the production Drive handoff, so **do not overwrite an actual shared inbox or claim a completed Reality Gate without verifying isolation/approval**. Also check source's correct Apps Script ID and a safe ordered rollout; draft upstream producer and downstream receiver must stay undeployed until compatibility is verified.

Rollback: discard this feature branch before merge; after a future deployment, revert the paired FMR/InspectorADE changes and resume legacy version-1 inboxes (without dates), preserving stored address corrections and route data. Restore prior release through the governed deployment pipeline, never a behavior change directly on `main`.
