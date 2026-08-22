# Symmetric Route Work Clear Impact Record — 2026-08-22

## Status

IMPLEMENTATION AUTHORIZED / PRE-MERGE APPROVAL STILL REQUIRED

## Change level

Level 3 — route-state deletion/bulk replacement.

This correction adds two explicit destructive route-work controls. It does not delete saved physical addresses, manual gig records, workbook history, prediction data, backups, or Drive files, but a defect could broadly remove the wrong route membership. Use the higher change level.

## Authorization

The operator identified the live Phase 1A workflow gap: an address can represent both InspectorADE/ADE work and manual gig work, so protecting the physical address alone does not allow one work source to be removed while preserving the other.

The operator approved symmetric behavior on 2026-08-22:

- **Clear InspectorADE Jobs** removes workbook/ADE work from both usable route versions while preserving manual-gig work and shared physical stops.
- **Clear Manual Gig Work** removes manual-gig route work from both usable route versions while preserving saved gig records, ADE work, and shared physical stops.

## Baseline and rollback

- Implementation branch: `work/symmetric-route-work-clear-20260822`
- Branch base / rollback runtime: `727a109f69b7df4fff95afd7606c98dc593573c0`
- Baseline complete-suite result: 234 tests, 234 pass, 0 fail on the Phase 1A merge lineage.
- Existing Phase 1A manual-gig storage and backup schema remain unchanged.

If live validation fails after publication, restore the changed runtime files to `727a109f69b7df4fff95afd7606c98dc593573c0` and preserve current local browser/backup data for diagnosis.

## Exact user-facing problem

A single physical stop can legitimately carry both:

- workbook/ADE `orderIdsByStopId`; and
- manual-gig `gigIdsByStopId`.

The current address-delete safeguard correctly prevents orphaning a gig, but there is no source-specific route-work clear action. The operator therefore cannot remove ADE work and retain a gig route at the same property, or remove gig route work and retain ADE work, without manually rebuilding route membership.

## Approved behavior

### Clear InspectorADE Jobs

For both **Google Route** and **Basic Route**:

1. remove workbook `orderIdsByStopId` metadata;
2. remove a physical route stop only when that stop carried workbook Order IDs and has no manual-gig route IDs remaining;
3. keep a shared stop when manual-gig route IDs remain;
4. keep unrelated app-only/manual selected stops that never carried workbook Order IDs;
5. keep all saved addresses, pins, corrections, manual gig records, Home, settings, backups, and the pending workbook route unchanged;
6. invalidate an optimized label only when the visible route membership actually changes.

### Clear Manual Gig Work

For both **Google Route** and **Basic Route**:

1. remove manual `gigIdsByStopId` route metadata and `gigManagedStopIds` route-management metadata;
2. keep every manual gig record and its `routeIncluded` planning value unchanged;
3. remove a physical route stop only when it was added solely by gig inclusion and carries no workbook Order IDs;
4. keep a shared stop when workbook Order IDs remain;
5. keep a pre-existing/manual selected stop that was not added solely by gig inclusion;
6. keep saved addresses, pins, corrections, Home, settings, backups, and the pending workbook route unchanged;
7. invalidate an optimized label only when visible route membership actually changes.

These controls clear route work, not durable work records. A later **Start New Route** may reapply `routeIncluded=true` gigs under the already-approved Phase 1A behavior.

## Required and optional data

Required route snapshot data already exists:

- `routeIds`
- `orderIdsByStopId`
- `gigIdsByStopId`
- `gigManagedStopIds`

No new persisted field is required. No schema migration is required.

## Schema, permissions, limits, and stale behavior

- No storage schema version change.
- No backup version change.
- No Google Drive/API permission change.
- No backend or Cloud Run change.
- No routing algorithm change.
- No workbook JSON format change.
- No workbook runtime change.
- No change to the existing route-size limits.
- Pending workbook route remains untouched by both controls because the approved scope is the two usable route versions only.

## Owning files

