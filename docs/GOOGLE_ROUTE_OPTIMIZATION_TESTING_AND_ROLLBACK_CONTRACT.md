# Google Route Optimization Testing and Rollback Contract

## Current controlling scope

The current implementation is optimization only. Read
`docs/CURRENT_OPTIMIZATION_ONLY_SCOPE.md` first.

Garmin, BaseCamp, GPX destination testing, phone navigation, car navigation,
cloud address-memory migration, standalone file import, Excel support, Obsidian,
and reporting are not part of this implementation or its acceptance gate.

Where older planning text conflicts, the optimization-only scope controls.

## Purpose

This contract defines the minimum proof required before Google road-aware
optimization may be merged, published, or relied upon for route ordering.

It supplements `TESTING_CONTRACT.md`, `REGRESSION_CHECKLIST.md`, and
`CHANGE_CONTROL_CONTRACT.md`.

## Risk classification

Runtime implementation is Level 3 because it changes route ordering and adds a
private external service, authentication, API permissions, billing, and failure
paths.

Documentation-only planning remains Level 1.

## Baseline requirement

Before runtime work begins, record:

- stable app branch and commit;
- stable workbook branch and commit;
- current complete app test count and result;
- current JavaScript syntax-check result;
- current published app version;
- existing free optimizer result for all approved fixtures;
- Cloud project, region, and disabled or test-only backend state.

Do not use an outdated local branch as the production baseline.

## Test ownership

Expected app areas include:

- route-ordering owner in `routing.js` or a narrowly named Google-routing module;
- request orchestration and route-state replacement in the owning app module;
- authenticated backend client;
- complete-order display tests;
- backend validation and provider adapter tests;
- contract and forbidden-pattern gates.

The workbook receives no runtime change unless the inbox contract changes.

No workbook/router integration impact is planned.

## Required fixed fixtures

The final suite must include deterministic fixtures for:

1. Home plus 3 jobs.
2. Home plus 15 jobs.
3. Home plus 25 jobs.
4. Home plus 50 jobs.
5. Home plus 70 jobs.
6. Home plus the app-owned maximum of 100 jobs.
7. Duplicate coordinates with distinct stop IDs.
8. Manual-pin stops mixed with ordinary geocoded stops.
9. GIS and DCFS stops mixed in one route.
10. Rural-style clusters separated by long road distances.
11. A bridge, river, restricted-area, or disconnected-looking geometry fixture.
12. A response containing one skipped job.
13. A response containing a missing job ID.
14. A response containing a duplicate job ID.
15. A response containing an unknown extra ID.
16. An over-limit request.

Provider responses used in automated tests must be sanitized and stored as test
fixtures only when permitted. Tests must not call the billed live API by
default.

## Core behavioral tests

Tests must prove:

- Google optimization is manual only;
- one click creates at most one active request;
- the full selected batch is submitted together;
- one vehicle is used;
- Home is start and finish;
- all selected jobs return exactly once;
- an invalid response leaves `routeIds` and saved data unchanged;
- a valid response replaces only route order;
- the full order is visible inside the app;
- route method, road distance, and estimated time are shown when available;
- manual Up, Down, and Remove work afterward;
- free optimization still works before and after a Google failure;
- source labels remain GIS/DCFS only;
- MCS is not introduced;
- manual pins are not changed;
- no automatic request runs during import, restore, edit, Drive connection, or
  page load;
- over-limit requests are rejected before network access;
- authentication and provider errors are operator-visible;
- provider errors do not expose secrets or raw sensitive responses.

No Garmin, BaseCamp, GPX, phone, or vehicle-navigation test is required.

## Backend validation tests

The private backend must have automated tests for:

- missing authentication;
- expired or invalid identity token;
- unapproved operator;
- wrong token audience or issuer;
- malformed JSON;
- unsupported fields;
- invalid coordinates;
- missing Home;
- zero jobs;
- more than 100 jobs;
- duplicate request IDs where replay protection is used;
- provider timeout;
- provider quota exhaustion;
- provider authentication failure;
- skipped shipments;
- incomplete ordered result;
- duplicate ordered result;
- unknown returned ID;
- bounded retry behavior;
- sanitized logs and errors;
- no route data in production logs.

## Security gates

Automated or review gates must fail when they find:

- service-account private keys;
- unrestricted API keys;
- OAuth client secrets intended for a confidential client;
- bearer tokens;
- credentials in HTML or JavaScript;
- credentials in tests or documentation examples;
- Gmail or Drive scopes added to the routing service without approval;
- anonymous backend invocation;
- CORS used as the sole authentication control;
- unbounded retry, polling, observer, timer, or request loops.

