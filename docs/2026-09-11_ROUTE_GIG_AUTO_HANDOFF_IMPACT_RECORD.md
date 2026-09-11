# Route Send Manual-Gig Handoff Impact Record

**Date:** 2026-09-11  
**Change class:** Level 3 — cross-application synchronization / automatic companion Drive write  
**Status:** IMPLEMENTATION AUTHORIZED / PRE-MERGE APPROVAL PENDING  
**Branch:** `fix/route-gig-auto-handoff-20260911`  
**Rollback base:** `e6a0bc301517dadda9f3c454c3de1c95d1e831ce`  
**Workbook companion branch:** `fix/route-gig-auto-bootstrap-20260911`

## Problem and evidence

The operator sent a clean Free Map Router route containing an exact routed manual `Gig_ID`, then the workbook refused **Receive Route Order + Rebuild Print** because that Gig_ID was not already present in `Gig_Log`. The existing FMR workflow publishes `Free Map Router Route Order.json` independently from the explicit **Sync Gigs to Workbook** action, so a valid route can arrive before the companion gig ledger data needed to print it.

This forces the operator to remember a separate sync step even though the route send already knows which exact Gig_ID values it is returning.

## Approved behavior

When the operator explicitly presses **Send Route Order to Workbook**:

- if the displayed route contains no manual gigs, preserve the current route-order-only write path;
- if the displayed route contains one or more manual gigs, build the current full gig handoff and the route-order artifact from one operation timestamp;
- before any Drive write, verify every routed `gigId` exists exactly once in the current handoff;
- reuse the existing `drive.file` authorization and exact governed folder;
- write `Free Map Router Gig Handoff.json` first;
- only after that succeeds, write `Free Map Router Route Order.json` second;
- if the handoff write fails, do not publish the route order;
- retain the explicit **Sync Gigs to Workbook** control as the operator's full-ledger refresh path.

The two artifacts share the same normalized top-level `updatedAt`, allowing the workbook companion to prove that a missing routed gig came from the same explicit route-send operation without changing either existing schema.

## Owning files and functions

Runtime:

- `route-order-ui.js` — explicit Send Route Order orchestration only;
- existing `gig-handoff.js` builder/writer and `FMRManualGigs.list()` are reused unchanged.

Focused coverage:

- `tests/phase-2j-active-day-route-order.test.js`;
- `tests/route-order-gig-auto-handoff.test.js`.

No `index.html` or cache-version change is required; the existing Update App/cache-busting path remains unchanged.

## Read surfaces

- current displayed active-Day route and route metadata;
- current saved stops used by the existing route-order producer;
- current manual gig collection used by the existing gig-handoff producer;
- existing Drive token and governed folder/file lookup behavior.

## Write surfaces

Only the two already-governed files in the existing Free Map Router folder:

1. `Free Map Router Gig Handoff.json` when routed manual gigs exist;
2. `Free Map Router Route Order.json` after the handoff succeeds.

No browser storage, route membership, route order, manual gig record, Manual Work Library record, workbook inbox, correction record, backup, Home value, or API key is written by this change.

## Required and optional data

Required for the companion-write path:

- a valid route-order artifact under the existing route-order contract;
- at least one exact routed `Gig_ID`;
- every routed Gig_ID must exist in the current valid manual gig collection and therefore in the built handoff;
- the existing governed Drive connection/folder must be available.

The handoff continues to carry only its existing approved fields and optional values. Blank optional pay/date/work-order/note values remain blank; nothing is invented to make the send succeed.

## Schema and permission impact

None.

- no new route-order version;
- no new gig-handoff version;
- no new Drive filename;
- no new folder;
- no new OAuth scope;
- no new browser-storage key;
- no stored-data migration;
- no new page or background synchronization.

## Hard limits and identity rules

- routed manual work is identified only by immutable exact `Gig_ID`;
- address text, work-order text, source, and property similarity never substitute for Gig_ID;
- duplicate/ambiguous route Gig_ID behavior remains fail-closed;
- existing route-order limits and gig-handoff validation remain unchanged;
- the companion handoff is a full current gig ledger snapshot, not a new routed-gig schema.

## Stale/failure behavior

- a routed Gig_ID absent from the current handoff stops before any Drive write;
- gig-handoff Drive failure stops the transaction before route-order publication;
- route-order Drive failure after a successful handoff reports the route send failure; the newer handoff alone is harmless because the workbook does not treat it as a route;
- no-gig route sends remain the existing one-file operation;
- duplicate governed files continue to fail closed through the existing Drive helpers.

## Realistic fixture / safe validation plan

Use existing test fixtures plus the established cross-system Sandbox workflow; do not create a new routine workbook.

Focused producer fixtures cover:

- active Day with workbook work and one exact manual gig;
- routed Gig_ID missing from the current manual gig collection;
- handoff Drive write failure;
- route with no manual gigs.

Before production publication, the Cross-System Reality Gate must exercise the real Send control, inspect both same-timestamp artifacts, and have the Sandbox workbook receive the route without running the separate manual-gig sync action first.

## Baseline and expected verification

Latest verified FMR baseline before this work: **486/486** complete-suite tests passed on the predecessor runtime line (Verify Contract and App run 327), with first-party JavaScript syntax checks passing.

Required final gate:

- focused route-send/gig-handoff tests pass;
- complete repository suite and syntax checks pass once on the exact final runtime head;
- final diff contains no unrelated runtime changes;
- cross-system reality evidence is completed in the approved Sandbox path;
- explicit Level 3 operator pre-merge approval is recorded.

The final suite count will be reported from the exact final runtime head rather than inferred.

## Protected behavior

- exact workbook Order-ID and manual Gig-ID route identity;
- current Google/Basic route order and active-Day selection;
- route optimization and timing behavior;
- manual gig storage/schema and Manual Work Library behavior;
- explicit **Sync Gigs to Workbook** remains available;
- existing Drive folder, filenames, `drive.file` scope, duplicate-file refusal, and account behavior;
- workbook Address Inbox and permanent correction behavior;
- all Home, pin, backup, route-history, completion, and planning state.

## Primary risks

- publishing a route order before its required gig data is durable;
- mismatching a route order with an older/newer handoff;
- silently weakening exact Gig_ID identity;
- accidental expansion into automatic background sync.

The handoff-first ordering, shared operation timestamp, exact identity check, and no background trigger are the controls for those risks.

## Rollback / recovery

Source rollback base: `e6a0bc301517dadda9f3c454c3de1c95d1e831ce`.

If post-publication verification fails, restore the predecessor route-send behavior. An extra valid gig-handoff file written before rollback is safe to leave in place; it does not itself change workbook route numbers or FMR local state.

## Ordered rollout

The workbook consumer must become compatible first. Production order is:

1. merge/deploy the workbook companion;
2. verify workbook-side compatibility;
3. merge/publish FMR producer;
4. run the cross-system live smoke check.

This avoids publishing a new producer behavior to a consumer that cannot use it.

## Affected smoke checks

After publication:

- send a route containing a manual gig and receive it in the workbook without manually running Sync Gigs first;
- confirm the exact gig appears in the generated packet and route numbers apply;
- confirm a route with no manual gigs still sends normally;
- confirm the explicit manual gig sync control still works as the full-ledger refresh path.

## Approval state

The operator explicitly authorized implementation with “do it.” Per Level 3 change control, a separate explicit pre-merge approval remains required after the final diff and verification evidence are ready.