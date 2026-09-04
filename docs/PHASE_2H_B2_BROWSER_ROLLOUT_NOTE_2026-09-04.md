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

## Owning surfaces finalized before code

Inspection of the live runtime showed that `app.js` already exposes the selected Google stops through the frozen `FMRRouteBridge` and remains the sole route-order/render owner. Rewriting the entire large `app.js` only to add B2 metadata methods would increase risk without changing the approved behavior.

B2 therefore uses the existing Google browser layer plus the existing route-history v6 storage record:

- `app.js` remains unchanged and continues to own route order, route rendering, and application of the validated Google order;
- `google-route-browser.js` owns the B2 request enrichment, local-time resolution, Phase 2G projection read, schedule basis calculation, result/error messaging, Preferred Finish evaluation, and schedule persistence/invalidation checks;
- the persisted schedule is written only into the existing `google.schedule` field of the route-history v6 JSON record; there is no new storage key and no second route-order state;
- `backup.js` preserves/restores that persisted Google schedule when its route IDs match the governed Google route being backed up/restored;
- route/order mutations performed through existing `app.js` route writes continue to replace the route-history snapshot and therefore clear old schedule confidence; service/Home/timing changes that do not rewrite route order are detected by deterministic basis mismatch before schedule confidence is used;
- Basic Route never receives a Google schedule.

This is the smallest implementation that satisfies the approved 2H-B acceptance criteria while preserving existing module ownership. It is recorded before runtime code changes.

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
