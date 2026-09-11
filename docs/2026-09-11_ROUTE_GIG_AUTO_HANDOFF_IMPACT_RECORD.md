# One-Step Routed Manual-Gig Handoff Impact Record

**Date:** 2026-09-11  
**Change class:** Level 3 — cross-application synchronization / companion Drive write  
**Status:** IMPLEMENTATION AUTHORIZED / PRE-MERGE APPROVAL PENDING  
**Branch:** `work/one-step-routed-gig-handoff-20260911`  
**Draft PR:** #103 — `Simplify routed manual-gig handoff`  
**Rollback base:** `e6a0bc301517dadda9f3c454c3de1c95d1e831ce`  
**Workbook companion:** `work/one-step-routed-gig-receive-20260911` / PR #35

## Why this change exists

The normal route workflow currently makes the operator remember an extra manual-gig synchronization sequence between Free Map Router and the workbook. A valid route can contain an exact manual `Gig_ID` that the workbook cannot print yet because that same Gig_ID has not separately been copied into `Gig_Log`.

The operator identified the workflow itself as the problem: too many cross-system steps to remember. The approved goal is to keep the app's existing pages, route behavior, and explicit manual sync control, while removing that extra sync requirement from the normal routed-gig path.

Earlier draft PR #102 was closed unmerged when the operator asked to keep the live app unchanged while the workflow was reassessed. This clean continuation preserves the same narrow implementation on a new branch; opening this branch/PR does not alter production.

## Approved normal behavior

When the operator explicitly presses **Send Route Order to Workbook**:

- a displayed route with no manual gigs keeps the existing route-order-only write path;
- a displayed route containing one or more exact manual `Gig_ID`s builds the existing full gig handoff and route order from one operation timestamp;
- every routed `Gig_ID` must exist in the handoff before Drive authorization or publication;
- `Free Map Router Gig Handoff.json` is written first;
- only after that succeeds is `Free Map Router Route Order.json` written;
- both artifacts use the same normalized top-level `updatedAt`;
- a gig-handoff write failure prevents route-order publication;
- the existing **Sync Gigs to Workbook** control remains available as the separate full-ledger/manual refresh path.

This is not background synchronization. The companion handoff occurs only as part of the operator's explicit route-send action and only when that displayed route contains manual gig work.

## Runtime ownership

Changed runtime:

- `route-order-ui.js` — prepares the route order and, only when needed, its companion gig handoff from one operation time; publishes handoff first and route order second.

Reused unchanged:

- `gig-handoff.js` — existing handoff schema, validation, and Drive writer;
- `FMRManualGigs.list()` — current manual-gig ledger provider;
- existing route-order schema and Drive helpers.

Focused protection:

- `tests/route-order-gig-auto-handoff.test.js`;
- active-Day route-send coverage in `tests/phase-2j-active-day-route-order.test.js`.

## Data, schema, and permission boundary

No new schema or permission is introduced:

- no new route-order or gig-handoff version;
- no new Drive filename or folder;
- no new OAuth scope;
- no new browser-storage key;
- no migration;
- no new page, timer, observer, polling loop, or background sync.

The only additional write is the already-governed `Free Map Router Gig Handoff.json`, and only when the explicitly sent displayed route contains manual gigs. The route itself, saved addresses, pins, Home, route membership/order, Manual Work Library, backups, corrections, workbook inbox, API keys, and local gig records are not changed by this send orchestration.

## Identity and failure rules

- routed manual work is identified only by exact immutable `Gig_ID`;
- address, source, work-order text, and property similarity are never identity substitutes;
- a routed Gig_ID missing from the current handoff stops before Drive authorization/publication;
- a gig-handoff write failure prevents route-order publication;
- if route-order publication fails after a successful handoff write, the route send reports failure; the standalone handoff does not itself change workbook route numbers;
- duplicate governed files retain the existing fail-closed behavior;
- a no-gig route remains the existing one-file route-order operation.

## Contract housekeeping included

The FMR product contract and regression checklist are also corrected to match the already-merged service-duration behavior from PR #101:

- manual gig with no saved planning remains unknown;
- saved planning with Service Minutes left blank means the explicit five-minute **Use default** choice;
- an explicit valid duration override still wins.

That is documentation alignment for existing production behavior, not a second runtime change.

## Verification evidence

On current PR head `84c12ce5073f525899db373561a3eed9477d9e44`, GitHub Actions **Verify Contract and App** run #332 completed successfully. Its complete regression-suite step and first-party JavaScript syntax step both passed.

The final FMR gate still requires:

- final diff inspection for scope;
- workbook companion verification/deployment first;
- the cross-system reality gate using the actual Send Route Order action and actual Drive artifacts;
- explicit Level 3 pre-merge operator approval after the evidence is complete.

## Cross-system reality gate

Use the existing workbook Sandbox path; do not create another routine workbook. The final gate must:

1. send a displayed route containing a previously unsynced manual gig through the actual FMR **Send Route Order to Workbook** control;
2. confirm both governed Drive artifacts exist and share the same top-level `updatedAt`;
3. receive that route in the Sandbox workbook without running either separate manual-gig sync action first;
4. confirm the exact routed Gig_ID appears once in the route packet and route numbers apply correctly;
5. confirm ordinary no-gig route sending remains unchanged.

Because the Sandbox shares the governed FMR handoff resources, those writes are treated as shared-integration writes rather than as an isolated mock.

## Ordered rollout

Workbook consumer first:

1. verify and merge/deploy workbook PR #35;
2. confirm workbook-side compatibility;
3. then merge/publish FMR PR #103;
4. run the cross-system smoke/reality check.

Publishing the FMR producer first is prohibited because it could create route sends that rely on workbook behavior not yet deployed.

## Rollback

Restore FMR route-send runtime to `e6a0bc301517dadda9f3c454c3de1c95d1e831ce`. No migration cleanup is required. A valid gig-handoff file left in Drive is safe to retain because it does not itself change workbook route numbers.

## Approval state

The operator approved this simplified workflow and authorized implementation with “let's do it.” The live app remains unchanged while the work stays on this draft branch. Per the Level 3 contract, a separate explicit pre-merge approval is still required after final workbook verification and cross-system evidence are ready.
