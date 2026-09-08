# Phase 2I-A — Pure Route Plan / Day Contract Change Record

**Date:** 2026-09-08  
**Status:** IMPLEMENTED — FOCUSED TESTED — READY FOR PR VERIFICATION  
**Repository:** `timbone72-CC/free-map-router`  
**Branch:** `feat/phase-2i-a-route-plan-model`  
**Governed base:** `d5c02f9fbaf357e23a2370ec522c301679bf3a32`  
**Parent design:** `docs/PHASE_2I_MULTI_DAY_ROUTE_PLAN_IMPLEMENTATION_RECORD_2026-09-08.md`  
**Risk:** Level 2 dormant/read-only implementation support inside the Level 3 Phase 2I parent.

## Purpose

Prove the Route Plan → Day → Route domain model before any Phase 2I storage migration can touch live user data.

This slice intentionally does **not** wire multi-day behavior into the app. It adds a pure model and focused tests only.

## Files

Added only:

- `route-plan.js`
- `tests/phase-2i-route-plan.test.js`
- `docs/PHASE_2I_A_ROUTE_PLAN_MODEL_CHANGE_RECORD_2026-09-08.md`

No existing runtime file is modified.

## Live-runtime boundary

`route-plan.js` is **not loaded by `index.html`** in Phase 2I-A.

It performs no:

- localStorage/sessionStorage access;
- DOM rendering or event registration;
- network request;
- Google call;
- Drive read/write;
- workbook read/write;
- backup read/write;
- polling, timer, or observer work.

Therefore Phase 2I-A does not migrate route-history v6, does not create backup v5, and does not change the current one-day planner.

## Model introduced

The pure contract defines Route Plan schema version 1 with:

- stable `planId`;
- plan revision and `updatedAt`;
- exact active `dayId`;
- exact work pool entries `{ kind, workItemId, stopId }`;
- standalone route-only stop membership for physical stops with no workbook Order ID or manual `Gig_ID`;
- ordered Day records.

Each Day contains:

- stable `dayId`;
- revision and `updatedAt`;
- normalized Workday context or `null`;
- one Google route snapshot;
- one Basic route snapshot.

Google schedule state may exist only on the Google Day snapshot. Basic normalization discards schedule confidence.

## Exact identity rules

- Workbook work identity remains exact `workbook + Order ID / Source_ID`.
- Manual work identity remains exact `gig + Gig_ID`.
- Address text is not work identity.
- Physical `stopId` remains separate from exact work identity.
- The same exact work identity attached to different physical stops fails closed.
- Duplicate exact work identity inside a plan fails closed.
- A Day may not contain exact work outside the plan pool.
- The same exact work item may not appear on more than one Day.
- In this initial contract, the same physical route stop may not appear on more than one Day.

The last rule protects the first-version same-property/same-day boundary. A future intentional exception would require separate governed design.

## Standalone app-only stops

A route stop with no workbook Order ID and no manual `Gig_ID` is retained as standalone plan membership rather than receiving an invented work identity.

Because no existing exact work planning record owns such a stop, its optional local assigned date and locked-day state may be plan-owned.

A stop cannot be both work-backed and standalone.

## One-day legacy migration model

`migrateOneDayRouteHistory()` accepts normalized current one-day route-history input and derives one Route Plan Day without writing it anywhere.

It preserves independently:

- Google route order;
- Basic route order;
- optimizer status;
- workbook Order IDs;
- workbook expected-pay metadata;
- manual `Gig_ID`s;
- gig-managed stop metadata;
- current Workday context when present;
- valid Google schedule on Google only.

It deliberately does not consume or copy the pending workbook route into the active plan model.

If no Workday context exists, migration keeps it `null` rather than inventing route timing.

Plan/day migration IDs are deterministic for the same normalized legacy input. A legacy route with no usable source timestamp receives only a deterministic migration metadata timestamp at the Unix epoch; this is not presented as route/work timing and prevents repeated pure migration from inventing changing `updatedAt` values.

## Planning ownership boundary

The model reads existing planning records only to derive exact work assigned to a local calendar date.

It does not persist a second copy of exact work-item `assignedDate` or `lockedDay` state.

Helpers expose:

- `planWorkItemsForDate()`;
- `unassignedPlanWorkItems()`;
- `standaloneStopsForDate()`.

This preserves the parent design rule that existing work-item planning owns exact-work day assignment.

## Validation boundaries

The pure contract validates:

- required IDs;
- schema version;
- positive revisions;
- timestamps;
- real local calendar dates;
- local `HH:MM` values;
- IANA timezone names;
- route stop uniqueness;
- workbook/manual ID uniqueness per stop;
- workbook expected-pay structure;
- exact Google schedule visit order;
- whole-second schedule timestamps;
- nonnegative schedule durations;
- active Day existence;
- cross-Day work/stop integrity.

The existing route-history/Workday runtime remains responsible for the stricter live persistence and DST/nonexistent-local-time behavior when Phase 2I-B eventually wires this model into storage.

## Focused verification

Local focused verification completed before publication:

- `node --check route-plan.js` — passed.
- `node --test tests/phase-2i-route-plan.test.js` — **14 passed / 0 failed**.

Focused coverage includes:

1. pure/dormant runtime boundary;
2. differing Google/Basic legacy orders;
3. shared-stop exact workbook + gig identity;
4. conflicting exact identity failure;
5. app-only standalone stop retention;
6. null Workday + deterministic migration identity;
7. no input mutation;
8. duplicate/out-of-pool work rejection;
9. no cross-Day identity/stop duplication;
10. existing planning `assignedDate` ownership and explicit unassigned work;
11. standalone stop date ownership;
12. Basic schedule-null boundary;
13. invalid standalone calendar-date rejection;
14. damaged Google schedule order rejection.

The final repository suite and root JavaScript syntax gate must pass on the exact PR head before merge.

## Protected behavior unchanged

Phase 2I-A does not change:

- current route-history version 6 or storage key;
- backup version 4 or restore compatibility;
- current Google/Basic/pending route behavior;
- Start New Route;
- Build Route page or responsive planner;
- Workday controls;
- optimizer behavior or Google request/response contracts;
- Start Navigation / Done & Navigate Next;
- workbook inbox or route-order return;
- saved addresses/pins;
- manual gigs or Manual Work Library;
- Drive permissions/files;
- five-page navigation.

## Rollback

Known-good pre-2I-A base:

`d5c02f9fbaf357e23a2370ec522c301679bf3a32`

Because the new module is dormant and no existing runtime file is touched, rollback is simply to revert/abandon the three-file 2I-A change. No data recovery or migration reversal is required.

## Next boundary

After Phase 2I-A is merged, the next slice is **Phase 2I-B — Route-History v7 Persistence + Backup v5**.

That slice will change durable route/backup state and is **Level 3**. It must not merge without the required explicit operator pre-merge approval after its exact diff, migration tests, full suite, rollback, and recovery evidence are available.
