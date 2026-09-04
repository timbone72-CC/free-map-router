# Phase 2H-B1 — Backend-First Rollout Note

Date: 2026-09-04  
Parent design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Parent implementation record: `docs/PHASE_2H_B_TIME_AWARE_GOOGLE_IMPLEMENTATION_RECORD_2026-09-04.md`  
Status: IMPLEMENTED — AUTOMATED VERIFICATION PASSED — AWAITING OPERATOR PRE-MERGE APPROVAL

## Why 2H-B is being published in two substeps

The governed Phase 2H design requires the additive-compatible `/optimize` backend to be live before the browser begins sending the new timing/service fields.

Repository deployment evidence shows:

- GitHub Pages publishes the browser app independently from `main`;
- the connected Cloud Build trigger also deploys the Cloud Run backend from a new `main` commit;
- therefore a single commit containing both backend and browser behavior would create an uncontrolled publication race and would not prove backend-first compatibility.

To honor the already-approved rollout rule, Phase 2H-B is implemented as two deployment-safe substeps without changing product scope:

1. **2H-B1 — additive backend compatibility**
   - `google-route-contract.js`
   - `google-route-provider.js`
   - `google-route-server.js`
   - focused backend tests
   - no browser caller change

2. **2H-B2 — browser use and schedule persistence**
   - begins only after the B1 Cloud Run revision is confirmed healthy/compatible;
   - sends the governed timing/service fields;
   - persists/invalidates the accepted Google schedule;
   - performs the operator-facing workday warnings/conflicts already defined by the parent design.

## B1 compatibility promise

After B1 deploys:

- the existing live browser request shape remains valid;
- legacy requests without `timing` and `serviceDurationSeconds` retain the old 24-hour traffic-window behavior;
- the backend is additionally capable of validating and executing the new time-aware request shape;
- no current browser route, route-history schema, backup schema, workbook handoff, Drive permission, or user-facing control changes as part of B1.

## B1 implemented behavior

- optional `serviceDurationSeconds` is validated as a nonnegative whole number and survives address-to-coordinate resolution;
- optional `timing.departureTime` / `timing.homeByTime` is validated as whole-second RFC3339, normalized to an instant, and requires Home By later than Departure;
- timed requests require an explicit service duration for every selected physical stop;
- Google visit duration receives the exact per-stop service seconds;
- Google model global start/end use Departure/Home By;
- the vehicle start window pins Departure exactly and the end window is bounded by Home By;
- Preferred Finish is not sent as a Google hard constraint;
- the existing traffic-aware `costPerTraveledHour` objective and 30s/60s timeout boundary remain unchanged;
- timed responses retain vehicle start/end, visit start times, travel/service/wait totals;
- skipped work returns `HOME_BY_CONFLICT` instead of a partial successful route;
- `hasTrafficInfeasibilities` is rejected rather than presented as Home-By-safe;
- a Google visit-service total that disagrees with the requested service total is rejected;
- incomplete or inconsistent timed schedule data fails closed;
- legacy browser requests remain accepted without timing/service fields.

## Verification

Final B1 runtime/test head:

`58c5d32990559a214313600cb14f90073aecd141`

GitHub Actions:

- workflow: **Verify Contract and App**
- run: **#244** (`33889679161`)
- result: **PASS**

The final focused fixture coverage includes:

- legacy request compatibility;
- timed whole-second request validation;
- geocoding preservation of timing/service data;
- Google visit duration and vehicle/global time-window mapping;
- 32-stop `30s` / 33-stop `60s` boundary;
- complete schedule extraction;
- skipped-work Home By conflict;
- traffic infeasibility rejection;
- provider/request service-total disagreement rejection;
- damaged schedule service-total rejection.

No billed Route Optimization call was made by automated tests.

The only commit after the verified runtime/test head is this documentation-only status update. Under `TESTING_CONTRACT.md`, it does not invalidate the verified runtime result.

## Diff boundary

B1 changes only:

- this rollout note;
- the parent 2H-B implementation record;
- `google-route-contract.js`;
- `google-route-provider.js`;
- `google-route-server.js`;
- `tests/phase-2h-b-backend.test.js`.

It does not change `google-route-browser.js`, `route-history.js`, backup runtime, `index.html`, `app.js`, workbook handoff code, Drive code/permissions, dependency/workflow files, or Phase 2H-C UI.

## B1 merge/deploy gate

B1 remains Level 3 because it changes the live backend API behavior. Automated verification and diff review are complete. Remaining gates are:

1. explicit operator pre-merge approval;
2. merge B1 only;
3. automatic Cloud Run deployment from the merged `main` commit;
4. live `/health` verification plus legacy-browser compatibility evidence;
5. only after that evidence exists may 2H-B2 browser publication proceed.

If B1 fails deployment or compatibility validation, 2H-B2 does not start publishing. The prior live Cloud Run revision remains the rollback target.

No workbook/router integration impact.
