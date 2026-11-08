# Route Builder — Quick Actions at the top

Date: 2026-11-07
Change level: **Level 2 — normal route-page control layout**.
Status: implementation staged on a branch; live smoke check pending.

## User-facing problem and evidence

The three actions the operator uses most — **Open in Google Maps**, **Send Route Order to Workbook**, and **Check Workbook Route** — were buried inside the collapsed **Route tools & maintenance** block, below the planning context, Today's Route list/map, and execution controls. The user confirmed exactly these three buttons need to be more accessible. The planning controls can remain at the top, but should not block access to frequently used route actions.

## Minimal approved change

Move those same three buttons into one compact **Quick route actions** row directly below the Google/Basic route selector and above Multi-Day Plan, Workday, and Today's Route. Move the existing returned map links and workbook-send status into the same area so feedback appears near its initiating action. Keep Clear Route, Garmin GPX, Clear InspectorADE Jobs, and Clear Manual Gig Work in the expandable maintenance group.

This is **only a layout change**. Do not change the labels, actions, availability/disabled logic, event handlers, route state, Google Maps URLs, Drive requests, workbook route-order JSON, workbook/print logic, route number logic, authentication, storage, or permissions. No new route tool or new settings are introduced. No plan or workday settings are collapsed in this first piece; compacting those remains separate for later operator feedback.

## Ownership

- `index.html`: moves existing DOM controls and the two status/output nodes without changing their IDs or handlers; bumps the changed CSS asset cache pin.
- `styles.css`: modest spacing, responsive button wrapping, hide empty status.
- `tests/route-quick-actions-layout.test.js`: verifies approved buttons are top-most and remain unique; status/output nodes remain adjacent; secondary controls remain in the original maintenance group.

Read/write surfaces: only visible HTML/CSS layout; the JavaScript modules continue reading the same element IDs. No persisted state or external file is written by the layout change. No workbook/router integration impact.

## Risks, checks, rollback

- Risk: accidentally duplicating or hiding an ID, resulting in duplicate listeners or no action. Focused checks assert each original ID exists exactly once and remains in the relevant group.
- Risk: map links or send status appears below the fold, away from initiating action. They are moved with the three buttons; no statuses were renamed.
- Risk: stale CSS. `styles.css` pin is bumped to `1.2.3`; other JavaScript cache pins unchanged.
- Mobile: existing `.btnRow` flex-wrap is preserved. No new auto-resize script or extra controls.
- Focused test: `node --test tests/route-quick-actions-layout.test.js`.
- Complete-suite CI and root JS syntax checks must pass on final runtime head before merge. After GitHub Pages publication, operator smoke-check: top buttons visible, Open in Google Maps performs existing action, Check Workbook Route still works, Send Route Order remains governed and shows its actual status, and navigation between pages works.
- Rollback baseline: `58fe085ff1f95d2ced0b55614a24b1433bf08b27` (main immediately after standalone-address route print release). Revert this PR using the normal GitHub route if the UI is defective; do not touch saved route data or Drive files.
