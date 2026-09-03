# Phase 2G — Work-Item Planning Foundation Impact Record

**Date:** 2026-09-03  
**Status:** APPROVED TO START / DESIGN AND IMPACT BOUNDARY RECORDED / NO RUNTIME CHANGE YET  
**Change class:** Level 3 — stored planning data / future cross-system planning metadata  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `work/phase-2g-work-item-planning-20260903`  
**Baseline / rollback source:** `7fc6d1a26aec36abf39500b4f34e7449ddfe2c4c`  
**Roadmap authority:** `docs/FIELD_WORK_EXPANSION_PLAN.md` — Phase 2G

## Purpose

Begin Phase 2G by defining the smallest durable work-item planning model needed for realistic route timing and later day planning without changing physical-stop identity, InspectorADE prediction identity, or manual-gig identity.

This record is the Level-3 impact boundary required before runtime implementation. It intentionally makes no runtime, storage, Drive, workbook, deployment, or API change by itself.

## Governance reviewed

Before this record was created, the following current `main` sources were reviewed:

- `AGENTS.md`
- `CONTRACT.md`
- `CHANGE_CONTROL_CONTRACT.md`
- `TESTING_CONTRACT.md`
- `INTEGRATION_CONTRACT.md`
- relevant `REGRESSION_CHECKLIST.md` sections
- `docs/FIELD_WORK_EXPANSION_PLAN.md`
- `docs/2026-09-02_ROUTE_PLANNER_PRODUCT_AUDIT.md`
- current `contract.js`
- current `gig-contract.js`
- current `inbox.js`
- current `route-history.js`

## Existing verified architecture

The current runtime already separates three identities that Phase 2G must not collapse:

1. **Physical stop identity** — one saved stop per normalized physical address.
2. **InspectorADE work identity** — exact workbook Order IDs retained in route snapshots as `orderIdsByStopId`.
3. **Manual work identity** — immutable manual `Gig_ID` values retained separately and attached to a physical stop by `stopId`.

The current workbook inbox is address-oriented. It can carry several exact Order IDs on one physical stop, but it does not currently carry per-Order-ID service duration, assigned day, locked-day state, or verified interior-work classification.

Manual gig schema version 2 already carries exact `Gig_ID`, `dueDate`, `completedDate`, and `updatedAt`. Those fields must not be replaced by an address-level planning field.

## Approved Phase 2G behavior

Phase 2G follows the roadmap rules exactly:

- service duration belongs to the exact work item, never merely to the address;
- ordinary InspectorADE work uses a **5-minute planning default** unless an exact work-item override or later verified interior mapping applies;
- verified interior inspection work uses a **20-minute planning default**;
- no InspectorADE job/work code may be guessed or hard-coded as interior until the mapping is verified against real work;
- unknown or unverified InspectorADE codes remain on the normal five-minute default unless manually overridden;
- one physical stop containing multiple work items remains one driving stop and its service time is the sum of those exact work items;
- due date, assigned day, and locked-day information belong to the exact work item;
- generic High/Medium/Low priority is excluded from this phase;
- route/calendar dates remain local `YYYY-MM-DD` values and must not shift through UTC conversion;
- planning state must have a stale-write/revision boundary that does not assume one browser is permanently authoritative.

Example required aggregate:

- Order A at a property: 5 minutes
- Order B at the same property: 20 minutes
- physical driving stops: 1
- service time at that stop: 25 minutes

## Proposed ownership model

### New FMR-owned work-item planning store

Phase 2G should add one dedicated planning module/store rather than extending the physical stop record.

Working module boundary:

- runtime module: `work-item-planning.js`
- storage key: `fmr_work_item_planning_v1`
- planning schema version: `1`

The exact filename/key may change only if implementation evidence shows an existing owned module is a better fit; physical-stop storage must not absorb the work-item fields.

### Work-item identity

Every planning record must use structured exact identity:

- InspectorADE assignment: `kind = "workbook"` + exact nonblank workbook Order ID / `Source_ID` carried by the governed inbox/route snapshot;
- manual gig: `kind = "gig"` + exact immutable `Gig_ID`.

Address, stop ID, source label, vendor name, work-order display text, and route position are not substitutes for work-item identity.

A physical `stopId` may be retained as current route context for lookup/display, but changing or merging a physical stop must not create a new work identity.

### Minimum planning record

The first runtime model should contain only planning facts Phase 2G needs:

- `schemaVersion`
- `kind` (`workbook` or `gig`)
- exact `workItemId`
- optional explicit `serviceMinutes` override
- optional local `assignedDate` (`YYYY-MM-DD`)
- `lockedDay` boolean
- monotonic `revision`
- `updatedAt` timestamp

`dueDate` is a work-item fact but should not be redundantly copied when an authoritative current work-item source already owns it. Manual gigs already own `dueDate`. Workbook due-date ingestion requires a separately governed backward-compatible per-Order-ID handoff extension if/when the workbook supplies it.

The planning store must not contain:

- address as identity;
- duplicated permanent stop/pin/correction data;
- workbook prediction/history data;
- generic High/Medium/Low priority;
- route geometry;
- a permanent completed-route archive;
- guessed interior classification.

## Service-duration resolution

The runtime resolver should distinguish a **stored override** from a **default**.

For an InspectorADE Order ID:

1. use its explicit valid `serviceMinutes` override when present;
2. otherwise use 20 minutes only when a later verified exact work-code mapping positively identifies that work item as interior;
3. otherwise use 5 minutes.

