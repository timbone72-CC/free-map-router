# Phase 2J — Day-Aware Workbook Return and Print

**Status:** COMPLETE / MERGED / DEPLOYED — CROSS-SYSTEM REALITY GATE PASSED  
**Design date:** 2026-09-08  
**Closeout date:** 2026-09-09  
**FMR implementation branch:** `phase-2j/day-aware-workbook-return`  
**FMR rollback base:** `65bd25b853b2836e99f48b20fc6e85fff4d1179f`  
**FMR runtime head:** `1bf972cb7db115e2bac2d0014b82d23f36e83acf`  
**FMR merge commit:** `bc03d6785f8bec1518bfdc44594564113d565f4e`  
**Workbook companion branch:** `work/phase-2j-day-aware-return-20260908`  
**Workbook rollback base:** `98cc1046bf8670de94a74c07ca90ac46a77c286d`  
**Workbook runtime head:** `04c3a2a980739b950c14376a6b84ec46f5e47515`  
**Workbook merge commit:** `1e5630e391f277aa1a783f51b12d653e57c10bd7`

## Closeout summary

Phase 2J is closed. The approved day-aware route-return design was implemented
in both repositories, validated through the real operator flow and real Drive
artifact, merged after explicit Level 3 pre-merge approval, and deployed in the
required workbook-first order.

Closeout evidence:

- workbook PR #32 merged and its production Apps Script `clasp push` succeeded;
- FMR PR #99 merged into `main`;
- Google Cloud Build for FMR main commit `bc03d6785f8bec1518bfdc44594564113d565f4e`
  completed successfully on 2026-09-09;
- Day 1 actual send produced only Source_IDs `112605349`, `112655076`, and
  `112620264` with v2 active-Day Route Plan metadata;
- the workbook Sandbox received/numbered/printed only Day 1 and left Day 2
  `112147281` untouched;
- the Day 1 packet showed `Day 1 of 2 — 2026-09-09`;
- Day 2 actual send then produced only Source_ID `112147281`;
- the workbook replaced the current route-number/packet view with Day 2 only;
- the Day 2 packet showed `Day 2 of 2 — 2026-09-10`;
- FMR retained both Days after both sends; and
- workbook Print checkboxes remained unchanged.

The historical design sections below are retained as the implementation record.
Statements that described the runtime as not yet implemented are superseded by
this closeout summary.

## Operator-approved goal

Make the existing Free Map Router → workbook route-order return understand that the displayed route is one active Day inside a larger FMR-owned Route Plan.

The finished behavior lets the operator:

1. keep a complete multi-day Route Plan in FMR;
2. display Day 1 and send only Day 1 to the workbook;
3. receive/number/print only Day 1 in the workbook;
4. later switch FMR to Day 2 and send/number/print Day 2 without rebuilding the Route Plan or re-importing Day 1; and
5. see a clear Day/date label on the printed packet so packets cannot be mistaken for one another.

## Evidence for the change

Phase 2I route history exposed the active Route Plan Day through the compatibility `google`, `basic`, and `dayContext` views. The route-order serializer therefore already had access to the active Day's selected route without requiring a second planner model.

The prior workbook receiver was the blocker: `iadfRequireCurrentFreeMapRouterRouteOrder_()` required returned InspectorADE Order IDs to equal the complete current Address Inbox Order-ID set. That was correct for the earlier one-day model, but it rejected a deliberate Day 1 subset when Day 2/Day 3 work correctly remained in FMR.

The prior route-order return also lacked explicit Route Plan / Day identity and print labeling.

## Change classification

The runtime portion was **Level 3 / cross-application synchronization** because it changed the JSON handoff contract and workbook acceptance rules.

The implementation used the required realistic fixture/safe environment, complete final test gates, Cross-System Reality Gate, exact rollback points, and explicit operator pre-merge approval.

## Ownership boundaries

### Free Map Router owns

- the complete Route Plan;
- `planId`, Route Plan revision, active `dayId`, Day revision, Day order, Day count, and optional local route date;
- all other Days not currently returned;
- the displayed Google/Basic route for the active Day;
- writing the one existing `Free Map Router Route Order.json` file only after the explicit send action.

### Workbook owns

- validating the return file;
- exact `Job_Log.Source_ID` lookup;
- exact `Gig_Log.Gig_ID` lookup for routed manual gigs;
- clearing/replacing only `Job_Log.Stop` and `Job_Log.Print Order` for the returned Day;
- rebuilding the current Google Doc route packet for the returned Day;
- print presentation of the returned Day/date context.

### Explicitly not owned by this phase

