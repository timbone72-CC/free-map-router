# Connected Workbook Inbox Refresh — Level 3 Impact Record

## Problem and evidence

After Free Map Router connects to Google Drive, it reads the workbook inbox
only once. Sending a later route while that connection remains active does not
update Current Route. The operator reported this directly after sending a
second route, and the existing click handler confirms there is no later inbox
read.

## Approved behavior and scope

While the existing short-lived Drive connection remains active, returning to
the app checks the existing workbook inbox. A newer export becomes Current and
moves the former Current to Previous. The same or an older export keeps Current
unchanged. No background polling, new button, new permission, or workbook
change is introduced.

## Classification and ownership

Level 3 because this changes cross-application synchronization and can
automatically replace Current Route with a newer workbook export.

- `app.js` owns Drive connection state, inbox application, route rendering,
  and the focus/visibility handlers.
- `index.html` owns the accurate Drive explanation and cache version.
- `CONTRACT.md` records the connected refresh behavior.
- `tests/drive-autosave.test.js` protects the connected refresh boundary.

Reads: the existing Drive inbox when the connected app becomes active.

Writes: the existing saved-address store, Current/Previous route history, and
the existing Drive backup only when a newer inbox is accepted.

## Data, permissions, compatibility, and limits

Required and optional inbox fields remain unchanged. There is no schema,
filename, folder, OAuth scope, permission, hard-limit, or workbook runtime
change. The upstream workbook remains compatible and needs no companion
deployment. Refresh occurs only on focus or return from a hidden state, only
with a valid in-memory Drive token, and overlapping events share one inbox
read. An expired connection asks the operator to reconnect.

## Protected behavior

- Same and older exports cannot replace the optimized Current Route.
- Newer exports rotate Current to Previous using the existing timestamp rules.
- Corrected addresses, manual pins, Home, route order, optimization, Garmin,
  Google Maps, backup compatibility, and the five-page menu remain unchanged.
- No timer, polling loop, or new Drive permission is added.

## Tests, smoke check, and rollback

Focused coverage verifies focus and visibility refresh, valid-token gating,
overlapping-event deduplication, and backup scheduling after a newer route.
The final gate is one complete `npm test` run plus root JavaScript syntax
checks. The affected smoke check is: connect Drive, send a newer workbook
route, return to the app, and confirm Current/Previous rotation without
pressing Connect again.

Rollback point before this change: `dc7e1e8`. Before merge, abandon this branch.
After publication, revert this pull request and restore the prior main release
if the connected refresh damages or fails to update route state.

## Approval status

Implementation is authorized by the reported failure. Explicit operator
approval is required after the final diff and tests and before merge.