- `route-history.js` — source-specific route-work clearing helpers and preservation rules.
- `app.js` — confirmation, state persistence, status messaging, and re-render of Build Route/Addresses.
- `index.html` — two explicit Build Route controls.
- `CONTRACT.md` — protect the approved symmetric behavior.
- `REGRESSION_CHECKLIST.md` — add source-specific clear checks.
- focused tests — prove shared-stop preservation, source isolation, pending-route preservation, and no durable-data deletion.

## Read surfaces

- Google Route snapshot
- Basic Route snapshot
- pending route only to prove it remains unchanged
- saved physical stops for normal route filtering/rendering
- manual gigs only as durable records that must remain untouched

## Write surfaces

- Google Route snapshot
- Basic Route snapshot

No physical-stop write, gig-record write, workbook write, Drive write, Home write, or prediction/history write is authorized.

## Workbook/router integration impact

The app intentionally clears workbook Order IDs from the two usable local route snapshots when the operator chooses **Clear InspectorADE Jobs**. The forward inbox and return JSON formats do not change. The pending workbook route is not modified. The existing return writer continues to send only real Order IDs still present in the displayed selected route.

The upstream workbook repository requires no runtime change because no field name, file name, version, matching rule, or receiver behavior changes.

## Protected behavior

Must remain unchanged:

- one normalized physical address -> one saved stop;
- immutable manual `Gig_ID` identity;
- manual gig records and `routeIncluded` values;
- corrected-address aliases, GIS/DCFS source, and strongest-pin protection;
- Home and five-page navigation;
- Basic and Google optimization algorithms;
- route slot independence;
- pending workbook route and Start New Route workflow;
- navigation, Google Maps, Garmin, and route-order return contracts;
- manual Drive access model and `drive.file` permission;
- InspectorADE workbook history and prediction/history isolation.

## Primary risks and mitigations

1. **Shared stop deleted from route when the other source still needs it.**
   - Mitigation: clear metadata by source first; preserve stop when opposite-source IDs remain.
2. **Unrelated manually selected/app-only stop removed by ADE clear.**
   - Mitigation: ADE clear removes only stops that actually carried workbook Order IDs.
3. **Pre-existing stop removed by gig clear.**
   - Mitigation: only `gigManagedStopIds` are eligible for gig-only route removal.
4. **Durable gig record or address deleted.**
   - Mitigation: helpers accept route history only and app handlers do not call gig/address deletion or write helpers.
5. **Pending workbook route silently discarded.**
   - Mitigation: helpers copy pending unchanged; focused fixture asserts exact preservation.
6. **Workbook handoff format changed.**
   - Mitigation: no inbox or route-order module modification.

## Realistic fixtures

Focused fixtures must cover:

1. ADE-only stop, gig-only stop, shared ADE+gig stop, and unrelated app-only stop in one route;
2. clear ADE leaves gig-only/shared/app-only and removes ADE-only;
3. clear gigs leaves ADE-only/shared/app-only and removes only gig-managed gig-only;
4. a shared stop keeps exactly one physical route entry;
5. Google and Basic are both updated;
6. pending route remains byte-for-byte equivalent after normalization;
7. optimized status becomes `manually_changed` only when visible membership changes, otherwise remains stable;
8. saved gig collection, physical stops, and workbook return format are not written or altered by the control path.

## Test and validation plan

During implementation run only focused tests for the new route-history helpers and Build Route control wiring.

Before merge, the exact final runtime head must pass:

- focused route-work-clear tests;
- complete `npm test` once through CI;
- first-party JavaScript syntax checks once through CI;
- contract gates;
- affected live Build Route smoke checks after publication.

Baseline full-suite count: **234**. Final count will be recorded from CI on the exact PR head.

## Live smoke plan

After publication, use a safe temporary/shared stop that has ADE and manual gig work and verify:

- Clear InspectorADE Jobs leaves gig route membership in both Google and Basic;
- re-establish test state, then Clear Manual Gig Work leaves ADE route membership in both Google and Basic;
- shared physical address and gig record remain saved;
- pending workbook route, if present, is unchanged;
- no duplicate physical stop is created.

## Explicit authorization gates

- Implementation is authorized by the operator's `approved` response on 2026-08-22.
- Because this is classified Level 3, explicit pre-merge operator approval is still required after implementation and final CI pass.
