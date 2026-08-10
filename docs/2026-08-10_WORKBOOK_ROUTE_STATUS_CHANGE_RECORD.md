# Workbook Route Update Status — Level 1 Change Record

## Problem and approved behavior

Workbook routes take a few seconds to appear after the operator returns to Free
Map Router, and the app gives no visible indication that it is checking. The
approved cleanup keeps Google Drive auto-save and adds these Build Route status
messages:

- `Checking for new route…` while the protected backend read is running.
- `Route updated — [count] addresses` after a newer route is accepted.
- `Current Route is up to date.` when the check completes without a newer route.

## Classification, ownership, and scope

Level 1: this is a display-only status change. `google-route-browser.js` owns
the business-authenticated backend check and writes only the existing
`routeStatus` text through the existing app bridge. `index.html` advances that
module's cache version. No workbook/router integration impact.

## Protected behavior and checks

Google Drive auto-save, business authentication, inbox validation, Current and
Previous rotation, saved addresses, pins, Home, route order, optimization,
Google Maps, Garmin, and permissions remain unchanged. Focused browser tests
verify the in-progress, updated-count, and no-newer-route messages. The final
gate is one complete `npm test` run plus root JavaScript syntax checks. The
affected smoke check is to return to the signed-in app and observe the checking
message followed by the correct result.

Rollback point: `bf6f85f`. Before merge, abandon this branch. After publication,
revert this pull request if the status is incorrect.
