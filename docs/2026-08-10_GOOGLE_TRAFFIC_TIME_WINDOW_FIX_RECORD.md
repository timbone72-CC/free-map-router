# Google Traffic Time Window Fix — Level 3 Impact Record

## Status and approval

- Status: implementation and verification complete on
  `fix/google-traffic-time-window`; not published.
- Operator evidence: the first live traffic-aware Google Optimize request
  failed with status 400 while preserving the existing route.
- Implementation authorization: the operator asked to continue the approved
  time-efficient routing work and supplied the live failure.
- Explicit Level 3 pre-merge approval: pending after final verification.
- Last known working Google Optimize rollback commit: `54fba9c1`.

## Problem and evidence

The traffic-aware request enabled `considerRoadTraffic` but omitted the model's
global start and end times. Google defaults an omitted model time window to
January 1, 1970. That cannot represent the current traffic conditions requested
by the app and the live provider rejected the request with status 400.

## Approved behavior and scope

- Give every traffic-aware request an explicit departure time equal to the
  backend's current time.
- End the model window 24 hours after that departure time.
- Keep `costPerTraveledHour` as the only route cost and keep traffic enabled.
- Keep Home as both endpoints and keep every selected job mandatory.

Owning files and functions:

- `google-route-provider.js`: `buildGoogleOptimizeToursRequest` owns the Google
  model, cost, traffic flag, and route-time window.
- `tests/google-route-provider.test.js`: protects the exact current-day window,
  time objective, traffic flag, Home endpoints, and complete stop set.

No workbook/router integration impact.

## Read and write surfaces

Reads:

- the backend clock at the moment Google Optimize is requested;
- the existing verified Home and complete stop request.

Writes:

- only the provider request's in-memory `globalStartTime` and `globalEndTime`;
- the active route order only after existing complete-response validation.

No Home, stop, pin, address, note, browser storage, Drive, workbook, backup,
credential, or cloud configuration data is written.

## Required and optional data

Required data remains the verified Home, every selected stop, and the backend's
valid current clock. No user-entered appointment, departure date, service time,
or new setting is added.

## Schema, permissions, limits, and stale output

- No schema, migration, API permission, OAuth scope, or deployment change.
- No additional Google request and no new billing event.
- The existing 100-stop limit and 30-second solver timeout remain unchanged.
- The model horizon is 24 hours, beginning when the backend creates the request.
- The existing request ID and complete-route validation continue to reject
  skipped, missing, duplicated, added, or stale stops before route order changes.

## Primary risks and protection

Primary risks are an invalid backend clock, an accidentally stale 1970 window,
or altering the protected route boundaries while adding time fields. Focused
coverage uses an injected fixed time, requires its exact 24-hour end, and keeps
the existing Home and route-completeness assertions.

## Verification and smoke check

Focused command:

```bash
node --test tests/google-route-provider.test.js tests/google-route-server.test.js
```

Focused result: 16 passed, 0 failed.

Final gate after focused coverage passes:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Final result: 170 passed, 0 failed; every root JavaScript syntax check passed.

Affected live check: run Google Optimize on the preserved representative route;
confirm the status-400 message clears, every job remains exactly once, and Home
remains the unnumbered start and finish.

## Recovery and rollback

If verification fails, stop before publication. If the live provider still
rejects the request, keep using the ordinary optimizer, route Cloud Run and the
app back to the last verified Google Optimize behavior at `54fba9c1`, and leave
all stored route data untouched.
