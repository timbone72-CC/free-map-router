# Workbook Route Recovery Impact Record

## Change level

Level 3 because this changes the workbook-to-router synchronization recovery path. It does not change storage schemas, Drive scopes, file names, JSON fields, route ordering, or deployment configuration.

## Problem and evidence

The live workbook confirmed that 11 checked addresses were sent. The exact Drive inbox file was updated at 2026-08-15T15:18:40.522Z and contains the 11-address version-1 payload. The public optimizer health endpoint returned healthy, while Build Route remained indefinitely on **Checking for new route…**.

The regression followed durable correction loading: an automatic business-authenticated inbox check entered `syncWorkbookInboxFrom`, which called `requestDriveToken()` while no in-memory Drive access token existed. That interactive consent request could remain hidden in the installed app window, so the import never completed or reported a recovery action.

## Approved behavior and scope

- Automatic checks must never wait indefinitely for hidden interactive Drive consent.
- If the limited Drive token is not already present, the automatic check fails closed before importing and tells the operator to tap **Check Workbook Route**.
- Build Route provides **Check Workbook Route**. That explicit action requests the existing limited `drive.file` access, loads the inbox and permanent correction record, and uses the existing protected import path.
- A stalled backend read times out after 15 seconds and directs the operator to the same manual recovery control.
- The existing automatic check remains available when required credentials are already in memory.

Owning runtime files:

- `app.js`: Drive-token gate, manual recovery action, and route status.
- `index.html`: manual recovery control and cache-version increments.
- `google-route-browser.js`: bounded backend inbox request.
- Focused tests: `tests/manual-drive-backup.test.js` and `tests/google-route-browser.test.js`.

## Read and write surfaces

Reads:

- Existing `Free Map Router Address Inbox.json`.
- Existing `Free Map Router Address Corrections.json`.
- Existing in-memory Google identity and limited Drive token.

Writes:

- Existing local saved addresses and pending route only after both inbox and correction reads succeed.
- No new Drive write, workbook write, storage field, or backup behavior.

## Protected behavior

- A correction-load failure stops the workbook import before an old address can be recreated.
- Existing Home, saved stops, pins, Google Route, Basic Route, pending route, API key, and backups remain unchanged until a valid inbox is accepted.
- Newer inboxes stage **New Route Available** without replacing either usable route.
- Older or same inboxes retain existing route slots.
- Address identity, GIS/DCFS source, Order IDs, route order, optimizer choice, and return-to-workbook behavior are unchanged.
- Drive permission remains `https://www.googleapis.com/auth/drive.file`.

## Integration compatibility

The upstream workbook output was inspected through the real current inbox. It remains a valid version-1 payload with the existing file name, folder, address fields, optional corrected-address fields, GIS/DCFS source, and Order IDs. No workbook runtime or contract change is required.

## Required and optional data

Required:

- Valid business Google identity for the private backend check.
- Explicit limited Drive authorization before correction-aware import.
- Valid version-1 inbox payload.
- Readable permanent correction record when present.

Optional:

- Permanent correction file may be absent; the existing empty correction-record behavior remains valid after Drive access is established.
- Automatic backend refresh may fail or time out; manual Drive recovery remains available.

## Hard limits and stale behavior

- Automatic backend inbox read timeout: 15 seconds.
- Existing inbox size, schema validation, stale-export confirmation, older-route rejection, and duplicate-file rules remain unchanged.
- A timeout, missing Drive token, denied consent, damaged inbox, or correction read failure imports nothing and preserves the prior app state.

## Validation plan

Focused automated coverage:

- automatic check does not request interactive Drive consent;
- missing limited Drive token fails closed with the manual recovery instruction;
- manual Build Route control requests Drive access and uses the existing inbox loader;
- stalled backend read returns a bounded timeout;
- successful automatic and manual paths retain existing route-status behavior.

Final gate:

- `npm test`;
- `for file in *.js; do node --check "$file"; done`;
- inspect the final diff for only the recorded files and blocks.

Affected live smoke check after publication:

1. Send checked jobs from the live workbook.
2. Open Build Route.
3. If prompted, tap **Check Workbook Route** and approve the existing limited Drive access.
4. Confirm **New Route Available** appears.
5. Start the new route and confirm every workbook address appears once while existing Google and Basic routes remain protected until confirmation.

## Risks and recovery

Primary risks:

- prompting for Drive access from the explicit button could be denied;
- a timeout could expose a backend latency problem instead of completing automatically;
- bypassing correction validation could recreate an old address, so the fix explicitly fails closed and does not bypass it.

Rollback point: `12a2c555fc3035c6f016d83231af9c1e6f26558d`.

Failure recovery:

- do not merge if focused or full verification fails;
- if the live check fails after publication, restore the rollback commit before further changes;
- the workbook inbox and existing app data remain recoverable because this change performs no migration, deletion, or new automatic write.

## Approval status

Implementation authorization: user approved the fix on 2026-08-15.

Explicit Level 3 pre-merge operator approval: pending.
