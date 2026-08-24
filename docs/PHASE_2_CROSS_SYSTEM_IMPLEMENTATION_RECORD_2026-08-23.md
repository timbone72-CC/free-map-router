# Phase 2 Cross-System Implementation Record — Gig Handoff, Route Pay, Weekly Expected Pay

**Status:** DESIGN APPROVED — DOCUMENTATION ONLY / RUNTIME NOT STARTED  
**Date:** 2026-08-23  
**Primary roadmap:** `docs/FIELD_WORK_EXPANSION_PLAN.md`  
**Free Map Router baseline:** `4a234e5f1829a64189b815f8d9493d29de72006c`  
**Workbook repo:** `timbone72-CC/inspectorade-drop-forecast-workbook-audit`  
**Workbook working branch:** `audit/fix-codex-findings`

## Purpose

Define the smallest safe Phase 2 design for:

- HNP/Other gig completion and due dates;
- expected route pay across InspectorADE work plus manual gigs;
- a separate gig handoff into the workbook without using InspectorADE `Job_Log`;
- a compact weekly expected-pay schedule for GIS and HNP.

This record does not authorize runtime edits, deployment, `clasp push`, Drive-data changes, or workbook schema changes by itself. Each runtime chunk below still uses its own risk-matched impact record and required approval.

## Evidence verified before design

### Free Map Router

Current manual gig schema version 1 stores:

- immutable `Gig_ID` (`id`);
- physical `stopId`;
- source/company;
- optional work-order ID;
- optional nonnegative expected pay;
- notes;
- route-inclusion state;
- created/updated timestamps.

It does not store a due date or completed date. Route history version 4 preserves workbook Order IDs and manual Gig IDs by physical stop, but it does not preserve InspectorADE pay metadata.

The permanent Manual Work Library is property/template memory only. It intentionally does not own gig pay, work-order IDs, route membership, GIS/DCFS source, or workbook Order IDs. Whole-app backup remains recovery rather than live gig synchronization.

### Workbook

`Job_Log` already owns the InspectorADE fields needed for weekly GIS expected pay:

- `Source`;
- `InspectorPay`;
- `Turn_In_Date`;
- `Completion_Status`.

The current Dashboard already keeps open assigned-work pay separate from predicted future-work pay. Phase 2 must preserve that separation.

The current workbook-to-router version-1 Address Inbox already de-duplicates physical addresses and preserves every represented `Source_ID` in optional `orderIds`. Optional pay metadata can be added without turning address text into job identity.

### HNP pay-cycle evidence

A real HNP payroll report sent Monday 2026-08-17 covered accounting period 2026-08-09 through 2026-08-15, which is Sunday through Saturday, and stated that payment had already been processed. The operator confirmed this is the correct HNP cycle.

### Operator-confirmed rules

- HNP work normally arrives by text message and the due date is often agreed by phone.
- A reliable received date is not always captured and is not required.
- HNP pay period is Sunday through Saturday; expected payday is the following Monday.
- GIS weekly cutoff is Saturday; expected payday is the following Friday.
- DCFS payroll timing is not known yet and remains unconfigured.
- Keep the design lean: no fields or automation without a current use.

## Approved minimal user data

### Manual gig occurrence

Keep the current fields and add only:

- `dueDate` — optional local calendar date (`YYYY-MM-DD`);
- `completedDate` — blank until completed, then a local calendar date (`YYYY-MM-DD`).

Do **not** add:

- received date;
- stored pay-period fields;
- stored expected-payday fields;
- invoice status;
- payment status;
- paid date;
- calendar integration;
- background notifications.

Pay period and expected payday are derived, not stored.

## Data ownership

### Free Map Router is authoritative for

- `Gig_ID`;
- source/company;
- physical address attachment;
- work-order/job ID;
- expected pay;
- due date;
- completed date;
- gig notes;
- route inclusion.

### Workbook is authoritative for

- InspectorADE `Job_Log` and all InspectorADE prediction/history data;
- manual `Actual_Pay` entered later in `Gig_Log`.

### Workbook `Gig_Log` is a durable mirror/ledger

FMR-owned fields in `Gig_Log` are updated only from a validated FMR gig handoff by exact `Gig_ID`. The workbook may not invent, re-key, merge, or delete gigs by address or work-order text.