- storing the complete FMR Route Plan in the workbook;
- changing `Job_Log.Address`, City, ZIP, Source, Source_ID, completion, forecast, notes, instructions, or Print checkbox values;
- changing `Gig_Log` data or workbook-owned `Actual_Pay`;
- changing prediction/history behavior;
- changing FMR Route Plan membership, Day assignments, completion state, optimization, saved addresses, gigs, corrections, or pending workbook route;
- adding another Drive file or broader Drive permission.

## Route-order schema decision

Do **not** weaken legacy `routeOrderVersion: 1`.

### Version 1 — legacy one-day return

Version 1 remains backward-compatible and keeps its existing rule:

- if InspectorADE Order IDs are present, `sourceUpdatedAt` must exactly match the current workbook Address Inbox; and
- the returned InspectorADE Order-ID set must exactly equal the current inbox Order-ID set.

A partial version-1 return remains a refusal condition.

### Version 2 — explicit active-Day return

Phase 2J introduced `routeOrderVersion: 2` in the same file and with the same app/target identity.

Required top-level field:

- `routeScope: "active_day"`

Required `routePlan` object:

- `planId` — nonblank stable FMR Route Plan ID;
- `planRevision` — positive whole number;
- `dayId` — nonblank stable FMR Day ID;
- `dayRevision` — positive whole number;
- `dayNumber` — positive whole number;
- `dayCount` — positive whole number, with `dayNumber <= dayCount`;
- `routeDate` — valid local `YYYY-MM-DD` or `null`.

Existing fields remain:

- `app`;
- `target`;
- `updatedAt`;
- `routeSlot`;
- `optimizationStatus`;
- `sourceUpdatedAt`;
- `stops[]` with visible `stopNumber`, address context, exact `orderIds`, and exact `gigIds`.

Version 2 does **not** carry the other Days' route stops or work-item lists. FMR remains the durable owner of the full plan.

## Version-2 freshness and identity rules

When a v2 return contains InspectorADE Order IDs:

1. `sourceUpdatedAt` is required and must exactly equal the current Address Inbox `updatedAt`.
2. Every returned InspectorADE Order ID must exist in that current inbox.
3. A returned InspectorADE Order ID not present in the current inbox is a hard refusal before workbook route-number writes.
4. Current-inbox Order IDs omitted from the v2 return are allowed because they may belong to another FMR Day.
5. Missing current-inbox IDs are **not** interpreted as deletion, completion, cancellation, or damage.
6. The workbook still matches jobs only by exact `Job_Log.Source_ID`; address text is never identity.

When a v2 return is manual-gig-only, the existing exact `Gig_Log.Gig_ID` validation remains authoritative and `sourceUpdatedAt` may be null.

Across both versions, duplicate stop numbers, repeated Order IDs, repeated Gig IDs, malformed IDs, unknown Gig IDs, missing Job_Log IDs, or duplicate Job_Log/Gig_Log identities fail closed before route-column writes.

## Day-aware workbook write rule

After the complete return is validated:

- clear every old `Job_Log.Stop` and `Job_Log.Print Order` value;
- write the returned visible stop number only to exact returned InspectorADE `Source_ID` rows;
- preserve visible numbering gaps created by app-only stops/manual-only stops;
- leave every other Job_Log field unchanged;
- do not store Day 2/Day 3 route state in hidden workbook fields.

Receiving Day 2 later intentionally replaces the current Day 1 route-number view. Day 1 continues to exist in FMR.

## Day-aware print rule

For a valid v2 active-Day return, the rebuilt Google Doc packet is selected from the validated returned identities, not from unrelated workbook Print checkbox state.

- print exactly the returned InspectorADE jobs and routed manual gigs;
- ignore unrelated checked Print rows that are not in the returned Day;
- do not change or clear any Print checkbox as part of receive;
- keep corrected FMR address text print-only;
- preserve the existing three-items-per-page card geometry and field-instruction rules;
- show `Day N of M` on the packet;
- when `routeDate` is non-null, show the local route date with the Day label;
- make the Day/date label visible on every printed page, not only in a transient dialog.

A later Day 2 return replaces the current Google Doc route packet with Day 2 only.

## Success wording

FMR send and workbook receive success surfaces report three truthful counts:

- InspectorADE jobs;
- manual gigs;
- total returned work items.

Physical stop count may be shown separately but must not be confused with work-item count.

## Read/write surfaces

### FMR reads

- current Route History v7 active Route Plan;
- active Day's selected Google/Basic route snapshot;
- active Day context;
- saved stop address display data.

### FMR writes

- existing `Free Map Router Route Order.json` only.

### Workbook reads

- `Free Map Router Route Order.json`;
- current `Free Map Router Address Inbox.json` when InspectorADE IDs are returned;
- `Job_Log` exact Source_ID and print-card data;
- `Gig_Log` exact Gig_ID and manual-gig print data.

### Workbook writes

