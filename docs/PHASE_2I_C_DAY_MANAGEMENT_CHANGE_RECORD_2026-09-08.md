# Phase 2I-C — Day Management and Local Day Assignment Change Record

Date: 2026-09-08  
Repository: `timbone72-CC/free-map-router`  
Branch: `feat/phase-2i-c-multi-day-planning`  
Governed base: `849e88484a2b22fda9753a3a1e4f53a528618195`  
Parent design: `docs/PHASE_2I_MULTI_DAY_ROUTE_PLAN_IMPLEMENTATION_RECORD_2026-09-08.md`  
Change level: **Level 3** — operator-triggered bulk Route Plan / planning assignment replacement  
Status: IMPLEMENTATION IN PROGRESS — MERGE REQUIRES EXPLICIT LEVEL-3 APPROVAL

## Purpose

Implement Phase 2I-C on top of the deployed and smoke-validated Route Plan v7 / backup v5 foundation.

This slice adds day management and local day assignment to the existing Build Route planner while preserving the one-day path and all current Google/Basic route actions.

## Authorized behavior

2I-C adds only:

- a bounded multi-day Route Plan control on Build Route;
- a Day selector with one active Day visible at a time;
- consecutive per-Day Workday contexts derived from the current saved/default Workday;
- operator-requested automatic Day-count suggestion;
- deterministic local Day assignment using only governed local facts;
- manual move of a physical stop's exact work between Days;
- manual lock/unlock through existing work-item `assignedDate` / `lockedDay` planning metadata;
- selected-Day Google and Basic route candidates without automatic Google optimization.

## Exact local assignment rules

The automatic splitter is intentionally conservative and network-free.

1. Exact work is grouped by physical `stopId`; same-address exact work is never automatically split across Days.
2. Existing locked assignments win. Conflicting locks fail visibly and are not rewritten.
3. A locked date outside the requested Day range remains intact and visible for manual review.
4. Manual gigs with unknown service duration are never counted as zero. If such a stop already has a valid Day assignment it is preserved; otherwise it remains visibly unassigned.
5. Workbook work uses the existing governed service resolver: explicit override when present, otherwise the existing ordinary workbook default unless a separately verified interior resolver is supplied.
6. Actual manual-gig due dates may prioritize work. No workbook due date is invented because the governed workbook inbox still does not provide one.
7. Saved display coordinates are used only for deterministic local geography ordering. Missing coordinates do not remove work.
8. Day-count suggestion is a **minimum based on known service time** and the active Workday target. Unknown service is reported separately and is not hidden inside the estimate.
9. Automatic assignment never calls Google. Every generated Day starts as an unoptimized Google/Basic candidate with no Google schedule confidence.
10. Overflow, unknown-duration work, lock conflicts, and outside-plan locked work remain visible for operator adjustment instead of disappearing.

## Active-plan replacement

**Build / Replace Plan** requires an explicit operator confirmation whenever an active plan exists.

Replacement may change only the active Route Plan's Day identity, Day assignments, and per-Day Google/Basic candidate routes plus existing work-item planning assignment fields.

It does not delete or modify:

- saved addresses;
- saved pins;
- manual gig records or `Gig_ID`s;
- Manual Work Library records;
- permanent address corrections;
- workbook history or prediction history;
- the pending newer workbook route;
- Google account/auth state;
- Drive files or permissions.

If the operator cancels the confirmation, the current plan remains unchanged.

## Owning files

### Runtime

- `route-plan-days.js` — pure deterministic day-count, grouping, assignment, move, lock, and plan-rebuild logic; no DOM/storage/network/Drive.
- `route-plan-controls.js` — bounded Build Route control adapter; owns only the new multi-day controls and commits the already-governed v7 Route Plan / planning fields.
- `index.html` — adds the bounded controls and loads the two new first-party modules before `app.js`.

### Tests / governance

- `tests/phase-2i-c-day-management.test.js`
- this change record
- narrow current-state corrections / Phase 2I-C protection in `CONTRACT.md` and `REGRESSION_CHECKLIST.md`

No `app.js`, `route-history.js`, `backup.js`, Google backend, Drive owner, workbook handoff owner, or CSS ownership change is required.

## Read surfaces

- route-history v7 active plan and pending route;
- saved stops / display coordinates;
- manual gigs and real manual-gig due dates;
- work-item planning records;
- current/default Workday context.

## Write surfaces

Only:

- route-history v7 `activePlan` through the existing `writeRouteHistory` owner;
- existing work-item planning `assignedDate` / `lockedDay` through revision-preserving planning records.

The adapter re-reads both durable surfaces before commit. If the Route Plan or planning records changed since the action was prepared, it fails stale. If planning persistence succeeds but the Route Plan write unexpectedly fails, the adapter restores the pre-action planning snapshot.

## Explicit non-scope

2I-C does **not** add:

- active-plan completion identity / Done & Navigate Next completion filtering (2I-D);
- Replan Remaining or known-road behavior (2K);
- day-aware workbook return/print (2J);
- automatic mid-plan placement of newly arrived workbook work;
- automatic Google optimization or repeated Google calls;
- a sixth page;
- a second mobile planner or alternate durable route state;
- new storage/backup schema versions;
- new Drive files, OAuth scopes, providers, APIs, timers, polling loops, or MutationObservers.

## Risk and rollback

Primary risks:

- silently losing or duplicating exact work across Days;
- separating same-address work across Days;
- overwriting a newer planning revision;
- treating unknown manual service duration as zero;
- retaining stale optimizer/schedule confidence after a split;
- replacing the wrong active plan.

Rollback before merge is branch/PR abandonment. `main` remains at `849e88484a2b22fda9753a3a1e4f53a528618195`.

If live validation fails after an approved merge, restore that pre-2I-C main commit before adding more changes to the broken surface. Because 2I-C uses the already-governed v7/v5 schemas, rollback does not require a schema downgrade; preserve a current v5 backup before any emergency restoration if the operator has already created real multi-day assignments.

## Required verification before merge

Focused coverage must prove:

- consecutive local Day contexts;
- deterministic assignment;
- same-address grouping;
- locked-Day preservation and lock conflicts;
- unknown manual duration never becoming zero;
- actual manual due-date prioritization without invented workbook due dates;
- no silent work loss;
- manual move/lock behavior;
- active Day switching;
- per-Day route candidate generation with schedules cleared;
- pending workbook route preservation;
- backup v5 round trip of a real multi-day plan;
- five-page UI and script order;
- no Google/network call path in automatic splitting.

The exact final PR head must pass the complete repository suite and first-party root JavaScript syntax gate.

Because this slice performs operator-triggered bulk replacement of active-plan route membership and assignment metadata, explicit Level-3 pre-merge approval is required after exact-head verification.