For a manual `Gig_ID`:

1. use its explicit valid `serviceMinutes` override when present;
2. otherwise use the phase-approved manual default only after such a default is separately established;
3. until then, the implementation must not invent an HNP/OTHER duration rule merely to match InspectorADE.

This prevents default values from becoming irreversible stored facts and leaves room for later verified mappings without rewriting every record.

## Physical-stop aggregation

A route stop's service duration is derived, never owned by the address.

For each physical stop in a route snapshot:

1. collect the exact workbook Order IDs attached to that stop;
2. collect the exact routed manual Gig IDs attached to that stop;
3. resolve service duration for each exact work item independently;
4. sum the results for that one physical stop.

The aggregate must not merge, discard, or rewrite the underlying IDs.

## Workbook / integration impact

The first Phase 2G app-side planning-store slice does **not** require changing `Free Map Router Address Inbox.json`.

Current inbox compatibility is preserved:

- existing inbox version remains valid;
- existing address/source/orderIds/expected-pay meaning remains unchanged;
- current workbook does not become owner of FMR assigned-day/locked-day state;
- no new Drive file or permission is introduced merely for the local planning foundation.

A later Phase 2G slice may require a backward-compatible workbook companion only if real InspectorADE fields such as per-Order-ID due date or verified work code must cross the inbox boundary. That change must pass the Cross-System Reality Gate before merge/deployment.

## Phase 2F dependency boundary

Workbook Phase 2F selectable-sync runtime currently remains isolated from this FMR branch.

Phase 2G development may proceed against exact route-snapshot work identities already supported by FMR. Phase 2G must not be used to bypass, reimplement, or silently compensate for unfinished Phase 2F producer behavior.

Before Phase 2G production rollout depends on the selected workbook work pool, the Phase 2F Cross-System Reality Gate must have evidence that FMR receives the exact intended Order-ID set with no extras or omissions.

## Saved-data and migration impact

The preferred first runtime slice adds a new independent planning store instead of migrating the physical-stop schema or manual-gig schema.

Expected compatibility behavior:

- existing users with no planning store read as an empty planning collection;
- no existing stop, Home, route snapshot, Order ID, Gig_ID, gig due/completed date, address correction, Manual Work Library record, or setting is rewritten merely because Phase 2G loads;
- defaults are resolved at read/use time rather than bulk-written into every existing work item;
- invalid planning records fail closed or are quarantined according to the implementation contract; they must not damage valid stops, gigs, or route snapshots.

Because planning state becomes durable user data, backup/restore coverage must be reviewed before runtime merge. If Phase 2G planning records are included in the whole-app backup, the backup version and backward compatibility must be updated explicitly and tested. If the first runtime slice intentionally keeps planning state outside backup, that limitation must be visible and approved before merge.

## Permission / API / cost impact

For the first app-side planning-store slice:

- no new OAuth scope;
- no new Drive filename;
- no new Google API;
- no background service;
- no polling;
- no paid feature;
- no Google Route Optimization request change yet.

Google visit/service-duration request changes belong to Phase 2H after Phase 2G produces trustworthy work-item duration data.

## Failure and rollback

Rollback source is the exact branch base:

`7fc6d1a26aec36abf39500b4f34e7449ddfe2c4c`

The runtime implementation must be structured so reverting Phase 2G code leaves the existing stop, gig, route, inbox, Drive, and workbook data readable by the pre-2G app.

A damaged or unsupported planning store must not make the existing route data disappear. Phase 2G planning data is additive and must fail separately from the protected route identities.

No production deployment is part of this impact-record commit.

## Focused verification required for runtime implementation

At minimum, focused automated coverage must prove:

1. a workbook Order ID receives a 5-minute default without writing that default as address data;
2. an explicit work-item duration override wins over the default;
3. no interior 20-minute default is applied from an unverified/unknown code;
4. two Order IDs on one stop remain distinct and aggregate service time correctly;
5. a workbook Order ID and a manual Gig_ID on one stop remain distinct and aggregate without merging identity;
6. planning records survive normalization/write/read with exact identity unchanged;
7. local calendar assigned dates do not shift through timezone conversion;
8. stale/revision handling refuses an older conflicting update rather than silently overwriting newer planning state;
9. physical-stop correction/remap does not change the exact work-item identity;
10. existing route history, Order IDs, Gig_IDs, gigs, and saved stops remain valid when no planning record exists.

If backup/restore changes in the same runtime slice, focused backward-compatibility tests must also prove older backups restore with an empty planning collection and newer backups preserve planning records.

## Final runtime gate

Before a Phase 2G runtime branch may be called merge-ready:

- focused Phase 2G tests pass;
- one complete repository test suite passes on the exact final runtime head;
- all first-party root JavaScript files pass syntax checks;
- affected saved-data / manual-gig / Build Route regression checks pass;
- any cross-system field change completes the Integration Contract reality gate;
- the exact diff is reviewed for unrelated behavior;
- explicit Level-3 operator approval is obtained before merge.

No merge or production deployment is authorized by this record alone.

## Explicitly deferred from this first Phase 2G slice

- guessing or hard-coding InspectorADE interior job codes;
- changing the workbook Address Inbox schema;
- Google Route Optimization service-duration requests;
- route date/departure/home-by controls;
- multi-day Route Plans;
- map/list planner redesign;
- generic priority;
- road restrictions;
- photo/media workflow;
- live cross-device synchronization provider selection.

Those remain governed by the later roadmap phases or by a separately approved companion slice.
