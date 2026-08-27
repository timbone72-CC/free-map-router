# Phase 2E Drive Identity Stabilization — 2026-08-26

## Scope

Free Map Router had a split-brain Drive risk because backup, inbox, corrections,
and Manual Work paths found a folder by the non-unique name `Free Map Router`,
while Route Order and Gig Handoff already verified the governed folder by exact
ID. Two accessible folders now have that name.

This change makes every browser-side FMR Drive path verify and use only governed
folder `1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf`. It removes automatic folder creation.
If that exact folder is missing, inaccessible, renamed, the wrong MIME type, or
trashed, the operation fails closed and clears the cached Drive token.

## PR Review Correction — Drive Failure Classification

PR review found that the exact-folder delegation treated every non-OK folder
lookup as an account mismatch. A temporary Drive 429 or 5xx response could
therefore clear an otherwise valid cached Drive token and show account-switch
recovery during Backup, Restore, Address Corrections, or Manual Work activity.

The correction keeps the exact-folder fail-closed rule while separating temporary
service failures from account/access failures:

- HTTP 429 and 5xx folder responses fail closed without clearing the cached token
  and instruct the operator to retry the same Drive action.
- Other non-OK governed-folder responses retain the existing account/access
  recovery behavior.
- Exact folder ID, `drive.file` scope, duplicate-file rejection, schemas, and
  no-auto-create behavior are unchanged.
- The browser cache key for `google-drive.js` is bumped from `v=1.8.0` to
  `v=1.9.0` so the corrected runtime is actually requested after publication.

## Affected Runtime Paths

- whole-app Backup save/load;
- Address Inbox ensure/load;
- Address Corrections save/load;
- Manual Work save/load;
- Route Order save (already exact-ID governed);
- Gig Handoff save (already exact-ID governed).

Same-named file lookup remains scoped to the exact governed parent. Backup and
Address Inbox now inspect two results and reject duplicates instead of silently
choosing one. Existing duplicate rejection remains unchanged for Corrections,
Manual Work, Route Order, and Gig Handoff.

## Protected Behavior

- Existing governed file IDs are reused when exactly one matching file exists.
- File names, JSON versions, schemas, OAuth scope, workbook handoff semantics,
  and operator actions are unchanged.
- No Drive item, permission, ownership, IAM/OAuth setting, deployment, or live
  workbook data is changed by this branch.
- The separate business folder is not read or written by the repaired runtime.

## Risk And Rollback

Risk: an account that can see only a same-named replacement folder will now be
stopped instead of writing there. This is intentional identity stabilization.

Rollback point: parent commit `2c3a427`. Reverting this branch restores the old
name-based lookup and automatic folder creation, which also restores the known
split-brain risk.

## Verification

- Focused Drive, Manual Work, and Gig Handoff tests: pass.
- Full repository suite: 316 passed, 0 failed.
- Live Drive reality gate and production deployment remain separate operator
  stops and are not authorized by this record.

## Companion Workbook Change

The workbook still uses `DriveApp.getFoldersByName` in the FMR Inbox and Route
Order/Gig Handoff paths. Its companion isolated branch must replace those calls
with `DriveApp.getFolderById('1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf')`, validate
the returned folder identity, and preserve duplicate-file rejection. No
one-sided production deployment is authorized.

## Governed Data Reconciliation Evidence

After explicit operator resolution of the four ambiguous records, byte-for-byte
recovery copies were captured before either write. The two merged payloads were
schema-validated locally, written in place, immediately reread, schema-validated
again, and compared byte-for-byte with the intended payloads.

- Address Corrections retained file ID
  `1_nfoOtJiVtYka4Bt1SpounD_WptVyvF-` under governed folder
  `1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf`; 19 final corrections; readback SHA-256
  `333cefefc28d6b991322aa5177302db2287bd6db67a1d5baa436c8f8a67f94c7`.
- Manual Work retained file ID
  `1rP8MuuNECdpmJcjlY-f2l9_ZUNWPeyTO` under the same governed folder; 7 final
  properties and 1 template; readback SHA-256
  `a4c618a635426047db33f422ca709c694644020e9561f53a26dc9d01c0e85c6f`.
- Superseded business Manual Work identity
  `property_8c7a6598-b8b5-4bd8-a20f-2cfbff2399c2` remains recorded in the
  immutable recovery ledger. It was not added as a second live identity.
- The business-folder source files were not changed; their IDs, parents,
  byte sizes, and preexisting modified timestamps remained unchanged.

No ownership, permission, folder placement, Inbox, Route Order, Gig Handoff,
Backup, workbook, IAM/OAuth, merge, deployment, or deletion operation occurred.
