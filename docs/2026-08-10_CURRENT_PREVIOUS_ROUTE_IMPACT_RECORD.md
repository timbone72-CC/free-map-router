# Current and Previous Route Snapshots — Level 3 Impact Record

## Status

Implementation authorized. Pre-merge operator approval is not yet recorded.

## Exact user-facing problem

After the workbook sends a route, Free Map Router can lose the active route
when the phone screen times out or the app is reopened. Reconnecting Drive can
then apply an older workbook inbox or reapply the same inbox in workbook order,
which can replace the route the operator most recently optimized.

## Approved behavior

- The newest workbook export becomes **Current Route**.
- The former Current Route becomes **Previous Route** automatically.
- Only Current and Previous are retained; anything older is discarded.
- The app always opens on Current Route.
- The operator can select Current or Previous inside Build Route.
- Each slot preserves its latest route order. Saved stop data, including
  corrected addresses and protected pins, continues to come from the existing
  saved-address store.
- Reconnecting to the same workbook export keeps the active optimized order.
- An older workbook export never replaces Current automatically.

## Classification

Level 3. This changes locally stored route state, extends the backup payload,
affects automatic Drive writes, and changes how repeated workbook inbox exports
are applied.

## Owning files and functions

- `route-history.js`: owns the two-slot route-history schema, local persistence,
  active-slot updates, and timestamp comparison.
- `app.js`: owns Current/Previous selection, route mutations, inbox application,
  restore behavior, and Drive save scheduling.
- `backup.js`: preserves Current and Previous in downloaded and Drive backups;
  version-1 backups without the optional route history remain valid.
- `google-drive.js`: serializes Drive saves so an older in-flight save cannot
  finish after and replace a newer queued state.
- `index.html`: owns the Current/Previous selector and script loading.
- Focused tests cover route rotation, persistence, backup compatibility, inbox
  freshness behavior, and Drive save ordering.

## Read and write surfaces

Reads:

- existing saved stops and Home from browser storage;
- the existing `Free Map Router Address Inbox.json` export timestamp and jobs;
- existing version-1 backup files.

Writes:

- one browser-storage record containing Current and Previous route IDs and the
  workbook export timestamp associated with each slot;
- an optional `routes` object inside the existing backup JSON;
- the existing single Drive backup file through a serialized save queue.

The workbook file, Drive folder, inbox filename, inbox version, inbox fields,
Drive permission, saved-stop schema, Home schema, and routing algorithms do not
change.

## Required and optional data

- Required per retained slot: an ordered list of saved stop IDs.
- Optional per retained slot: the valid workbook `updatedAt` timestamp that
  created that route.
- Current or Previous may be empty.
- The selected Current/Previous UI slot is deliberately not persisted; every
  app load starts on Current.

## Hard limits and stale-output behavior

- Exactly two route slots are retained.
- A newer valid workbook timestamp rotates Current to Previous.
- The same timestamp does not replace the route order.
- An older timestamp is ignored for route replacement.
- Invalid route IDs are filtered against saved stops during load and restore.
- A failed local parse falls back to empty route history without changing saved
  addresses or Home.

## Protected behavior

- Saved addresses, corrected addresses, notes, sources, and manual pins remain
  governed by the existing stop contract.
- Home remains separate and remains route start and finish.
- Optimization, Google Maps, Garmin, Up, Down, Remove, Clear Route, and Done
  continue to operate on the route slot currently selected by the operator.
- The five-page menu, Drive `drive.file` permission, workbook inbox contract,
  and Google optimizer remain unchanged.
- Older version-1 backups restore as one Current Route with no Previous Route.

## Workbook compatibility

The upstream workbook remains compatible and receives no runtime change. The
app continues to consume the existing version-1 inbox, address/source fields,
selected-job order, and `updatedAt` field. No companion deployment is needed.

## Realistic fixture and safe validation plan

Focused fixtures will model:

- a current optimized route followed by a newer workbook export;
- reconnecting the exact same export;
- an older export arriving after a newer Current Route;
- a legacy backup containing only `routeIds`;
- overlapping Drive saves completing with a newer state last.

The branch and pull request are the safe environment. `main` remains unchanged
until explicit pre-merge approval.

## Baseline and expected verification

- Rollback point: `2d8cf87`.
- Expected focused result: all new route-history, backup, inbox, and Drive queue
  tests pass.
- Expected final result: the complete repository suite and all root JavaScript
  syntax checks pass once on the final runtime head.
- Required smoke checks: core pages, Build Route controls, Current/Previous
  switching, saved-data preservation, same/newer/older inbox behavior, screen
  timeout/reopen, and Drive reconnection.

## Failure recovery

Before merge, abandon the branch and retain `main` at `2d8cf87`.

After publication, if the live check fails:

1. stop using the changed Drive/route snapshot surface;
2. preserve browser data and the Drive backup;
3. revert the pull request through a dedicated rollback branch;
4. restore the last verified `main` deployment;
5. verify saved addresses, Home, the workbook inbox, and one route before any
   further change.

## Approval boundary

Implementation and branch testing are authorized. Because this is Level 3,
explicit operator approval is required after the final diff and test results
are presented and before the pull request is merged into live `main`.
