# Workbook Route Order Target Drive Fix — Level 3 Impact Record

## Change level

Level 3 because this changes the workbook/router return synchronization path. It does not change route ordering, workbook Order IDs, JSON structure, stored route schemas, Google API scopes, or deployment configuration.

## Problem and live evidence

The live workbook exported the current 37-job route to the approved Free Map Router folder. The exact `Free Map Router Address Inbox.json` in that folder was modified at `2026-08-18T00:51:10.921Z`.

Free Map Router then displayed `Google Route order sent for 37 workbook jobs.` after the operator tapped **Send Route Order to Workbook**. Immediately afterward, the exact `Free Map Router Route Order.json` in the workbook's approved folder was still the old 15-stop file last modified at `2026-08-11T20:08:59.787Z`.

The app-side writer currently calls `ensureBackupFolder()`. That helper searches for a folder only by the name `Free Map Router` inside whichever Google Drive account supplied the current `drive.file` token, and it creates a new same-named folder when none is visible. The workbook receiver does not use that account-relative lookup; it reads the one governed workbook folder. Therefore a valid Drive write can succeed in a different Google account or same-named folder while the app reports success and the workbook continues to see the stale route-order file.

## Approved behavior and scope

The route-order return must target only the existing governed workbook/router folder with ID `1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf`.

- **Send Route Order to Workbook** must not create or use another same-named folder for the return file.
- Before writing, the app verifies that the current limited Drive token can access the governed folder ID.
- If the selected Drive account cannot access that folder, the send stops before creating or changing any route-order file.
- The stale/wrong Drive token is discarded so the next explicit send can show Google account selection.
- A fresh Drive authorization asks the operator to select the Google account instead of silently reusing the wrong signed-in account.
- Once the governed folder is accessible, the existing exact `Free Map Router Route Order.json` is replaced, or recreated in that exact folder if it is genuinely missing.
- General **Back Up Now**, restore, and permanent address-correction behavior remain unchanged.

Owning runtime file:

- `google-drive.js`: governed folder targeting, wrong-account failure handling, token reset, and fresh account selection.

Cache publication file:

- `index.html`: bumps only the `google-drive.js` cache version so the published app loads the repaired writer.

Focused test file:

- `tests/google-drive.test.js`.

## Read and write surfaces

Reads:

- The governed workbook/router folder metadata by exact folder ID.
- The exact route-order filename inside that folder.

Writes:

- Only `Free Map Router Route Order.json` inside the governed folder when the operator explicitly taps **Send Route Order to Workbook**.
- Existing app backup and correction writes are not changed by this fix.

## Protected behavior

- Drive scope remains `https://www.googleapis.com/auth/drive.file`.
- No background or automatic route-order write is added.
- Google Route and Basic Route selection, optimization, visible stop numbering, corrected addresses, and snapshot-local workbook Order IDs remain unchanged.
- The workbook continues to match returned jobs only by exact Order ID and continues to reject stale, damaged, duplicate, or mismatched route-order data before clearing route numbers.
- Home, saved stops, pins, backups, pending routes, Google Maps, Garmin, and navigation are untouched.
- Existing duplicate exact-name route-order protection remains in place.

## Required and optional data

Required:

- Existing governed folder ID `1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf`.
- Existing limited Drive authorization for a Google account that can access that folder.
- A valid displayed route-order payload produced by the existing route-order contract.

Optional:

- The return file may be missing; after governed-folder access is verified, the app may recreate it in that exact folder.

## Schema, permissions, and hard limits

No JSON schema change.

No stored-data migration.

No additional Google scope. The app remains on `drive.file`.

The return target is narrowed from an account-relative folder-name search to one exact governed folder ID. A token that cannot access that folder is treated as the wrong Drive account for this operation.

## Failure and stale-output behavior

If folder verification fails, no alternate folder is created and no route-order file is written. The current Drive token is cleared, and the operator receives a message to tap **Send Route Order to Workbook** again and choose the Google account that owns the workbook folder.

If the second account still cannot access the governed folder, the send remains failed closed. The workbook retains its existing route numbers and continues to reject the stale old route-order file.

## Focused verification

Add coverage proving:

1. route-order creation and replacement use the governed folder ID instead of the account-relative folder lookup;
2. an inaccessible governed folder stops the send before any route-order create/update request;
3. the wrong cached Drive token is discarded after that failure;
4. the next fresh Drive authorization requests Google account selection;
5. existing backup-folder behavior remains unchanged.

Final gate on the final runtime head:

- focused `tests/google-drive.test.js` coverage;
- complete `npm test`;
- `for file in *.js; do node --check "$file"; done`;
- diff inspection for only the recorded files and blocks.

## Integration compatibility

The workbook side already reads the governed folder and validates exact Order IDs against the current inbox. No workbook runtime change is required for this fix. The current return JSON version, filename, field names, timestamps, route slot, optimizer status, addresses, stop numbers, and Order IDs remain unchanged.

## Risk and recovery

Primary risks:

- selecting a Google account that cannot access the governed folder;
- accidentally changing general backup/correction folder behavior;
- weakening duplicate route-order protection;
- changing Drive scope.

Controls:

- exact folder-ID verification before the route-order write;
- fail-closed behavior with no alternate-folder creation;
- change limited to the route-order save path plus fresh account-selection behavior;
- focused and full regression coverage.

Rollback point: `726120dfd07a66de0ab412a4de45a72d79c57244`.

If the published live check fails, restore that commit before further changes to this surface. The stale route-order file remains recoverable because this fix performs no deletion or migration.

## Approval status

Implementation authorization: user said **Let's fix it** on 2026-08-17 after the live stale-file failure was identified.

Explicit Level 3 pre-merge operator approval: pending.