`Actual_Pay` is workbook-owned and must survive every later FMR sync.

There is no Phase 2 bidirectional gig sync back into FMR.

## Gig schema migration — Phase 2A

### Proposed app schema

Manual gig schema version changes from 1 to 2 by adding:

- `dueDate: string | null`;
- `completedDate: string | null`.

Migration rules:

- valid version-1 gigs load as version 2 with both new fields blank;
- immutable `Gig_ID`, stop attachment, source, work-order ID, expected pay, notes, route state, and timestamps are preserved;
- invalid dates fail closed for the affected gig record under the existing damaged-record safety model;
- completing a gig does not automatically remove its route stop or change InspectorADE work;
- clearing a completed date does not delete the gig.

### Minimal UI

Use the existing **Addresses → Manual Gigs** surface.

- Add optional **Due Date** to the existing gig form.
- Add editable **Completed Date** to the existing gig form.
- Add one **Complete Today** action for an incomplete gig; it sets `completedDate` to the current local date.
- If the operator forgot to complete it that day, Edit allows the completed date to be corrected.
- Do not add a new page or lifecycle/status control.

When a repeat template creates a new gig occurrence through **Add to Route**, the new occurrence receives the template's scheduled due date that existed before the template advances to its next occurrence.

No one-off gig due-alert expansion is included in Phase 2A. Due Date is stored/displayed only unless separately approved later.

## Route expected pay — Phase 2B

### Goal

On the selected Google or Basic route, show the money represented by that route without mixing InspectorADE identity/history with manual gig identity.

### Workbook Address Inbox extension

Keep `inboxVersion: 1`. For each de-duplicated physical address, add optional:

- `expectedPay` — sum of valid nonnegative `Job_Log.InspectorPay` values for all checked InspectorADE jobs represented by that address;
- `expectedPayComplete` — true only when every represented checked InspectorADE job has a valid nonnegative pay value.

Existing fields remain unchanged:

- `address`;
- optional corrected-address alias fields;
- optional `source` (`GIS` / `DCFS` only);
- optional `orderIds` containing every represented exact `Source_ID`.

Address remains physical-stop identity only. `orderIds` remain workbook-job identity. Pay never becomes identity.

When duplicate checked rows collapse to one address, their pay is summed exactly once per represented job.

### FMR inbox and route-history extension

The inbox parser accepts the optional pay fields and keeps older version-1 inboxes valid.

Route history advances from version 4 to version 5 with workbook pay metadata attached to the specific pending/Google/Basic route snapshot by stop ID. The metadata must:

- stay with the route snapshot that received it;
- copy from pending into both named routes on **Start New Route**;
- follow exact stop-ID remaps during address correction/de-duplication;
- sum safely when two workbook-linked stops merge into one retained physical stop;
- be removed when **Clear InspectorADE Jobs** removes the workbook work;
- never be copied into permanent saved-address identity or Manual Work Library data.

### Route-pay calculation

For the selected route:

`known expected route pay = InspectorADE known expected pay + expected pay of every route-included manual gig represented by the selected route`

Rules:

- one physical stop may contain several paid work items;
- count each represented InspectorADE job once through the workbook stop total;
- count each included manual `Gig_ID` once;
- do not count Home;
- removing a stop from the selected route removes that stop's pay from that selected route total;
- a manual gig with blank expected pay does not become `$0` silently;
- if any represented work has unknown pay, show the known total plus a short **pay incomplete** warning.

Minimal Build Route display:

- InspectorADE expected pay;
- Manual gig expected pay;
- Total known expected pay;
- **Pay incomplete** only when needed.

No per-client financial dashboard is added to FMR.

## Gig handoff to workbook — Phase 2C

### New Drive file

Use one app-owned file in the existing governed **Free Map Router** folder:

`Free Map Router Gig Handoff.json`

Use the existing limited `drive.file` permission and the same exact governed-folder/account check already used for the route-order return. Do not request broader Drive access and do not use the whole-app backup or Manual Work Library as the handoff.

Initial JSON contract:

