# Phase 2J — Day-Aware Workbook Return and Print

**Status:** CONTRACT / DESIGN PHASE — NO RUNTIME CHANGE YET  
**Date:** 2026-09-08  
**FMR branch:** `phase-2j/day-aware-workbook-return`  
**FMR rollback base:** `65bd25b853b2836e99f48b20fc6e85fff4d1179f`  
**Workbook companion branch:** `work/phase-2j-day-aware-return-20260908`  
**Workbook rollback base:** `98cc1046bf8670de94a74c07ca90ac46a77c286d`

## Operator-approved goal

Make the existing Free Map Router → workbook route-order return understand that the displayed route is one active Day inside a larger FMR-owned Route Plan.

The finished behavior must let the operator:

1. keep a complete multi-day Route Plan in FMR;
2. display Day 1 and send only Day 1 to the workbook;
3. receive/number/print only Day 1 in the workbook;
4. later switch FMR to Day 2 and send/number/print Day 2 without rebuilding the Route Plan or re-importing Day 1; and
5. see a clear Day/date label on the printed packet so packets cannot be mistaken for one another.

## Evidence for the change

Current Phase 2I route history already exposes the active Route Plan Day through the compatibility `google`, `basic`, and `dayContext` views. The existing route-order serializer therefore sees the active Day's selected route without requiring a second planner model.

The current workbook receiver is the blocker: `iadfRequireCurrentFreeMapRouterRouteOrder_()` requires returned InspectorADE Order IDs to equal the complete current Address Inbox Order-ID set. That was correct for the earlier one-day model, but it rejects a deliberate Day 1 subset when Day 2/Day 3 work correctly remains in FMR.

The existing route-order return also lacks explicit Route Plan / Day identity and print labeling.

## Change classification

The runtime portion is **Level 3 / cross-application synchronization** because it changes the JSON handoff contract and workbook acceptance rules.

The contract/design commit is documentation-only and does not authorize deployment.

Runtime merge remains blocked until:

- governing contracts are amended first;
- focused producer → artifact → consumer coverage passes in both runtime-changed repositories;
- one final complete suite/syntax gate passes on each exact runtime head;
- the Cross-System Reality Gate passes; and
- explicit operator pre-merge approval is given.

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

Phase 2J introduces `routeOrderVersion: 2` in the same file and with the same app/target identity.

Required new top-level field:

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

FMR send and workbook receive success surfaces should report three truthful counts:

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

No workbook sheet schema change is planned.

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

If route numbers were successfully applied but document generation later fails, retain the current existing behavior of reporting the print failure without pretending the route-column write was rolled back.

## Ordered rollout

1. **Workbook companion first:** accept legacy v1 exactly as today and add v2 active-Day validation/printing.
2. Prove workbook focused tests and Sandbox behavior without changing the FMR producer.
3. **FMR second:** begin producing v2 active-Day route-order files.
4. Inspect the actual produced JSON artifact.
5. Receive it through the workbook Sandbox/shared handoff and verify exact Day-only numbering/printing.
6. Only after the full gate passes may either runtime change be considered mergeable/deployable.

During the ordered rollout, an older FMR v1 file must continue to work in the upgraded workbook.

## Cross-System Reality Gate operator path

Use the real controls:

1. Send a known InspectorADE set from the workbook to FMR.
2. In FMR create/retain a Route Plan with at least two Days and place known InspectorADE work on both Days; include a manual gig on one Day when practical.
3. Make Day 1 active, display the intended Google or Basic route, and press **Send Route Order to Workbook**.
4. Inspect the actual `Free Map Router Route Order.json` and verify v2 Day metadata plus only Day 1 work IDs.
5. In the workbook run **Receive Route Order + Rebuild Print**.
6. Verify only Day 1 jobs receive Stop/Print Order values and only Day 1 work prints with the correct Day/date label.
7. Confirm Day 2 remains intact in FMR.
8. Make Day 2 active and repeat the send/receive.
9. Verify Day 1 workbook route numbers are cleared/replaced by Day 2 values, the Google Doc now contains Day 2 only, and the FMR plan still retains both Days.

Unless separately proven isolated, the workbook test environment must be labeled **workbook sandbox / shared FMR handoff** because the Sandbox may use the same governed FMR Drive folder/file names.

## Focused automated coverage required

### FMR

- v2 serializer emits active-Day plan/day metadata and exact active-Day work IDs;
- one physical stop may carry multiple exact Order IDs and Gig IDs;
- no work from inactive Days leaks into the file;
- app-only stops carry no invented IDs;
- malformed/duplicate work identity still refuses;
- route date null/valid-date behavior is explicit;
- success count reports InspectorADE, gigs, and total work items truthfully.

### Workbook

- legacy v1 exact-full-set acceptance remains unchanged;
- partial v1 still refuses before writes;
- v2 exact current-inbox subset succeeds;
- v2 unexpected/stale InspectorADE ID refuses before writes;
- v2 missing/invalid Day metadata refuses before writes;
- exact Gig_ID validation remains fail-closed;
- receiving Day 2 clears/replaces Day 1 Stop/Print Order values;
- v2 Google Doc contains only returned identities even if unrelated Print rows are checked;
- every page carries the correct Day/date label;
- raw Job_Log addresses and every non-route field remain unchanged.

## Final runtime gates

Before merge of runtime changes:

- run focused tests while developing;
- record the baseline and final full-suite test counts from the actual parent/final heads;
- run each repository's complete required suite once on its final runtime head;
- run FMR root JavaScript syntax checks on its final runtime head;
- run workbook identity/predeploy checks appropriate to Sandbox vs production;
- inspect final diffs for unrelated changes;
- pass the Cross-System Reality Gate;
- obtain explicit operator pre-merge approval.

## Rollback

FMR rollback point: `65bd25b853b2836e99f48b20fc6e85fff4d1179f`.

Workbook branch rollback point: `98cc1046bf8670de94a74c07ca90ac46a77c286d`.

Because rollout is workbook-first and the workbook remains v1-compatible, FMR can be rolled back to the v1 producer without making the upgraded workbook unusable.

No production `clasp push`, FMR publication, merge, or deployment is authorized by this design record.