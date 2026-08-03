# Google Distance Quality — Level 3 Impact Record

## Status and approval

- Status: implementation on `agent/fewest-road-miles`.
- Operator approval: the operator approved making fewest road miles the primary
  Google optimization goal and specifically required the change to remain
  within the project contracts.
- Explicit Level 3 pre-merge approval: recorded by that approval for this exact
  scope. No additional scope is authorized.
- Baseline and rollback commit: `694504c`.

## Problem and evidence

The Google optimizer already models one complete round trip from Home and
rejects incomplete results, but its vehicle cost is
`costPerTraveledHour`. That asks Google to prefer shorter driving time rather
than fewer road miles. The request also omits `searchMode`, so Google treats it
as `RETURN_FAST` and stops after finding the first good solution.

The map alone cannot prove that Google spent the available solve time improving
the route. The provider request is the reproducible evidence for both current
settings.

## Approved behavior and scope

- Make road distance the only Google vehicle cost by using
  `costPerKilometer`.
- Set `searchMode` to `CONSUME_ALL_AVAILABLE_TIME` so Google uses the existing
  30-second request window to search for improvements.
- Keep the existing 30-second timeout.
- Keep the existing total road miles and estimated driving-time result display.

Owning files and functions:

- `google-route-provider.js`: `buildGoogleOptimizeToursRequest` owns the Google
  solver request and its cost objective.
- `tests/google-route-provider.test.js`: protects the distance-only cost and
  full-time search request while preserving the round trip.

No UI, storage, import, address resolution, authentication, navigation, map
splitting, Drive, workbook, Garmin, or deployment configuration is changed.

No workbook/router integration impact.

## Read and write surfaces

Reads:

- the existing coordinate-ready Home and complete selected-stop request.

Writes:

- the active route order only after the existing complete-response validation
  succeeds.

The change writes no Home, saved address, pin, note, source, backup, Drive,
workbook, browser-storage, credential, or cloud configuration data.

## Required and optional data

Required data remains unchanged:

- one verified Home coordinate pair;
- one opaque ID and one Google-resolved coordinate pair for every selected
  stop; and
- the existing request ID.

No optional field, appointment window, service duration, new setting, new
permission, or schema field is added.

## Schema, permission, billing, and hard limits

- No schema or migration change.
- No API, OAuth, service-account, Drive, or browser permission change.
- No new Google request is added. Each operator action still makes the existing
  geocoding requests and one Route Optimization request.
- The existing maximum of 100 selected stops remains unchanged.
- The existing 30-second solver timeout remains unchanged.
- Existing Google Cloud billing and alert controls remain unchanged.

## Protected behavior

- Home remains the unnumbered round-trip start and finish.
- Every selected stop must return exactly once; skipped, missing, duplicate,
  unknown, added, or stale output remains rejected as a whole.
- Ordinary written addresses continue to use request-only Google geocoding.
- Manually corrected pins continue to bypass automatic geocoding and remain
  protected.
- Google results do not rewrite saved pins, addresses, labels, notes, Home, or
  workbook data.
- The free optimizer remains available as the fallback.
- Existing numbered Google Maps sections preserve the accepted optimized order
  without gaps.
- Authentication, origin checks, map navigation, and **Done & Navigate Next**
  remain unchanged.

## Primary risks and stale-output behavior

Primary risks:

- an incorrect provider field could leave the old time objective active;
- removing the time cost without adding the distance cost could create an
  invalid or unpriced model;
- the full-time search mode could exceed the intended wait if the timeout were
  accidentally changed; or
- unrelated response handling could weaken complete-route validation.

The focused test requires the new distance cost, forbids the old traveled-time
cost, requires the full-time search mode, and preserves the existing 30-second
request and Home round trip. Existing contract tests continue to reject stale
or incomplete responses without applying any route change.

## Focused tests and safe fixture

Focused command:

```bash
node --test tests/google-route-provider.test.js
```

The fixture models one Home and three selected jobs. Provider responses are
mocked; the test makes no billed Google request and writes no app data.

Final runtime gate on the final branch head:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Affected safe checks:

1. Inspect the exact provider JSON to confirm distance-only cost, full-time
   search, one vehicle, and matching Home start/end.
2. Confirm existing complete-response fixtures retain every selected stop once.
3. After publication and backend deployment, run one representative selected
   batch and confirm Home, job count, no skipped jobs, total miles, and driving
   time.

## Recovery and rollback

If focused or final checks fail, stop before publication and retain live commit
`694504c`.

If the deployed backend fails its live check:

1. stop using Google Optimize and use the retained free optimizer;
2. route Cloud Run traffic back to the prior verified revision;
3. revert this change through a dedicated pull request to restore commit
   `694504c` behavior;
4. confirm Home, the selected-job count, and the prior route remain intact; and
5. do not continue changing the broken optimization surface until rollback is
   verified.

No stored-data recovery or migration is required because this change does not
write stored data.
