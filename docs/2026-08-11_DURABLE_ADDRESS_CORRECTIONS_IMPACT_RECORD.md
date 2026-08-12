# Durable Address Corrections — Level 3 Impact Record

## Status and approved scope

Implementation was authorized on 2026-08-11. Explicit pre-merge operator
approval is required and is not yet recorded.

Free Map Router will make each manual address correction durable outside
browser storage. The app writes only an app-owned Google Drive correction
record containing original address aliases, corrected display addresses,
dedicated `GIS`/`DCFS` source, and the corrected stop's strongest pin. Before
the app imports a workbook route, it loads that record and applies exact alias
matches to the inbox. The workbook remains authoritative for raw job data and
for current Order IDs.

## Exact problem and evidence

The released address-identity fix correctly merged `RR1 BOX 3240, Elk City,
OK 73644` into `11202 N 2020 RD, Elk City, OK 73644` in the same browser. Its
alias and source were stored only inside browser storage, however. A cleared,
restored, or different browser had no alias and therefore re-imported the RR
address. That made the earlier claim of permanent correction memory incorrect.

## Approved behavior

- Correcting an address writes or updates exactly one file named **Free Map
  Router Address Corrections.json** inside the existing app-owned **Free Map
  Router** Drive folder.
- The record uses exact normalized full-address aliases only. It never uses
  partial, fuzzy, coordinate, label, client, or inferred matching.
- The record retains the corrected address, dedicated source, and strongest
  pin. A fresh inbox source takes precedence when the workbook supplies one.
- A raw workbook resend matches the correction record before normal stop
  de-duplication, so it creates or selects the corrected stop once and carries
  the fresh Order IDs into the pending route.
- Order IDs are deliberately excluded from durable correction memory. They are
  job-specific and remain in the current pending, Google, and Basic snapshots.
- Normal recovery backups remain manual. No ordinary Home, route, selection,
  pin, note, label, import, or optimization action writes to Drive.

## Ownership, reads, and writes

| Surface | Access | Behavior |
| --- | --- | --- |
| `address-corrections.js` | Read/write correction JSON model | Validates, merges, and applies exact aliases. |
| `google-drive.js` | Read/write one app-owned JSON file through existing `drive.file` access | Creates, finds, updates, and reads exactly one correction file. |
| `app.js` | Reads correction record before inbox merge; writes it after a manual address correction | Keeps correction memory durable without changing the workbook. |
| Workbook and route-order file | No new access or field changes | Stay fully compatible. |

## Data, limits, and failure recovery

The correction record version is `1`. It contains no passwords, API keys,
Google credentials, labels, notes, Home, routes, or workbook Order IDs. Older
devices and backups remain valid because aliases remain optional stop fields.
The existing `drive.file` permission, Drive folder, and Google account flow do
not change.

When a correction is saved, a failed Drive request leaves the local correction
in place and displays a clear not-permanent status. Before an inbox import, a
failed correction-record load stops that import; it never silently falls back
to recreating an address that may have a durable correction. Multiple matching
correction files also stop safely instead of choosing one.

Rollback point: `5dbf8a3`. Before merge, abandon this branch. After publication,
restore the prior release through the normal rollback path. The correction file
is harmless to the prior release and can remain in Drive.

## Verification and release checks

Focused fixtures cover correction-record parsing, exact RR alias application,
source precedence, manual-pin preservation, merging a pre-existing Drive
record, Drive file create/update/read, and safe failure behavior. Final checks
are the full `npm test` suite and root JavaScript syntax checks on the finished
head. The live check corrects the RR job, confirms the permanent-save message,
refreshes/reloads, resends the raw RR job from the workbook, and confirms one
checked corrected address with its DCFS/GIS source on Build Route.
