# Google Route Optimization Testing and Rollback Contract

## Purpose

This contract defines the minimum proof required before an optional Google
road-aware optimizer may be merged, published, or relied upon in field work.

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
- current Garmin GPX behavior;
- Cloud project, region, and disabled or test-only backend state.

Do not use an outdated local branch as the production baseline.

## Test ownership

Expected app areas include:

- route-ordering owner in `routing.js` or a narrowly named Google-routing module;
- request orchestration and route-state replacement in the owning app module;
- authenticated backend client;
- Google Maps and Garmin export compatibility tests;
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
- manual Up, Down, and Remove work afterward;
- free optimization still works before and after a Google failure;
- Google Maps sections use the visible order;
- Garmin GPX uses the visible order;
- Home is present at both ends of Garmin GPX;
- source labels remain GIS/DCFS only;
- MCS is not introduced;
- manual pins are not changed;
- no automatic request runs during import, restore, edit, Drive connection, or
  page load;
- over-limit requests are rejected before network access;
- authentication and provider errors are operator-visible;
- provider errors do not expose secrets or raw sensitive responses.

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
- Google order and provider road metric where permitted;
- Google Maps section count;
- Garmin point count and order;
- operator-observed backtracking;
- final field outcome when available.

The project should not claim better optimization solely because Google was used.
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

1. Small safe route
   - select several test stops;
   - optimize with Google;
   - verify complete visible order;
   - create Google Maps sections;
   - create Garmin GPX.

2. Large representative route
   - use a sanitized or approved 60–70 stop batch;
   - verify every stop exactly once;
   - verify no skipped jobs;
   - verify section continuity;
   - verify Garmin order in BaseCamp.

3. Failure route
   - disable or block backend access;
   - verify current route survives;
   - verify free optimizer remains available;
   - verify no invalid export is created.

## Final verification sequence

On the exact final implementation head:

1. Run focused app tests.
2. Run focused backend tests.
3. Run the complete app suite once.
4. Run JavaScript and backend syntax or build checks.
5. Run contract and secret-scanning gates.
6. Inspect every changed block.
7. Verify Cloud configuration against the security contract.
8. Perform affected smoke tests.
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
- Garmin order differs from the visible app order;
- current route is lost after provider failure;
- credentials are exposed;
- unauthorized use occurs;
- billing or quota use is materially unexpected;
- app startup, import, or restore begins making automatic provider calls;
- the free optimizer becomes unavailable;
- the live app becomes unusable.

## Rollback procedure

1. Disable Google optimization in the app or restore the recorded app commit.
2. Route all users to the existing free optimizer.
3. Disable backend traffic or set provider quota to zero.
4. Preserve current browser route data and saved addresses.
5. Do not modify the workbook or router inbox.
6. Review sanitized logs and billing usage.
7. Revoke affected credentials when security is involved.
8. Repair only on a dedicated branch.
9. Repeat the required verification before re-enablement.

The rollback must not require deleting saved jobs, changing Home, rewriting
`Job_Log`, replacing Drive inboxes, or abandoning Garmin.

## Completion standard

The feature is not complete until:

- automated tests pass on the final head;
- safe live API validation passes;
- real-route comparison shows practical value;
- account ownership and billing recovery are verified;
- quotas and alerts are active;
- explicit operator approval is recorded;
- published app and backend smoke checks pass;
- Garmin receives the complete route in the app's visible order.