- `Job_Log.Stop`;
- `Job_Log.Print Order`;
- current Google Doc route packet presentation;
- existing best-effort audit surface only when healthy.

## Schema matrix

| Surface | Required for Phase 2J | Write authority |
|---|---|---|
| FMR Route Plan | active plan/day identity and selected Day route | FMR existing planner only; send is read-only |
| Route Order JSON v2 | app/target/version/scope/times/route slot/status/routePlan/stops | FMR replaces existing app-owned file |
| Address Inbox JSON | current `updatedAt` and current InspectorADE `orderIds` | read-only during receive |
| Job_Log | `Source_ID`, `Stop`, `Print Order`; existing print-card fields read as available | Stop + Print Order only |
| Gig_Log | `Gig_ID` plus existing gig print fields | read-only |
| Google Doc route packet | returned Day cards + Day/date label | generated presentation only |

No workbook sheet schema change was introduced.

## Stale / damaged output behavior

Before route columns are changed, refuse:

- unsupported route-order version;
- v2 missing `routeScope: active_day`;
- malformed/missing Route Plan or Day identity;
- invalid Day number/count/date;
- stale/mismatched `sourceUpdatedAt` when InspectorADE work is present;
- any returned InspectorADE ID outside the current inbox;
- any missing/duplicate workbook Source_ID;
- any missing/duplicate routed Gig_ID;
- duplicate route-order Drive files;
- malformed JSON or wrong app/target/file type.

A refusal preserves existing route numbers and current print output.

If route numbers were successfully applied but document generation later fails, the implementation retains the existing behavior of reporting the print failure without pretending the route-column write was rolled back.

## Ordered rollout — completed

1. **Workbook companion first:** legacy v1 remained accepted while v2 active-Day validation/printing was added.
2. Workbook focused/full tests and Sandbox behavior passed before the FMR producer rollout.
3. **FMR second:** v2 active-Day route-order production was enabled.
4. Actual produced JSON artifacts were inspected.
5. The workbook Sandbox consumed the Day 1 and Day 2 artifacts and verified exact Day-only numbering/printing.
6. Explicit Level 3 pre-merge approval was received.
7. Workbook PR #32 merged and the production Apps Script push succeeded.
8. FMR PR #99 merged and the automatic Google Cloud Build succeeded.

An older FMR v1 file remains compatible with the upgraded workbook.

## Cross-System Reality Gate — PASS

The real controls were used:

1. A known InspectorADE set was loaded into FMR.
2. FMR retained a Route Plan with Day 1 and Day 2 work.
3. Day 1 became active and **Send Route Order to Workbook** wrote v2.
4. The actual Drive JSON contained the required v2 Day metadata and only Day 1 IDs.
5. Workbook **Receive Route Order + Rebuild Print** consumed that artifact.
6. Only Day 1 jobs received Stop/Print Order values and only Day 1 printed with the correct label.
7. Day 2 remained intact in FMR.
8. Day 2 became active and the send/receive repeated.
9. Day 1 workbook route numbers were cleared/replaced by Day 2 values, the Google Doc contained Day 2 only, and the FMR plan still retained both Days.

The isolated Phase 2J validation folders used for this gate are not production dependencies and are approved for retirement in the 2026-09-09 housekeeping pass.

## Automated verification completed

### FMR

Final evidence before merge:

- complete regression suite: 486/486;
- focused Phase 2J: 8/8;
- root JavaScript syntax checks passed;
- GitHub Actions passed on exact runtime head `1bf972cb...`.

Coverage included:

- v2 serializer active-Day plan/day metadata and exact active-Day work IDs;
- multiple exact Order IDs and Gig IDs at one physical stop;
- no inactive-Day leakage;
- no invented IDs for app-only stops;
- fail-closed malformed/duplicate work identity;
- route date null/valid-date handling; and
- truthful InspectorADE/gig/total-work-item success counts.

### Workbook companion

Final evidence before merge:

- focused Phase 2J: 9/9;
- relevant v1 + Phase 2E compatibility: 21/21;
- focused governance: 15/15;
- complete suite: 470/470.

## Rollback

FMR rollback point: `65bd25b853b2836e99f48b20fc6e85fff4d1179f`.

Workbook rollback point: `98cc1046bf8670de94a74c07ca90ac46a77c286d`.

Because rollout was workbook-first and the workbook remains v1-compatible, FMR can be rolled back to the v1 producer without making the upgraded workbook unusable.

## Approval and publication closeout

The user explicitly approved merging FMR PR #99 and workbook PR #32 after the Cross-System Reality Gate passed.

The approved release transaction is complete:

- workbook PR #32 merged and production Apps Script push succeeded;
- FMR PR #99 merged;
- automatic Google Cloud Build completed successfully.

No additional Phase 2J runtime change is authorized by this closeout record. Any later behavior change requires a new governed work item.
