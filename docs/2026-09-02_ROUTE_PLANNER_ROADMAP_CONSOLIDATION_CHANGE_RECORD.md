# Route Planner Roadmap Consolidation Change Record

**Date:** 2026-09-02  
**Change class:** Level 1 — documentation only  
**Baseline:** `c85aa86d8fc7575349eb8e5179babe0cf526d3be`  
**Evidence audit:** `docs/2026-09-02_ROUTE_PLANNER_PRODUCT_AUDIT.md`

## Purpose

Consolidate the operator-approved route-planner decisions from the 2026-09-02 product audit and follow-up discussion into the single durable roadmap without changing runtime behavior.

## Changed surfaces

- `docs/FIELD_WORK_EXPANSION_PLAN.md`
- this change record

## Accepted roadmap direction

- prepare the permanent modern-planner structure early, but defer professional visual polish until the route behavior has survived real work;
- keep one master roadmap while visually separating Route Planner Core from Field Operations;
- keep exact work-item identity separate from physical-stop identity;
- normal InspectorADE planning default remains 5 minutes and verified interior job/work codes should eventually trigger a 20-minute default automatically; unverified codes must not be guessed;
- default preferred field-work finish is 3:00 PM and is adjustable; default home-by is 5:00 PM and is adjustable, with home-by the stronger planning bound;
- retain useful Google schedule/ETA information for truthful day summaries and stop cards;
- completed work leaves the remaining route but only lightweight completion identity/status is retained while the active Route Plan exists; detailed completed-route history is not retained indefinitely;
- when the operator starts creating a different Route Plan while one is active, FMR should ask whether to delete/replace the existing plan; cancelling preserves the existing plan;
- add an explicit future `Replan Remaining From Here` concept without requiring continuous background GPS tracking;
- known-road/construction avoidance remains a standard capability, but the strongest enforcement method will be chosen only after a controlled real-world Google routing test during that phase;
- remove generic High/Medium/Low planning priority from the first route-planner release; due date, day assignment/locking, service time, and manual movement remain the grounded controls;
- exact handling of new work that arrives during a multi-day plan remains intentionally unresolved; it must never silently alter the plan, and an Unplanned/New Work staging area is only a candidate until that phase is designed;
- prepare Route Plan data for future true cross-device synchronization through stable IDs, revision/stale-write boundaries, and no permanent device-master assumption, while deferring any Firestore/central-database implementation to a separate later design.

## Protected behavior

No runtime code, route storage, workbook handoff, Google API behavior, Drive file, OAuth permission, workbook data, deployment configuration, or current five-page app navigation changes in this documentation update.

No permanent detailed route archive, continuous fleet/GPS tracking, automatic background replanning, new top-level page, or live synchronization service is authorized by this record.

## Verification

Documentation-only diff and contract review plus repository CI. No runtime smoke test is required for this Level 1 record.

No workbook/router integration impact.