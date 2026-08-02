# Google Road Optimization — Level 3 Impact Record

## Status

Implementation branch only. Not merged, published, enabled, or connected to a
Google Cloud project.

## Operator goal

Make Free Map Router produce a correct road-aware stop order for one complete
selected GIS/DCFS batch. Navigation devices, Garmin, BaseCamp, GPX destination
accuracy, cloud address-memory migration, standalone file import, Obsidian, and
workbook runtime changes are outside this implementation.

## Production baseline

- Repository: `timbone72-CC/free-map-router`
- Base branch: `main`
- Base commit: `ec4e4ddafeeb8bc476de4eecb49cc20bb346631b`
- Implementation branch: `feature/google-road-optimization`
- Existing optimizer: nearest-neighbor plus 2-opt using straight-line distance
- Existing Home, saved-address, route-selection, Google Maps, and fallback
  behavior remain protected

## Change classification

Level 3 because this project will add:

- a private authenticated backend;
- Google Route Optimization API access;
- billing and quota exposure;
- a second route-ordering method;
- replacement of active route order after external-provider validation.

Explicit operator approval is required before merge.

## First implementation slice

This first slice may add only pure, credential-free contract code:

- construct the minimal backend request from Home and selected stop IDs and
  coordinates;
- reject invalid coordinates, duplicate IDs, empty routes, and over-limit
  routes before network access;
- translate the validated request into one Google `OptimizeToursRequest` model;
- interpret one-vehicle Google results;
- reject skipped, missing, duplicate, unknown, or extra stops;
- apply a validated order without mutating saved stop records.

It does not make network requests, enable billing, create Cloud resources, alter
HTML, change the live app, or store credentials.

## Data allowed to leave the browser in the future runtime stage

- opaque request ID;
- opaque stable stop ID;
- Home latitude and longitude;
- selected-stop latitude and longitude.

The first version must not send address text, notes, customer names, source
labels, workbook history, Gmail content, Drive contents, or payment data.

## Protected behavior

- Home remains start and finish.
- One complete selected batch is optimized together for one vehicle.
- Every selected stop must return exactly once.
- A failed or invalid response leaves route state unchanged.
- The existing free optimizer remains available.
- Optimization never rewrites Home, saved addresses, notes, source labels,
  coordinates, manual pins, workbook data, or browser backups.
- No automatic optimization occurs on load, import, edit, restore, or Drive
  connection.
- No secret is stored in source control or public browser code.

## Planned files for the first slice

- `google-route-contract.js`
- `google-route-provider.js`
- `tests/google-route-contract.test.js`
- `tests/google-route-provider.test.js`

## Test gates

Before the first slice is accepted:

- focused contract tests pass;
- focused provider-translation tests pass;
- complete existing app suite passes once;
- all first-party JavaScript syntax checks pass;
- no network or billed API call occurs in automated tests;
- no credential or project ID is committed.

Later runtime slices require separate tests for authentication, quotas, request
serialization, failure preservation, real 15–25, 40–50, and 60–70 stop batches,
and comparison with the current straight-line order.

## Rollback

Before merge, the exact last-known-good main commit and backend revision must be
recorded. Disabling Google optimization must leave the existing free optimizer
and current saved data usable.

For this credential-free first slice, rollback is deletion or reversion of the
new files on the implementation branch.

## Integration boundary

No workbook/router integration impact. The workbook inbox schema, exported
address text, GIS/DCFS source values, order meaning, duplicate handling, and
import preservation remain unchanged.
