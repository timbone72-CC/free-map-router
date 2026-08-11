# Time-Efficient Google Routing — Level 3 Impact Record

## Status and approval

- Status: implementation and verification complete on
  `agent/time-efficient-google-routing`; not published.
- Operator request: keep the existing route boundaries and optimize for the
  most time-efficient route rather than the fewest miles.
- Implementation authorization: recorded in the operator's request to proceed.
- Explicit Level 3 pre-merge approval: pending after final verification.
- Baseline and rollback commit: `54fba9c1`.

## Problem and evidence

Google Optimize currently sets `costPerKilometer: 1` and
`considerRoadTraffic: false`. The provider therefore prefers fewer road miles
and explicitly excludes traffic estimates, even when a somewhat longer route
would take less driving time.

The existing ordinary **Optimize Route** fallback uses verified coordinates and
straight-line distance. It has no road-duration or traffic data and cannot
honestly optimize estimated driving time.

## Approved behavior and scope

- Make estimated travel time the Google vehicle cost by using
  `costPerTraveledHour`.
- Enable Google's road-traffic estimates with `considerRoadTraffic: true`.
- Keep one vehicle, one complete selected batch, and Home as both start and
  finish.
- Keep the existing 30-second full-time search.
- Keep the ordinary coordinate optimizer unchanged as a separate fallback.

Owning files and functions:

- `google-route-provider.js`: `buildGoogleOptimizeToursRequest` owns the Google
  solver objective and traffic setting.
- `tests/google-route-provider.test.js`: protects the time objective, traffic
  setting, Home round trip, and absence of a distance cost.
- `CONTRACT.md`: records the approved Google Optimize objective.

No UI control, storage, import, address resolution, authentication, navigation,
map splitting, Drive, workbook, Garmin, or deployment configuration changes.

No workbook/router integration impact.

## Read and write surfaces

Reads:

- the existing coordinate-ready Home and complete selected-stop request;
- Google's road network and traffic estimates inside the existing provider
  request.

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

No appointment window, service duration, departure-time control, new setting,
new permission, or schema field is added.

## Schema, permission, billing, and hard limits

- No schema or migration change.
- No API, OAuth, service-account, Drive, or browser permission change.
- No new Google request is added. Each Google Optimize action still makes the
  existing geocoding requests and one Route Optimization request.
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
- The ordinary coordinate optimizer remains available as the fallback.
- Numbered Google Maps sections preserve the accepted optimized order without
  gaps and do not restart from Home between sections.
- Authentication, workbook updates, backups, map navigation, Start Navigation,
  and Done & Navigate Next remain unchanged.

## Primary risks and stale-output behavior

Primary risks:

- leaving the distance cost active would mix distance and time instead of using
  driving time as the sole objective;
- failing to enable traffic would optimize normal road speeds rather than the
  requested traffic-aware estimate;
- changing the Home endpoints could alter the existing round-trip boundary; or
- unrelated response handling could weaken complete-route validation.

The focused test requires the traveled-hour cost, forbids the kilometer cost,
requires traffic estimates, and preserves the 30-second search and identical
Home start/end points. Existing contract tests continue to reject stale or
incomplete responses without applying any route change.

## Focused tests and safe fixture

Focused command:

```bash
node --test tests/google-route-provider.test.js
```

The fixture models one Home and three selected jobs. Provider responses are
mocked; the test makes no billed Google request and writes no app data.

Focused result: 7 passed, 0 failed.

Final runtime gate on the final branch head:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Final result: 169 passed, 0 failed; every root JavaScript syntax check passed.

Affected safe checks:

1. Inspect the provider JSON for a traveled-hour-only cost, traffic enabled,
   one vehicle, and matching Home start/end.
2. Confirm complete-response fixtures retain every selected stop once.
3. After publication and backend deployment, run one representative selected
   batch and confirm Home, job count, no skipped jobs, total miles, and estimated
   driving time.

## Recovery and rollback

If focused or final checks fail, stop before publication and retain live commit
`54fba9c1`.

If the deployed backend fails its live check:

1. stop using Google Optimize and use the retained ordinary optimizer;
2. route Cloud Run traffic back to the prior verified revision;
3. revert this change through a dedicated pull request to restore commit
   `54fba9c1` behavior;
4. confirm Home, the selected-job count, and the prior route remain intact; and
5. do not continue changing the broken optimization surface until rollback is
   verified.

No stored-data recovery or migration is required because this change does not
write stored data.