```json
{
  "app": "free-map-router",
  "gigHandoffVersion": 1,
  "updatedAt": "2026-08-23T00:00:00.000Z",
  "gigs": [
    {
      "gigId": "gig_...",
      "source": "HNP",
      "address": "123 Anywhere DR, Elk City, OK 73644",
      "workOrderId": "",
      "expectedPay": 200,
      "dueDate": "2026-08-25",
      "completedDate": "2026-08-23",
      "notes": "Mow grass",
      "updatedAt": "2026-08-23T00:00:00.000Z"
    }
  ]
}
```

`expectedPay`, `dueDate`, `completedDate`, `workOrderId`, and `notes` may be blank/null where allowed by the gig model. `Gig_ID`, source, address, and valid `updatedAt` are required for a handoff row.

The handoff does not contain:

- InspectorADE Order IDs;
- GIS/DCFS source impersonation;
- Home;
- route optimization state;
- Manual Work Library templates;
- actual pay.

### FMR write behavior

Add one explicit **Sync Gigs to Workbook** action on the existing Manual Gigs surface.

- No automatic handoff write.
- One exact file only; duplicates fail closed.
- A failed/cancelled write leaves local gigs unchanged.
- Existing route-order send remains separate.

### Workbook `Gig_Log` schema

Create one dedicated visible sheet with exactly these initial columns:

1. `Gig_ID`
2. `Source`
3. `Address`
4. `Work_Order_ID`
5. `Expected_Pay`
6. `Actual_Pay`
7. `Due_Date`
8. `Completed_Date`
9. `Notes`
10. `FMR_Updated_At`

No received date, stored pay period, stored expected payday, paid date, route number, InspectorADE `Source_ID`, prediction key, or forecast fields are added.

### Workbook sync behavior

Add one explicit normal-workflow sync action; do not make Dashboard refresh or Step 1 silently import gig data.

The sync action:

- requires a healthy governed `Gig_Log` created by explicit Step 1 setup;
- reads exactly one `Free Map Router Gig Handoff.json`;
- validates the whole payload before writes;
- requires unique nonblank `Gig_ID` values;
- upserts by exact `Gig_ID` only;
- updates only FMR-owned columns;
- preserves `Actual_Pay` on every update;
- skips an older incoming `FMR_Updated_At`;
- treats same-timestamp/different-content data as ambiguous and stops rather than guessing;
- never deletes a `Gig_Log` row merely because a later handoff omits it;
- never writes `Job_Log`, `Archive_Job_Log`, `Prediction_History`, prediction outputs, or InspectorADE source fields.

A normal sync may append new gigs and update newer FMR-owned fields, but deletion/compaction is not part of Phase 2C.

## Weekly expected-pay Dashboard — Phase 2D

### Keep existing Dashboard meanings

Do not replace or reinterpret:

- **Open Assigned Work**;
- **Predicted Future Work**;
- existing GIS/DCFS open pay;
- prediction accuracy.

Add one compact **Weekly Expected Pay** section.

### Schedule rules

#### HNP

- qualifying date: `Gig_Log.Completed_Date`;
- source must be `HNP`;
- pay value: `Gig_Log.Expected_Pay`;
- work period: Sunday through Saturday;
- expected payday: following Monday.

#### GIS

- qualifying date: `Job_Log.Turn_In_Date`;
- source must be `GIS`;
- pay value: `Job_Log.InspectorPay`;
- work period: Sunday through Saturday ending at the Saturday cutoff;
- expected payday: following Friday.

#### DCFS

No weekly pay rule until real evidence establishes it. Existing DCFS open-pay display remains unchanged.

### Compact display window

Show the next two scheduled paydays for HNP and the next two scheduled paydays for GIS, including a payday that is today. This normally produces four rows total, sorted by payday.

Each row shows only:

- expected payday;
- source;
- Sunday–Saturday work period;
- expected pay total.

Examples of the relationship:

- HNP Monday 2026-08-24 → work completed 2026-08-16 through 2026-08-22;
- GIS Friday 2026-08-28 → work turned in 2026-08-16 through 2026-08-22.

The following Monday/Friday rows accumulate the current Sunday–Saturday period as work is completed/turned in.

The Dashboard derives these dates at refresh time. Pay period and expected payday are not stored in `Job_Log` or `Gig_Log`.

### Missing pay

Do not silently convert a blank expected pay to zero for a completed HNP gig. If a displayed HNP period contains completed gigs without Expected_Pay, show the known total with a short incomplete-pay note.

