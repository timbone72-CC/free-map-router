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

## Staged verification — 2026-11-08

- FMR draft PR #125: https://github.com/timbone72-CC/free-map-router/pull/125
- GitHub **Verify Contract and App** run [42478820376](https://github.com/timbone72-CC/free-map-router/actions/runs/42478820376) passed on runtime/test commit `52c9ca5eb64ca2f219d4009ac9bdeebbbe59ddac`: **527 tests passed, 0 failed**, including inbox, route-history, multi-Day, planner and existing route behavior. The first-party JavaScript syntax check also passed.
- External **Cloudflare Workers Builds: free-map-router** check failed on the same commit; its detailed builder logs are not available through the GitHub check summary. This is an unresolved build/deployment gate, not a verified application success. No merge or production deployment was performed.
- The companion workbook producer is still draft PR #45, not deployed. The cross-system Reality Gate, end-to-end Drive artifact verification, and a controlled operator-path smoke test remain uncompleted. CI alone is not live validation.
- The only markup change is updating cache versions for the six changed first-party JS modules. Existing pin assertions were updated, retaining the original script load-order checks.

## Cross-repository in-memory integration evidence — 2026-11-08

Using the **actual staged source** in the InspectorADE producer PR #45 and FMR receiver PR #125, a read-only harness executed the real `iadfSendCheckedJobsToRouter()` operator function with in-memory SpreadsheetApp, DriveApp, LockService and a mock governed existing JSON inbox. It included three checked OPEN jobs: GIS-A and DCFS-B at raw `2702 SE Bishop Rd, Lawton, OK 73501`, and GIS-C at a separate Elk City address. The workbook export wrote version-1 JSON containing 2 physical address entries, all 3 exact Source_ID/orderIds and the date records `GIS-A=2026-11-12`, `DCFS-B=2026-11-14`, `GIS-C=2026-11-15`; 3 checked Print selections were consumed. The source records were not modified.

That **generated JSON string** was passed to the real FMR `parseAddressInbox()` and `applyAddressInbox()`, including a saved correction alias from 2702 SE Bishop to 10550 SE Bishop. The real `stageWorkbookRoute()` → `writeRouteHistory()` → `readRouteHistory()` → `startPendingRoute()` → `writeRouteHistory()` → `readRouteHistory()` path retained all 3 dates. The real planner model displayed all three correct per-ID dates, and routed both Lawton jobs to one corrected physical stop. Result: `SIMULATED_PRODUCER_TO_FMR_PASS`.

**Scope of evidence:** actual staged runtime functions, JSON artifact generated in memory, no network, and no write to an actual Google Drive file. The SpreadsheetApp selection helper was mocked; this is not a live operator or Drive handoff validation. The Cross-System Reality Gate is **not fully satisfied**, and neither draft PR is approved for publication.

## Pre-existing Cloudflare check and Drive access finding

A read of GitHub commit checks confirms the externally generated **Workers Builds: free-map-router** check was already **failure** on the pre-feature `main` baseline commit `f1e16547ea5a809931f79589f10ee40ffc349fd9`; failure on PR #125 cannot by itself be attributed to due-date changes. The same main baseline had successful GitHub deployment/build check records. The external Cloudflare build's own diagnostic log was not available in the connected GitHub sources. Do not call the Cloudflare failure fixed or skip any publication requirements on its account.

Read-only inspection found the governed Google Drive folder ID resolves as a `Free Map Router` folder for connected accounts, but direct searches returned **no accessible `Free Map Router Address Inbox.json`** under the available linked Drive scopes. A real inbox overwrite/export was not attempted; workbook and app remain unchanged.
