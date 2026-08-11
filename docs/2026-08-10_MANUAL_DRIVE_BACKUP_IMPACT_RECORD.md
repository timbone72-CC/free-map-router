# Manual Google Drive Backup Impact Record

## Problem and approved behavior

Google Drive currently writes a backup after ordinary app changes whenever its
short-lived connection is active. The approved replacement is one explicit
**Back Up Now** control. Nothing is written to Drive unless the operator taps
that button. **Restore from Drive** remains available.

## Change level and scope

Level 3. This removes automatic Drive writes and changes when recovery data is
copied off the phone.

Owning files:

- `app.js`: removes automatic scheduling and performs the manual backup;
- `index.html`: replaces the old connection/save controls with **Back Up Now**;
- `CONTRACT.md`: records manual-only Drive behavior;
- focused tests: protect the manual write and absence of silent Drive activity.

No workbook/router integration impact. The existing business-authenticated,
read-only backend remains the workbook route source.

## Data and permissions

Required backup data remains Home, saved addresses, pins, Current Route, and
Previous Route. The Geoapify key remains excluded. The backup filename, folder,
JSON version, schema, and `drive.file` OAuth permission do not change.

No new API, OAuth, browser-storage, workbook, or backend permission is added.

## Reads and writes

Ordinary app actions read and write only the existing browser data. **Back Up
Now** requests Drive access and writes the existing `Free Map Router Backup.json`
snapshot. **Restore from Drive** requests Drive access, reads that file, asks
for confirmation, and then restores the existing browser data.

The app no longer silently reads the legacy Drive inbox on focus. Workbook
routes continue through the private business-authenticated backend.

## Limits and stale behavior

- A Drive backup is only as current as the last successful **Back Up Now** tap.
- A cancelled or failed Drive authorization writes nothing.
- A failed backup leaves both phone data and the prior Drive backup recoverable.
- Repeated manual backup requests remain serialized; the latest request wins.
- Restore continues to wait for any pending backup request before reading.

## Protected behavior

Home, saved addresses, pins, Current/Previous rotation, workbook route updates,
route order, optimization, Google Maps sections, stop-by-stop navigation,
Garmin export, downloaded backup/restore, and the five-page menu remain
unchanged.

## Verification

Focused fixtures prove that ordinary edits cannot schedule Drive activity,
**Back Up Now** requests one token and sends the complete recovery snapshot,
restore remains confirmation-gated, and the protected backend inbox path is
still present. Existing fake-Drive tests cover folder/file creation, update,
restore, and serialized writes without contacting Google Drive.

Final gate: one complete `npm test` run plus root JavaScript syntax checks on
the final runtime head.

Affected live smoke check:

1. update the app;
2. change a harmless local route selection and confirm no Drive message appears;
3. tap **Back Up Now** and approve the intended Drive account;
4. confirm **Backup complete** appears;
5. send a newer workbook route and confirm Current/Previous still rotate.

## Recovery and rollback

Prior working runtime commit: `0858752` (the exact tested tree released by PR
#37). Before publication, preserve the existing Drive backup. If the live
manual backup fails, do not clear phone data; restore the prior runtime tree and
use the existing Drive backup only if phone recovery is needed.

Explicit pre-merge operator approval: pending after implementation and final
verification.