GIS uses the same principle if a qualifying turned-in GIS row lacks valid `InspectorPay`.

## Phase 2E — Google Print gig details

The roadmap goal of showing InspectorADE and manual gig details in one Google Print route packet remains valid, but it is **deferred until 2A–2D are live-validated**.

Reason: the durable gig ledger and pay rules do not by themselves identify which manual gigs belong to the currently displayed route/stop numbering. Do not overload the gig ledger with transient route state just to make printing work.

When Phase 2E starts, design the smallest route-context handoff needed for print rather than adding route fields to `Gig_Log` prematurely.

## Implementation chunks and risk

### 2A — Gig due/completed dates

- FMR runtime only.
- Level 3 because the durable gig/backup schema changes.
- Expected owning files: `gig-contract.js`, `manual-gigs.js`, `index.html`, backup compatibility code/tests, contracts/checklist.
- No workbook runtime change.

### 2B — Combined expected route pay

- Coordinated workbook + FMR runtime change.
- Level 3 because workbook inbox meaning and route-history storage change.
- Workbook owner: `22_FreeMapRouterExport.gs` plus focused handoff tests/contracts.
- FMR owners: `inbox.js`, `route-history.js`, `app.js`/Build Route rendering, backup compatibility where route history is serialized, focused tests/contracts.
- Keep `inboxVersion: 1` by using optional backward-compatible pay fields.

### 2C — Gig handoff and `Gig_Log`

- Coordinated workbook + FMR runtime change.
- Level 3 because it adds a new cross-application Drive file, workbook sheet/schema, and explicit synchronization writes.
- FMR owners: `google-drive.js`, `manual-gigs.js`, `index.html`, a narrow gig-handoff contract/helper if needed, focused tests/contracts.
- Workbook owners: `00_Config.gs`, `01_Schema.gs`, `09_Menu.gs`, one new dedicated gig-handoff/sync Apps Script file, focused tests/contracts.

### 2D — Weekly Expected Pay Dashboard

- Workbook runtime only after 2C is stable.
- Presentation/reporting logic reads `Job_Log` and `Gig_Log`; writes Dashboard only.
- Expected owner: `20_StartHereDashboard.gs` plus focused tests/contracts.
- No FMR runtime change.

### 2E — Google Print gig details

- Deferred.
- Separate design/approval after 2A–2D soak.

## Baseline verification state

Known current baselines before Phase 2 runtime work:

- FMR exact Phase 1C head passed 284/284 tests before merge; live Phase 1C behavior was then operator-validated.
- Workbook current live-validated baseline in `CURRENT_WORK.md` reports 347/347 complete-suite tests for its latest deployed stabilization work.

Before each runtime chunk, re-read current contracts and record the then-current exact branch heads, focused tests, expected post-change count/coverage, rollback point, and live checks. Do not reuse these historical counts if either repository has advanced.

## Protected behavior

Every Phase 2 chunk must preserve unless explicitly approved otherwise:

- InspectorADE `Job_Log` remains the InspectorADE assignment ledger;
- HNP/Other never enters InspectorADE prediction history or prediction scoring;
- one physical address remains one driving stop even when multiple jobs/gigs exist there;
- immutable `Gig_ID` remains manual-gig identity;
- exact `Source_ID` remains workbook job identity for the existing route-order return;
- Basic and Google route choices remain separate;
- permanent address corrections remain separate from Manual Work Library and gigs;
- Manual Work Library property/template data does not become the gig/pay ledger;
- whole-app backup remains recovery, not the gig handoff;
- existing route-order return remains separate from gig synchronization;
- existing Dashboard open pay and predicted pay keep their current meanings;
- no DCFS payroll schedule is guessed;
- no new broad Drive permission is introduced.

## Stop conditions

Stop implementation and return to design if any of these assumptions prove false:

- HNP payroll no longer follows Sunday–Saturday with Monday pay;
- GIS Saturday cutoff / following-Friday pay is contradicted by real payroll evidence;
- exact `Gig_ID` cannot be preserved through the proposed handoff;
- existing inbox optional fields cannot remain backward-compatible;
- route-pay metadata would require making pay part of stop identity;
- `Gig_Log` sync would require overwriting `Actual_Pay`;
- the only implementation path requires broad Drive access or automatic Dashboard writes to stored data.
