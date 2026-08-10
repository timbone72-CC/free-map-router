# Persistent Business Google Sign-In — Level 3 Impact Record

## Problem and evidence

Free Map Router keeps the approved business Google ID token only in JavaScript
memory. Reloading or fully closing the app discards that token and requires the
operator to press the Google sign-in control again.

## Approved behavior

After `InandOutInspections2026@gmail.com` has successfully signed in, ask
Google Identity Services for a fresh identity automatically when the app loads
again. Also request a fresh identity after the backend rejects an expired token.
If Google cannot renew automatically, leave the existing Google sign-in button
visible. Never persist a Google token in browser storage or an app backup.

## Owning files and functions

- `google-route-browser.js`: `initializeBrowserUi()` and the Google Identity
  Services callback own browser identity state and renewal.
- `index.html`: owns the cache-versioned browser adapter reference.
- `CONTRACT.md`: protects the approved renewal and no-token-storage boundary.
- `tests/google-route-browser.test.js` and `tests/google-route-ui.test.js`: own
  focused regression coverage.

## Read and write surfaces

- Reads the Google Identity Services API already loaded by the app.
- Keeps the returned ID token in the existing in-memory variable only.
- Sends that token only in the existing backend `Authorization` header.
- Does not write local storage, session storage, IndexedDB, Cache Storage,
  Google Drive, workbook files, or backups.

## Required and optional data

- Required: the existing Google web client ID and a currently approved Google
  browser session for the business account.
- Optional: automatic Google credential return. When unavailable or declined,
  the operator uses the existing sign-in button.

## Schema and permission changes

None. No data schema, Google OAuth scope, Drive permission, service-account
permission, backend route, or Cloud Run setting changes.

## Hard limits and stale-output behavior

- Google and the browser decide whether automatic sign-in is available.
- A rejected non-business account is not automatically retried.
- A missing or expired identity leaves Google Optimize disabled and the manual
  sign-in control visible.
- Existing Current and Previous routes remain unchanged on authentication
  failure.

## Protected behavior

- Only the approved business account is accepted by the backend.
- Google Optimize and backend workbook inbox reads remain authenticated.
- Current/Previous route behavior, saved addresses, pins, Home, Drive backup,
  free optimization, Garmin, and Google Maps remain unchanged.
- No workbook/router integration impact; the inbox contract and import path are
  unchanged.

## Focused tests and realistic fixture plan

- Fake Google Identity Services verifies automatic selection, FedCM button
  configuration, one prompt on load, and a retained manual button fallback.
- Fake backend responses verify an expired identity requests one renewal and
  does not enable protected actions.
- Existing fake-backend tests continue to verify the token stays in the
  authorization header and workbook data uses the protected import bridge.

## Primary risks

- Repeated renewal attempts could create an authentication loop.
- A rejected account could be retried without operator control.
- A developer could persist the ID token to simulate persistence.

The implementation requests once on load and once after a later `401`, does not
retry `403` account rejection, and does not add token storage.

## Baseline and expected final result

- Baseline: 169 tests passed for the app-to-backend workbook inbox release.
- Expected: focused identity tests pass, followed by one complete `npm test`
  run and JavaScript syntax checks on the final runtime head.

## Smoke checks

1. Sign in once with the approved business account.
2. Reload or fully close and reopen Free Map Router.
3. Confirm Google Optimize becomes available without selecting the account
   again when Google permits automatic return.
4. Send a new workbook route and confirm it becomes Current.
5. If automatic return is unavailable, confirm the existing sign-in control is
   visible and works.

## Rollback and recovery

- Prior working release: `ad6ba73f` (PR #34 merge).
- Revert the persistence commit or redeploy `ad6ba73f`.
- Authentication failure does not alter local route data, so no data migration
  or repair is required.

## Approval status

Implementation requested by the operator. Explicit Level 3 pre-merge approval
is still required after the final tested commit is identified.
