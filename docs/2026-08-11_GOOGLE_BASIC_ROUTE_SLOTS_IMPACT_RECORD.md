# Google and Basic Route Slots — Level 3 Impact Record

## Status

Implementation authorized on 2026-08-11. Explicit pre-merge operator approval
is not yet recorded.

## Problem and approved behavior

Current Route and Previous Route preserve chronology, but the operator needs to
compare and switch between two versions of the same jobs: one ordered by Google
Optimize and one ordered by the basic optimizer. A newer workbook export must
not overwrite either version before the operator chooses to start it.

- Replace the Build Route choices with **Google Route** and **Basic Route**.
- Google Optimize selects and updates only Google Route.
- Basic Optimize selects and updates only Basic Route.
- Manual changes affect only the selected route and show Manually Changed after
  an optimized order is changed.
- A newer accepted workbook inbox is saved as **New Route Available** while both
  usable routes remain unchanged.
- Confirmed **Start New Route** replaces both usable slots with the pending jobs
  in workbook print order, marks both Not Optimized, clears pending, and selects
  Google Route. Cancellation changes nothing.

## Classification and ownership

Level 3. This repurposes locally stored route slots, extends backup meaning, and
changes when an accepted workbook route becomes active.

- `route-history.js`: named-slot schema, legacy migration, freshness comparison,
  pending staging, and confirmed start.
- `app.js`: selected-slot mutations, optimizer targets, pending-route UI,
  confirmation, inbox staging, restore, and rendering.
- `backup.js`: backward-compatible backup and restore of named and pending slots.
- `google-route-browser.js`: workbook-check status wording only.
- `index.html`: named selector, pending control, and cache versions.
- Contracts and focused tests protect the changed behavior.

## Data, reads, and writes

Required per usable route: ordered saved-stop IDs. Optional per usable route:
workbook export timestamp and normalized optimizer status. Pending requires
ordered saved-stop IDs and a valid workbook export timestamp.

Reads the existing saved stops, Home, `fmr_route_history_v1`, version-1 backups,
and unchanged version-1 workbook inbox. Writes the same browser-storage key with
schema version 2 and the existing optional `routes` backup object. No new Drive
file, filename, folder, permission, credential, workbook field, or automatic
Drive write is added. **Free Map Router Backup.json** remains unchanged.

## Compatibility and hard limits

- Exactly two usable routes and at most one pending workbook route are retained.
- Existing Current/Previous data is migrated by optimizer status when known. A
  single older Current route is copied into both named slots so it remains usable
  with either optimizer.
- Older backup files remain valid. New backups preserve all named slots and keep
  the legacy top-level `routeIds` fallback.
- Invalid and duplicate stop IDs are filtered against saved addresses in every
  slot.
- Same and older workbook timestamps cannot replace a usable route or pending
  route. A newer timestamp may replace only the pending snapshot.
- All workbook jobs remain in supplied print order until an optimizer is run.

## Workbook compatibility

The upstream workbook remains compatible and needs no runtime change. Merged
workbook PR #7 confirms the router action still writes
`Free Map Router Address Inbox.json` version 1, preserves checked-job print
order, deduplicates physical addresses, and sends the governed address/source
payload. This app change alters only activation timing after that payload is
validated and merged into saved addresses.

## Protected behavior and risks

Home remains separate and remains start and finish. Saved addresses, corrected
aliases, notes, GIS/DCFS source, and protected pins remain governed by their
existing stores. Google Maps sections, Garmin, every-stop-once validation,
authentication, optimizer calculations, manual Drive backup, and the five-page
menu are unchanged.

Primary risks are overwriting the wrong named route, activating an inbox without
confirmation, losing legacy route data, restoring an incomplete backup, or
dismissing a pending route accidentally. Controls are explicit slot targeting,
pure normalized storage helpers, a confirmation-gated start, backward-compatible
migration, and focused fixtures covering all three snapshots.

## Verification and recovery

Focused coverage:

```bash
node --test tests/route-history.test.js tests/backup.test.js tests/route-optimizer-status.test.js tests/google-route-browser.test.js tests/manual-drive-backup.test.js
```

Focused storage, migration, optimizer-targeting, backup, browser-status, and
workbook-handoff checks passed during development.

Final gate:

```bash
npm test
for file in *.js; do node --check "$file"; done
```

Final result: 185 tests passed, 0 failed; every root JavaScript syntax check and
`git diff --check` passed.

Affected smoke checks: migrate an existing route, receive a newer workbook
route, cancel Start New Route, confirm it, optimize each named slot, switch
between them, manually move one stop, refresh, backup/restore, and verify Home
plus every job remains present once in the selected route.

Rollback point: `6e51600`, whose equivalent published optimizer-status release
was confirmed working by the operator. Before merge, abandon this branch. After
publication, preserve browser data and the Drive backup, revert through a
dedicated rollback pull request, restore the prior deployment, and verify Home,
saved addresses, both available legacy routes, and the workbook inbox before
further work.
