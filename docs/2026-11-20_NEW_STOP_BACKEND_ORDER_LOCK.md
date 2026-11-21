# FMR — Optimize New Stop Only: Backend Order-Lock Boundary

**Date:** 2026-11-20
**Status:** Stage 1 implementation prepared for review; no public control, live Google call, Cloud Run deployment, or merger authorized.
**Change level:** 3 (Google Route Optimization API behavior, backend contract).
**Baseline / rollback:** `main` at `4432fe8b893b7b3fd1821df8757aaf0d271e835f` (live Cloud Run `fmr-route-optimizer-00083-lhj` verified healthy).
**Original design:** draft PR #142, `docs/2026-11-13_OPTIMIZE_NEW_STOP_ONLY_PLAN.md`.

## Intent and proof

Existing route A → B → C → D and one new saved stop N must be optimized only to choose N's position; all original stops must remain A → B → C → D, including their exact stable stop IDs and all attached work identities. No new address may create a duplicate physical stop. Google may change road travel estimates and, when timed, its schedule, not the existing stop order.

This first bounded part implements only the backend capability and validation. **There is no user-facing Add/Optimize New Stop Only control yet**; the app cannot invoke the new mode until a separate UI and staleness-safe application change is built and verified.

## Exact scope

- `google-route-contract.js`: optional `insertion: {newStopId}` request field; existing stops must be in their original order and the one new stop must be last in the request. Response validates that all original IDs remain an unchanged subsequence after removing exactly one new ID. Invalid, duplicate, missing, moved, or invented IDs reject before app persistence.
- `google-route-provider.js`: only insertion requests receive Google ShipmentModel `precedenceRules` locking each consecutive pair of *existing* deliveries. The new shipment is not constrained, allowing Google to choose an insertion point. Invalid provider reorder is returned as `INSERTION_ORDER_CHANGED` (502) without applying a route.
- `google-route-server.js`: carry the validated insertion descriptor through address geocoding. Existing authentication, server request handling and full-route behavior remain unchanged.
- `tests/google-route-insertion-backend.test.js`: legacy request isolation; insert at beginning/middle/end; larger route fixture (40 existing); malformed IDs; partial/skipped result; precedence properties; geocoded and manually pinned stops.

**Reads:** original ordered stop IDs, service durations, addresses/manual coordinates, Home, optional workday timing; existing authenticated optimizer API.
**Writes:** none locally. Once released and explicitly used by a later UI, it can call the existing paid Google optimization service but must never mutate a route directly.

## Safety, limits, and deployment

- Mode is opt-in; the absence of `insertion` yields the exact existing full optimizer request and output behavior.
- At least one original route stop plus exactly one appended new stop; existing 100-stop maximum applies.
- Google documents that precedence constraints can reject larger requests. Failure must be surfaced, not retried as unrestricted optimization.
- No storage, backup, Route Plan Day, browser UI, route snapshot, workbook, Drive, permission, billing enablement, authentication, Cloud Run environment, or normal optimization behavior changes in this stage.
- No workbook/router integration impact.
- Tests simulate Google output; they do not prove live solver performance. A real call and an end-to-end route-application check must be separately approved and verified before releasing the completed feature.
- Cloud deployment is now operational: PR #152, build `634d8c29-cd0f-4ad4-9398-fd6f336838e9`, healthy live Cloud Run revision `00083-lhj`. This work must not assume new mode has already been deployed.
- The existing Cloud Build automation runs on merge to `main`, so even an opt-in backend change requires explicit pre-merge authorization.

## Verification and completion criteria

1. Focused `node --test tests/google-route-insertion-backend.test.js` passes, including 40-stop example.
2. Exact-final-head complete `npm test` and first-party JS `node --check` pass in CI; inspect narrow diffs.
3. Do not merge or deploy Stage 1 without operator approval. Stage 1 is **not** a shippable end-user feature.
4. Follow-up UI stage must select one **existing saved** address not already on current Google Day, build a non-mutating candidate, validate current Home/Day/timing/stop IDs and work identity after the request, and atomically save only the active Day's Google route and correct schedule on a validated result. Do not modify Basic, other Days, pending inbox, or workbook handoff.
5. For future failure: leave current routes and schedules unchanged; if live deployment affects legacy behavior, use main baseline `4432fe8b...` for governed rollback.

**Pre-merge approval status:** Pending. User authorized starting work; not yet authorized this Level-3 merge.
