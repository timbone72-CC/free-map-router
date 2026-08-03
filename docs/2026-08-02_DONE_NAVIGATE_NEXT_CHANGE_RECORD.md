# Done & Navigate Next Change Record

## Level

Level 2 — normal Build Route interaction and Google Maps handoff.

## Problem and evidence

Free Map Router can open a complete optimized route, but after finishing a job
the operator has no single action that advances the active route and starts
navigation to the next exact stop on Google Maps / Android Auto.

## Approved behavior

- **Done & Navigate Next** treats the first displayed job as the current stop.
- One tap removes only that stop from the active route, keeps every saved
  address intact, renumbers the remaining route, and opens Google Maps driving
  navigation to the new first stop.
- After the final job, the same action clears the active route and navigates to
  the saved Home address.
- Navigation uses readable address text unless a stop has a protected manual
  pin, matching the existing exact-destination rule.

## Scope and ownership

- `app.js` owns the route-progress action, active `routeIds`, rendering, and
  Google Drive autosave scheduling.
- `routing.js` owns construction of the single-destination Google Maps
  navigation URL.
- `index.html` owns the new Build Route button and cache versions.
- `tests/done-navigate-next.test.js` and `tests/routing.test.js` protect the new
  interaction and exact destination URL.

Read surfaces: Home, the ordered active route, and saved stops.

Write surfaces: active in-memory route selection and the existing optional
Google Drive backup autosave. Saved addresses, Home, pins, and job data are not
modified.

No workbook/router integration impact.

## Protected behavior

- Google and free optimization remain unchanged.
- The complete route still starts and finishes at Home.
- Every saved address remains available after a stop is completed.
- Existing Up, Down, Remove, Clear Route, Open in Google Maps, numbered map
  sections, Google Optimize, and Garmin controls remain unchanged.
- Readable addresses remain primary; manually corrected pins remain protected.

## Risks and checks

Primary risks: removing the wrong stop, deleting a saved address, opening the
wrong destination, or losing the Home return after the last stop.

Focused tests:

- `node --test tests/done-navigate-next.test.js tests/routing.test.js`

Final gate: complete `npm test` suite and root JavaScript syntax checks once on
the final runtime head.

Affected smoke check:

1. Open **Build Route** with at least two ordered jobs.
2. Tap **Done & Navigate Next** and confirm Google Maps opens the second job as
   the destination.
3. Return to Free Map Router and confirm the first job is gone only from Build
   Route, while it remains on **Addresses**.
4. Complete the final job and confirm Google Maps opens Home.

## Rollback

Known working pre-change commit: `9ad75b0`.
Revert this pull request to restore the prior Build Route behavior.
