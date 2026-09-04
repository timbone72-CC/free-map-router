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

The parent implementation record proposed a separate browser adapter that would enrich the app-owned bridge. Inspection of the live runtime confirmed two important ownership facts:

1. `app.js` already exposes the current Google selection through the frozen `FMRRouteBridge` and remains the route-order/render owner.
2. route-history v6 in `localStorage` is already the governed durable route-history store used by the Phase 2H-A timing controls and backup parser.

Rewriting the entire large `app.js` solely to add B2 bridge methods would increase the blast radius without changing the approved product behavior. B2 therefore uses a narrow pre-Google browser module that reads the existing bridge snapshot and writes schedule data only through the governed route-history contract.

The ownership is:

- `app.js` remains unchanged and continues to own route order, route rendering, and application of the validated Google order;
- `route-history.js` owns schedule normalization and the durable Google-snapshot `schedule` field;
- `phase-2h-b-browser.js` reads the existing bridge snapshot, Phase 2G planning projection, Phase 2H-A day context, computes schedule basis, persists/validates Google schedule through `route-history.js`, and never owns route order;
- `google-route-browser.js` owns request invocation, error/result messaging, and calls the narrow B2 helper before/after the existing bridge apply;
- `backup.js` preserves a current persisted Google schedule when its route IDs match the app-owned route snapshot being backed up, so the durable schedule is not lost merely because `app.js` does not render/own schedule state in Phase 2H-B;
- `workday-context.js` may expose a pure local-date/time-to-instant helper for the saved IANA time zone.

There is no second route-order store. The B2 helper writes only the `schedule` field of the existing governed Google route snapshot. Route order remains owned by `app.js`.

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
