# Selectable Workbook Sync — Free Map Router Companion Impact Record

Date: 2026-08-30
Status: DESIGN LOCKED / IMPLEMENTATION IN PROGRESS / NOT MERGED / NOT DEPLOYED
Repository: `timbone72-CC/free-map-router`
Base: `6c7095b13f9ad221f88044681443b062c584e8d6`
Work branch: `work/selectable-workbook-sync-20260830`
Workbook companion repository: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`
Workbook companion branch: `work/fmr-selectable-sync-20260830`
Risk: Level 3 cross-system synchronization

## Problem and responsibility split

The workbook operator reported a route sync containing more workbook assignments
than intended. Cross-repo inspection shows the primary selection defect is in the
workbook producer, not FMR route snapshot merging:

- the workbook router action currently reuses a shared Daily Print collector whose
  checked rows bypass the OPEN predicate;
- successful workbook router sends leave Print selections checked, so previously
  sent open assignments can remain selected for a later send;
- FMR `applyAddressInbox()` already consumes only the current inbox artifact;
- FMR `stageWorkbookRoute()` replaces the pending workbook snapshot for a newer
  inbox rather than merging prior pending Order IDs into it.

The FMR runtime behavior required for work identity is therefore already correct.
The app-side companion is a narrow count/wording correction so the UI no longer
calls physical route stops `jobs` when multiple workbook Order IDs share one stop.

## Protected route identity

The following behavior remains unchanged:

- one normalized physical address is one saved stop;
- one stop may carry multiple exact workbook Order IDs in a route snapshot;
- Order IDs are not permanent saved-stop identity;
- newer workbook inbox data stages a pending route without replacing usable
  Google/Basic slots until Start New Route;
- Start New Route copies pending route IDs and exact Order IDs into both variants;
- route-order return sends every exact Order ID attached to each routed stop;
- corrections/aliases continue to resolve exact address identity only;
- manual Gig_ID routing is separate and unchanged.

## Companion runtime design

### Count workbook jobs explicitly

Add a small pure helper that counts represented workbook jobs in an inbox:

- if an address entry has one or more distinct `orderIds`, count those IDs;
- otherwise count the address entry as one represented legacy workbook job.

This keeps address-only v1 inboxes backward-compatible while accurately describing
same-address multi-order routes.

Add a route-snapshot helper with the same semantics:

- sum exact `orderIdsByStopId` counts for route stops that have IDs;
- fall back to one represented workbook job for a workbook route stop without IDs.

### Fix operator-facing language

Where FMR currently uses an address/routeId count and labels it `jobs`, change the
text to state both concepts when useful, for example:

`New Route Available — 2 workbook jobs at 1 route stop.`

and

`Import successful — 2 workbook jobs at 1 route stop.`

The stale-inbox confirmation also states workbook-job and route-stop counts.

No JSON schema/version/field meaning changes are introduced.

## Producer contract expected from workbook companion

After the workbook companion is deployed:

- router export contains only checked, eligible OPEN assignments;
- successful send consumes/clears those Print selections so they do not silently
  remain selected for the next route;
- failed write leaves selection intact;
- duplicate selected addresses remain one `addresses[]` entry;
- every distinct selected Source_ID remains in `orderIds`;
- explicit resend is performed by re-checking the desired OPEN job.

FMR must remain compatible both before and after that workbook producer change.

## Focused test requirements

FMR focused tests must prove:

1. two Order IDs at one inbox address count as two workbook jobs and one route stop;
2. address-only legacy inbox entry counts as one workbook job and one route stop;
3. duplicate physical inbox addresses remain one route stop with merged distinct
   Order IDs;
4. pending snapshot count is derived from its own `orderIdsByStopId`, not from
   another route slot;
5. New Route Available wording states workbook jobs and route stops separately;
6. import status wording states workbook jobs and route stops separately;
7. stale-inbox confirmation uses the corrected vocabulary;
8. `stageWorkbookRoute()` still replaces pending state rather than merging prior
   pending Order IDs;
9. `startPendingRoute()` still preserves exact Order IDs in Google and Basic;
10. no saved stop receives permanent Order ID identity.

Run one complete FMR suite on the final runtime head before requesting merge.

## Cross-System Reality Gate

Actual path:

`Workbook Print selection -> Free Map Router Address Inbox.json -> FMR Drive reader -> parseAddressInbox/applyAddressInbox -> pending route snapshot -> Start New Route -> Google/Basic route`

A controlled cross-system validation must inspect the actual Address Inbox artifact
and confirm a selected same-address two-work-order fixture arrives as:

- one physical `addresses[]` entry;
- two exact Order IDs;
- one pending route stop;
- two displayed workbook jobs.

Because the workbook Sandbox may share the live FMR handoff folder/file, any such
write must be treated as touching a shared integration resource and requires the
governed controlled procedure rather than an assumed isolated Sandbox.

## Rollback

FMR rollback source is exact `main` base:
`6c7095b13f9ad221f88044681443b062c584e8d6`.

The companion changes only count/wording logic; no persisted route migration is
required for rollback.

## Authorization boundary

The operator authorized proceeding with selectable-sync cleanup while workbook
Phase 2 R6 soaks. This authorizes implementation/testing on isolated branches.
Under the Level 3 change contract, merge/publication remains a later explicit
operator approval after final tests and cross-system reality evidence are ready.
