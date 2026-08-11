# Current Route Optimizer Status — Level 3 Impact Record

## Problem and evidence

The two optimizer controls are understandable, but Build Route does not show
which optimizer produced the selected route's current order. After closing and
reopening the app, the operator cannot tell whether the order came from Google
Optimize or the basic coordinate optimizer.

## Approved behavior and scope

- Show one permanent Build Route line for the selected Current or Previous
  route: Google Optimized, Basic Optimized, Manually Changed, or Not Optimized.
- Save the status with each route so it survives reload, downloaded backup,
  Google Drive backup, and restore.
- Mark a route Manually Changed when Up or Down changes an optimized order.
- Also invalidate an optimized label when a stop is manually added or removed.
- A new workbook route and an older stored route without this field are Not
  Optimized.
- Do not change route calculation, Home boundaries, stop order, navigation,
  import format, Google Maps, Garmin, authentication, or Drive permissions.

No workbook/router integration impact.

## Ownership and surfaces

- `route-history.js` owns the normalized, backward-compatible per-route status.
- `app.js` records optimizer/manual actions and renders the selected route's
  status.
- `index.html` owns the status element and changed script cache versions.
- `CONTRACT.md` records the approved persistent behavior.
- Focused tests protect route-history normalization, Current/Previous rotation,
  backup/restore, and the owning UI hooks.

Read surfaces: selected route history and active route slot.

Write surfaces: the existing `fmr_route_history_v1` localStorage value and the
existing route history included in backups. No new storage key, automatic Drive
write, inbox field, credential, or permission is added.

## Compatibility, limits, and stale behavior

The optional status field is normalized into the existing route snapshot.
Older stored routes and backups remain valid and become Not Optimized. Current
and Previous each retain their own status when workbook rotation occurs. An
empty route renders Not Optimized. The display is informational and cannot
change route order.

## Risks and focused verification

Primary risks are showing a stale optimizer label after manual order changes,
losing the label on reload or backup/restore, or assigning the new workbook
route the former Current route's status.

Focused command:

```bash
node --test tests/route-history.test.js tests/backup.test.js tests/route-optimizer-status.test.js
```

Focused result: 17 passed, 0 failed.

Final gate before merge:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Final result: 178 passed, 0 failed; every root JavaScript syntax check passed.

Affected smoke check: optimize once with each optimizer, refresh after each,
move one stop Up or Down, switch Current/Previous, and confirm the displayed
status follows the selected route while every stop remains present once.

## Recovery and approval

Rollback point: `634407b`, the locally tested whole-second Google traffic fix
whose equivalent published release was confirmed working by the operator. If
focused or final verification fails, do not publish. If the live label or saved
route state is wrong, restore the prior runtime through a dedicated rollback
pull request and preserve the user's existing browser data.

Implementation authorization: approved by the user's confirmation on
2026-08-11. Explicit Level 3 pre-merge approval remains required after the
tested commit is ready.
