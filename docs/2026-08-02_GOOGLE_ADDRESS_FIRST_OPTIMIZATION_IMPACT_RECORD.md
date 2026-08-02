# Google Address-First Optimization — Level 3 Impact Record

## Status and approval

- Status: implementation in progress on `agent/google-address-optimization`.
- Operator approval: the operator said **proceed** after approving one flow that
  covers build, testing, publication, backend deployment, and live verification.
- Rollback commit: `3b5f916` (live `main` before this change).

## Problem and evidence

Google Maps already opens ordinary route stops by written address, but Google
Optimize currently orders them from saved free-geocoder coordinates. Three
distinct rural addresses were observed sharing the same incorrect automatic
pin. This can stop optimization or produce an order based on the wrong
property even though Google Maps can resolve the written address.

## Approved behavior and scope

- Ordinary stops are sent from the browser to the private backend as written
  addresses.
- The backend uses Google Geocoding v4 for each ordinary stop, then passes the
  returned coordinates to Google Route Optimization for the current request.
- A manually corrected stop bypasses geocoding and uses its protected saved
  coordinates.
- Home continues to use its verified saved coordinates.
- Google geocoding results are request-only and are not written to browser
  storage, saved addresses, Drive backups, or the workbook inbox.

Owning files and functions:

- `google-route-browser.js`: `buildBrowserRequest` chooses address or manual
  coordinates.
- `google-route-contract.js`: validates the two allowed stop-location shapes.
- `google-route-server.js`: performs authenticated Google geocoding and builds
  a coordinate-ready provider request.
- `google-route-provider.js`: accepts only the coordinate-ready request.
- `app.js`: returns the current selection without Geoapify preparation for the
  Google-only path.
- `index.html`: cache versions for changed browser files.

No workbook/router integration impact.

## Read and write surfaces

Reads:

- verified Home coordinates;
- selected stop IDs, written addresses, pin status, and manual coordinates;
- the existing memory-only company Google identity token;
- the Cloud Run runtime service-account access token.

Writes:

- the selected route order only after the complete provider response passes
  existing validation.

No address, pin, Home, note, source label, backup, Drive file, workbook file,
or browser-storage schema is written or migrated.

## API, billing, limits, and failure behavior

- Google Geocoding API v4 must be enabled in the existing `free-map-router`
  Google Cloud project.
- The private Cloud Run backend uses OAuth through its existing runtime service
  account; no browser API key is added.
- Each Google Optimize run makes one geocoding request per non-manual selected
  stop plus the existing Route Optimization request.
- The existing hard limit remains 100 selected stops.
- Existing Google Cloud billing and the recorded $5 gross-usage alert apply;
  the alert is not a hard spending cap.
- A failed, empty, or invalid geocode stops the whole request and identifies the
  address. The prior route order remains unchanged.
- Missing, skipped, duplicate, stale, or unknown provider output remains
  rejected as a whole.

## Protected behavior

- Home remains the round-trip start and finish.
- Every selected stop must return exactly once.
- Manual pins remain protected and are not re-geocoded.
- The free optimizer remains separate and continues to use Geoapify when it
  needs missing coordinates.
- Google Maps links continue to use address text except for manual pins.
- Authentication, allowed-origin checks, notes/source privacy, Drive behavior,
  workbook import, Garmin export, and saved-data identity remain unchanged.

## Focused tests and safe fixture

Automated fixtures cover:

- one ordinary address and one manual pin in the same request;
- automatic duplicate saved coordinates no longer blocking address-first
  optimization;
- manual duplicate coordinates still failing closed;
- Google Geocoding v4 endpoint and OAuth header use;
- address lookup resolution before Route Optimization;
- failed or empty geocoding leaving optimization unapplied;
- complete response validation and unchanged route-application ownership.

Tests use mocked Google responses and make no billed API calls. The affected
live smoke check is one small route containing an ordinary address plus a
manual pin, followed by opening the resulting Google Maps route and confirming
both destinations and Home.

## Deployment and recovery

1. Pass focused tests and the final complete suite plus syntax checks.
2. Publish through a pull request to `main`.
3. Enable Geocoding API v4 if it is not already enabled.
4. Deploy the exact merged backend source to the existing Cloud Run service.
5. Verify the backend health response and the affected live route flow.

If the browser release fails, revert the pull request to `3b5f916`. If only the
backend revision fails, route traffic back to the prior verified Cloud Run
revision and continue using the retained free optimizer while the issue is
repaired.
