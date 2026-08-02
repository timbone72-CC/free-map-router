# Google Road Optimization — Level 3 Impact Record

## Status

Deployed and live.

The implementation entered `main` in commit `35a6bb0`. At the start of this
corrective documentation work, the live `main` head was `2a7ab9d`.

This record was originally written for a credential-free first slice and was
not updated before the complete runtime system was published. The historical
control failure and the decision to retain the verified working system are
recorded in
`docs/2026-08-02_CHANGE_CONTROL_VIOLATION_REPORT.md`.

## Operator goal

Make Free Map Router produce a road-aware stop order for one complete selected
GIS/DCFS batch while keeping the existing free optimizer available.

## Production baseline and implementation

- Repository: `timbone72-CC/free-map-router`
- Historical pre-implementation baseline: `ec4e4dd`
- Implementation branch: `feature/google-road-optimization`
- First live implementation commit: `35a6bb0`
- Provider: Google Route Optimization through a private Cloud Run backend
- Browser access: Google sign-in with backend verification of the allowed
  company account
- Route model: one vehicle, one complete selected batch, returning to Home
- Existing free optimizer: retained as a separate fallback
- Hard app-owned limit: 100 selected stops
- Automatic execution: none; the operator starts Google optimization explicitly

## Change classification

Level 3 because the deployed system added:

- a private authenticated backend;
- Google Route Optimization API access;
- Google Cloud billing and quota exposure;
- a second route-ordering method;
- replacement of the active route order after complete external-response
  validation;
- production publishing and cloud deployment.

## Approval and process status

The required explicit Level 3 pre-merge approval was not recorded. PR #16
remained a draft and its description said not to merge, but the branch reached
`main` through a local fast-forward and direct push.

Later live validation and continued-use approval confirm that the operator wants
the working feature retained. They do not retroactively satisfy the missing
pre-merge approval requirement.

Current operator decision: preserve the validated working system, correct the
record, and avoid rebuilding working behavior solely to repeat implementation.

## Runtime components

- `google-route-auth.js` verifies allowed Google identity claims.
- `google-route-browser.js` sends the selected request and applies only a
  complete validated order.
- `google-route-contract.js` owns request and response validation.
- `google-route-provider.js` translates between the app contract and Google
  Route Optimization.
- `google-route-server.js` owns the private HTTP service, origin checks,
  authentication, request validation, and provider invocation.
- `app.js` owns application route state and exposes the narrow route-application
  bridge.
- `index.html` owns the Google sign-in and optimization controls.
- `package.json` and `package-lock.json` include the backend runtime and
  Google authentication dependency.
- Dedicated tests cover authentication, browser requests, contracts, provider
  translation, server behavior, and UI ownership.

## Required and optional data

Required for a Google optimization request:

- opaque request ID;
- opaque stable stop ID for each selected stop;
- verified Home latitude and longitude;
- latitude and longitude for every selected stop.

Not sent to the optimization backend or provider:

- address text;
- notes;
- customer or company names;
- GIS/DCFS labels;
- workbook history;
- Gmail or Drive contents;
- payment data;
- Geoapify key.

No route-optimization credential is stored in public browser code or committed
to the repository.

## Schema and permission impact

- No saved-address, Home, workbook-inbox, backup, or browser-storage schema was
  migrated.
- The browser gained Google identity sign-in for the protected optimization
  request.
- The private Cloud Run runtime gained permission to call Google Route
  Optimization.
- The Google Cloud project has billing and quota exposure for route calls.
- Google Drive permissions and the workbook handoff schema were unchanged.

No workbook/router integration impact.

## Hard limits and validation

Before provider access, the backend rejects:

- a missing or invalid Home coordinate pair;
- a selected stop without a complete valid coordinate pair;
- duplicate selected stop IDs;
- an empty route;
- more than 100 selected stops;
- malformed, oversized, non-JSON, wrong-method, wrong-origin, or unauthenticated
  requests.

A provider response is rejected unless it:

- belongs to the active request;
- contains exactly one vehicle route;
- contains every selected stop exactly once;
- contains no missing, duplicate, skipped, unknown, or added stop;
- preserves Home as the round-trip anchor.

A rejected request or response leaves the current route unchanged.

## Protected behavior

- Home remains start and finish.
- Home is not counted as a job stop.
- Every selected stop must return exactly once.
- The free optimizer remains available.
- Google optimization never rewrites Home, saved addresses, notes, source
  labels, coordinates, manual pins, workbook data, or backups.
- No automatic Google optimization occurs on load, import, edit, restore, or
  Drive connection.
- Google Maps export continues to use the complete active route order.
- A failed sign-in, backend request, provider call, or response validation leaves
  route state unchanged.

## Stale and failed output behavior

Each browser request carries an opaque request ID. A response that does not
match the active request is rejected. Missing, partial, duplicate, skipped, or
unknown stop output is rejected as a whole; partial route application is not
allowed.

If authentication expires or the backend rejects the account, the app reports
failure and retains the prior route order.

## Validation evidence

Automated verification on the published runtime head before release:

- complete suite: 117 passed, 0 failed;
- JavaScript syntax checks passed;
- contract coverage included request limits, duplicate rejection, complete
  response preservation, authentication, CORS, server validation, provider
  translation, and UI ownership;
- automated tests made no billed Route Optimization request.

Completed live checks:

- authenticated company sign-in;
- two-stop Google optimization;
- five-stop Google optimization;
- every selected stop preserved exactly once;
- Home retained as start and finish;
- Google Maps output preserved the optimized order;
- app mileage and duration were consistent with the opened Google Maps route.

Residual validation gap:

- the originally planned representative live 15–25, 40–50, and 60–70 stop
  comparisons were not recorded before publication.

This gap is documented. It does not authorize an unreviewed runtime change.

## Cloud and billing controls

Recorded during implementation:

- Google Cloud project: `free-map-router`;
- private Cloud Run service;
- dedicated runtime service account;
- Route Optimization permission limited to the runtime service;
- approved GitHub Pages origin;
- monthly gross-usage alert configured at $5.

The alert is not a hard spending cap. Any quota or billing-policy change remains
a separate Level 3 change.

## Recovery and rollback

Historical last-known-good baseline before Google optimization:
`ec4e4dd`.

Do not rewrite `main` history or force-reset production to that commit. That
would also discard later verified work.

If Google optimization fails while the rest of the app remains usable:

1. stop using the Google optimizer and use the retained free optimizer;
2. preserve current browser data and Drive backups;
3. create a dedicated Level 3 rollback branch and PR;
4. remove or disable only the Google browser control and adapter invocation;
5. verify Home, saved addresses, route selection, the free optimizer, and Google
   Maps output;
6. merge only with explicit operator approval;
7. disable or remove backend access only after the browser no longer calls it.

If a backend revision fails but the browser contract remains compatible, restore
the last verified backend revision and confirm the protected live request before
any further backend change.

## Current correction classification

The 2026-08-02 update to this record is Level 1 documentation only. It changes
no runtime code, tests, workflow, dependency, cloud resource, permission, route,
saved address, or workbook data.