## Cost-control tests

Tests or safe-environment checks must prove:

- no request occurs without an explicit operator action;
- repeated clicks cannot create overlapping billed requests;
- automatic retry is bounded;
- stop-count limits are enforced before provider invocation;
- one request reports the same shipment count expected from the selected jobs;
- failed local validation consumes no provider request;
- quota errors leave the current route unchanged;
- usage metadata can be reconciled with operator actions without storing route
  addresses or coordinates.

## Comparison tests

The Google result is not required to match the free optimizer. It must be
compared against it.

For every real-route validation batch, record:

- selected count;
- returned count;
- missing, duplicate, skipped, and unknown counts;
- free-optimizer order and estimated straight-line length;
- Google order;
- provider road distance and estimated drive time where permitted;
- obvious backtracking found during map review;
- operator judgment of route practicality;
- request and shipment usage.

The project must not claim better optimization solely because Google was used.
Improvement must be measured on representative routes.

## Live API testing

Live billed API tests must be separate from the default automated suite.

Rules:

- use only fixed noncustomer test coordinates during early validation;
- run manually or in a protected environment;
- require authenticated approved accounts;
- use a restricted test quota;
- record request and shipment counts;
- never run on every commit;
- never run from an untrusted pull request;
- stop immediately on unexpected cost, quota, permission, or data behavior.

## Full-route smoke tests

Before merge, perform at least:

1. Small safe optimization
   - select several test stops;
   - optimize with Google;
   - verify every stop exactly once;
   - verify Home start and finish;
   - verify the complete order appears in the app.

2. Large representative optimization
   - use a sanitized or approved 60-70 stop batch;
   - verify every stop exactly once;
   - verify no skipped jobs;
   - review road distance, estimated time, and obvious backtracking;
   - compare with the current free optimizer.

3. Failure optimization
   - disable or block backend access;
   - verify current route survives;
   - verify free optimizer remains available;
   - verify no partial result replaces the route.

No navigation-device smoke test is required.

## Final verification sequence

On the exact final implementation head:

1. Run focused app tests.
2. Run focused backend tests.
3. Run the complete app suite once.
4. Run JavaScript and backend syntax or build checks.
5. Run contract and secret-scanning gates.
6. Inspect every changed block.
7. Verify Cloud configuration against the security contract.
8. Perform the optimization smoke tests.
9. Record rollback revisions.
10. Obtain explicit operator approval before merge.

A failed required check stops commit, push, merge, publication, or production
enablement until repaired.

## Rollback prerequisites

Before implementation deployment, record:

- last known-good app commit;
- last known-good published version;
- backend deployment revision;
- exact command or console action to disable backend traffic;
- exact action to disable Route Optimization API or reduce quota to zero;
- confirmation that the free optimizer requires no backend;
- confirmation that workbook inbox format remains unchanged.

## Runtime rollback triggers

Rollback or disable Google optimization immediately when:

- any selected job is missing or duplicated;
- an unknown job is inserted;
- a skipped job is accepted;
- Home is not preserved;
- current route is lost after provider failure;
- credentials are exposed;
- unauthorized use occurs;
- billing or quota use is materially unexpected;
- app startup, import, or restore begins making automatic provider calls;
- the free optimizer becomes unavailable;
- the live app becomes unusable.

## Rollback procedure

1. Disable Google optimization in the app or restore the recorded app commit.
2. Return to the existing free optimizer.
3. Disable backend traffic or set provider quota to zero.
4. Preserve current browser route data and saved addresses.
5. Do not modify the workbook or router inbox.
6. Review sanitized logs and billing usage.
7. Revoke affected credentials when security is involved.
8. Repair only on a dedicated branch.
9. Repeat the required verification before re-enablement.

The rollback must not require deleting saved jobs, changing Home, rewriting
`Job_Log`, or replacing Drive inboxes.

## Completion standard

The optimization feature is not complete until:

- automated tests pass on the final head;
- safe live API validation passes;
- representative 15-25, 40-50, and 60-70 stop batches complete;
- every selected stop appears exactly once;
- road-aware distance, estimated time, and backtracking are compared with the
  current optimizer;
- the app displays the complete route order;
- account ownership and billing recovery are verified;
- quotas and alerts are active;
- explicit operator approval is recorded;
- published app and backend optimization smoke checks pass.

Garmin and every other turn-by-turn navigation system are outside this
completion standard.
