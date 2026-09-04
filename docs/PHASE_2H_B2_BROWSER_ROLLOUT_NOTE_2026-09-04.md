# Phase 2H-B2 — Browser Rollout Note

Date: 2026-09-04  
Parent design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Parent implementation record: `docs/PHASE_2H_B_TIME_AWARE_GOOGLE_IMPLEMENTATION_RECORD_2026-09-04.md`

## B1 deployment gate — satisfied

The operator verified the merged B1 backend commit `b95dc4138fd87a10acc35799c9a15be97fff20e1` is the exact Cloud Run image serving `fmr-route-optimizer`:

- ready revision: `fmr-route-optimizer-00054-kc7`;
- image: `us-central1-docker.pkg.dev/free-map-router/cloud-run-source-deploy/fmr-route-optimizer:b95dc4138fd87a10acc35799c9a15be97fff20e1`;
- live `/health`: `{"ok":true,"service":"fmr-route-optimizer"}`.

GitHub `main` verification for that merge also passed in Verify Contract and App run #246.

The backend-first rollout prerequisite is therefore satisfied before the browser begins sending timing/service fields.

## B2 scope

B2 implements only the remaining approved Phase 2H-B browser/runtime behavior:

- derive exact physical-stop service duration from the existing Phase 2G route planning projection;
- block the time-aware request before the network call when routed manual work has unknown duration;
- resolve the saved Phase 2H-A route date, Departure, and Home By into whole-second RFC3339 instants in the saved IANA time zone;
- send `serviceDurationSeconds` and `timing` through the already-live additive `/optimize` backend;
- accept/persist only a complete validated Google schedule;
- store schedule only on the Google route snapshot;
- invalidate stored schedule confidence when its deterministic route/timing/service/Home basis changes;
- report Preferred Finish as a soft overrun and Home By as a hard conflict;
- keep Basic Route free of Google schedule confidence.

No Phase 2H-C Map/List planner work is included.

## Ownership correction before code

The parent implementation record proposed a separate browser adapter to enrich the app-owned bridge. Inspection of the live runtime showed that whole-app backup is created from `app.js`'s in-memory `routeHistory`. Persisting the accepted schedule only through a side adapter/localStorage would create a second shadow route state and could omit the schedule from backup.

Therefore B2 uses the existing app-owned `FMRRouteBridge` as the narrow route-state owner:

- `app.js` exposes only the extra copies/context needed by the Google caller and persists the accepted Google schedule through the governed route-history contract;
- `route-history.js` owns schedule normalization, basis validation, and invalidation on route/work membership mutations;
- `google-route-browser.js` owns request construction, result/error messaging, and Preferred Finish evaluation;
- `workday-context.js` may expose a pure local-date/time-to-instant helper for the saved IANA time zone;
- no independent B2 route store is created.

This is an ownership correction inside the already-approved 2H-B acceptance criteria, not new product scope. It is recorded before runtime code changes.

## Protected boundaries

- no workbook/router handoff change;
- no Drive file/folder/OAuth permission change;
- no route-history version bump beyond existing v6;
- no backup version bump beyond existing v4;
- no Basic optimizer change;
- no new Google endpoint;
- no automatic Home By relaxation;
- no multi-day behavior;
- no planner map/list redesign.

## Verification / merge gate

B2 remains Level 3 because it changes live Google routing behavior and persisted route schedule state.

Required before merge:

- focused request/projection/timezone/schedule persistence/staleness/conflict tests;
- final complete repository CI on the exact runtime head;
- diff review;
- explicit operator pre-merge approval;
- post-merge live browser validation using one representative authenticated Google route.

Rollback baseline for B2 is the deployed B1 merge commit `b95dc4138fd87a10acc35799c9a15be97fff20e1`.

No workbook/router integration impact.
