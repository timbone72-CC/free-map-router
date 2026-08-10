# Backend Workbook Inbox Reader — Level 3 Impact Record

## Problem and evidence

The workbook writes the live route inbox into a folder owned by
`timbone72@gmail.com`, while Google Optimize uses the business Google account.
The browser's narrow `drive.file` connection cannot use one token as both
accounts. The operator shared the exact live folder with the existing private
backend service account, but the backend currently has no route-file reader.

## Approved behavior and scope

Add a read-only private-backend endpoint at `GET /workbook-inbox`. After the
existing business-account identity check succeeds, the backend service account
locates exactly **Free Map Router Address Inbox.json** under folder
`1DEqVNh2-Z8RkzMftxd4vOxsahRwD3mvf`, opens it, validates the existing inbox
contract, and returns that unchanged JSON.

This piece does not change either browser sign-in, connect the phone app to the
endpoint, apply a route, write a backup, or change the workbook.

Owning files:

- `workbook-inbox-reader.js`: exact-folder lookup, read-only Drive access,
  size boundary, and inbox validation.
- `google-route-server.js`: authenticated endpoint and response boundary.
- focused backend tests: access, exact targeting, validation, and failure cases.

## Read and write surfaces

Reads:

- the exact approved Drive folder;
- one exact inbox filename inside that folder; and
- the existing JSON fields governed by `inbox.js`.

Writes: none. The reader issues only Drive `GET` requests. It does not create,
edit, move, rename, share, or delete any Drive item, and it does not write
browser storage, route history, saved addresses, pins, Home, settings, or the
workbook.

## Data, permissions, limits, and stale output

Required data remains `app`, `inboxVersion`, `source`, `updatedAt`, and
`addresses`. Optional address fields remain unchanged. The filename, folder,
JSON version, structure, and meanings are unchanged.

The backend requests only Google's `drive.readonly` scope and relies on the
folder permission the operator already granted to
`fmr-route-runtime@free-map-router.iam.gserviceaccount.com`. It does not widen
the browser's `drive.file` permission or gain access to either account's whole
Drive. The response is limited to 256 KiB and uses `no-store`. Missing,
duplicate, unreadable, oversized, or invalid inboxes fail closed. This piece
does not decide whether an export is newer, the same, or older; existing app
logic will retain that responsibility when integration is separately approved.

## Protected behavior and risks

- The endpoint is unavailable until the existing approved business Google
  identity authenticates.
- Google Optimize behavior and its request contract remain unchanged.
- Current and Previous routes, saved addresses, corrected addresses, manual
  pins, Home, backups, Garmin, Google Maps, and the five-page UI remain
  unchanged.
- No browser polling, service worker, cache, or page control changes.
- The primary risks are selecting a similarly named file elsewhere, exposing
  the inbox without authentication, writing to Drive, or accepting damaged
  data. Exact parent/name matching, existing authentication, read-only calls,
  and shared inbox validation address those risks.

## Tests, safe validation, and rollback

Focused tests:

```bash
node --test tests/workbook-inbox-reader.test.js tests/google-route-server-auth.test.js
```

The fixtures use an injected fake Drive client and do not contact or change
Google Drive. The final gate is one complete `npm test` run plus root JavaScript
syntax checks on the final head.

Safe live smoke check after explicit merge approval: authenticate as the
business account, request `/workbook-inbox`, and confirm its `updatedAt` and
addresses match the workbook's current inbox. Do not apply or save that route
in this change.

Rollback point: live `main` before this branch, including PR #32. Before merge,
abandon the branch. After publication, revert this pull request or return Cloud
Run traffic to the preceding verified revision. No stored-data recovery or
migration is required because the change performs no writes.

## Approval status

Implementation is authorized by the operator's **Next** instruction for the
previously defined backend-reader piece. Explicit Level 3 approval is still
required after the final diff and tests and before merge.
