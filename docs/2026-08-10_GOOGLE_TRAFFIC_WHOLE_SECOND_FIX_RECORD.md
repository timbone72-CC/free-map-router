# Google Traffic Whole-Second Window Fix — Level 2 Record

## Problem and evidence

The live Google Optimize request is rejected with:

`model.global_end_time: nanos must be unset`

The provider currently serializes both traffic-window timestamps with a
fractional-seconds component such as `.000Z`. Google interprets that component
as protobuf nanos and requires it to be absent from `globalEndTime`.

## Approved behavior and scope

- Send the existing start and end times at whole-second precision with no
  fractional-seconds component.
- Keep the 24-hour traffic window, time-based cost, traffic estimates, Home
  endpoints, mandatory stop set, and complete-route validation unchanged.
- Change only `buildTrafficWindow` in `google-route-provider.js`, its focused
  provider test, and this record.

No workbook/router integration impact.

## Read and write surfaces

The provider reads the backend clock and writes only the two timestamps in the
in-memory Google request. It does not write Home, stops, route order, browser
storage, Drive, workbook, backups, credentials, or cloud configuration.

## Protected behavior, risks, and tests

The main risk is accidentally shortening or shifting the traffic window. The
focused test supplies a time containing milliseconds and requires both output
timestamps to omit the fractional component while remaining exactly 24 hours
apart. Existing assertions continue to protect traffic-aware time cost, Home as
both endpoints, and the full mandatory stop set.

Focused command:

```bash
node --test tests/google-route-provider.test.js tests/google-route-server.test.js
```

Focused result: 17 passed, 0 failed.

Final gate:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Final result: 171 passed, 0 failed; every root JavaScript syntax check passed.

Affected live check: run Google Optimize on the preserved route; confirm the
validation error clears, every job remains exactly once, and Home remains the
start and finish.

## Rollback

Rollback point: `49df97bb`, the live diagnostic release. If verification fails,
stop before merge. If the published request still fails, keep the route data
untouched and restore the provider to that commit while retaining the detailed
error response for further diagnosis.
