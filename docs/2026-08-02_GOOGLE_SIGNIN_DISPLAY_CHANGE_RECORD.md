# Google Sign-In Display Change Record

## Level

Level 2 — narrow Google sign-in interaction fix.

## Problem and evidence

After the operator selected `inandoutinspections2026@gmail.com`, Google returned
a credential and **Google Optimize** became available, but Google's original
personalized sign-in control remained visible as **Sign in as Tim** /
`timbone72@gmail.com`. A successful 24-job optimization showed that the backend
accepted the company credential, so the remaining personal-account label was a
stale display, not evidence that the operator chose the wrong account.

## Approved behavior

- Show Google's account chooser before authentication is completed.
- Hide Google's personalized sign-in control after any credential is returned.
- Keep a neutral session message visible and let the server remain the authority
  that approves or rejects the account.
- Show the sign-in control again when authentication is absent, expired, or
  rejected.

## Scope and ownership

- `google-route-browser.js` owns the Google identity control and session status.
- `index.html` advances only that adapter's cache version.
- `tests/google-route-browser.test.js` protects the successful sign-in display.
- `tests/google-route-ui.test.js` protects the cache-version reference.

Read surface: Google Identity Services credential callback and backend
authentication errors.

Write surface: visibility of `googleRouteSignIn`, enabled state of
`googleOptimizeRoute`, and text in `googleRouteAuthStatus`.

No workbook/router integration impact.

## Protected behavior

- The backend remains the only authority that approves the company account.
- The ID token remains in memory only and is never displayed or stored.
- A personal, expired, or invalid account remains rejected by the backend.
- Route preparation, optimization, route order, saved addresses, Home, pins,
  Drive, imports, backups, Google Maps, and Garmin behavior are unchanged.

## Risk and checks

Primary risk: hiding the only account chooser before the operator can recover
from an invalid or expired sign-in. The rejection path therefore restores the
same Google sign-in control.

Focused tests:

- `node --test tests/google-route-browser.test.js`
- `node --test tests/google-route-ui.test.js`

Final gate: complete `npm test` suite and root JavaScript syntax checks on the
final runtime head.

Affected live smoke check:

1. Open **Build Route** while signed out and confirm the Google account control
   appears.
2. Select `inandoutinspections2026@gmail.com`.
3. Confirm the personalized **Sign in as Tim** control disappears and **Google
   Optimize** is enabled.
4. Run **Google Optimize** once and confirm the selected jobs are preserved.

## Rollback

Known working pre-change commit: `3b5f916c31071f76d43954d3b77181943101a78f`.
Revert this pull request to restore the prior sign-in display behavior.
