# Phase 2H-B1 — Backend-First Rollout Note

Date: 2026-09-04  
Parent design: `docs/PHASE_2H_TIME_AWARE_SINGLE_DAY_ROUTING_IMPACT_RECORD_2026-09-04.md`  
Parent implementation record: `docs/PHASE_2H_B_TIME_AWARE_GOOGLE_IMPLEMENTATION_RECORD_2026-09-04.md`

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

## B1 merge/deploy gate

B1 remains Level 3 because it changes the live backend API behavior. It requires:

- focused backend coverage;
- one final complete repository CI run on the exact B1 runtime head;
- diff review;
- explicit operator pre-merge approval;
- automatic Cloud Run deployment from the merged `main` commit;
- live `/health` verification plus compatibility evidence before 2H-B2 browser publication.

If B1 fails deployment or compatibility validation, 2H-B2 does not start publishing. The prior live Cloud Run revision remains the rollback target.

No workbook/router integration impact.
