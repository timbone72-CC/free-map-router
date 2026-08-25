# Workbook ↔ Free Map Router Integration Contract

## Connected projects

- Upstream workbook: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`
- Downstream app: `timbone72-CC/free-map-router`
- Forward handoff: workbook → `Free Map Router Address Inbox.json` → app
- Route-order return: app → `Free Map Router Route Order.json` → workbook
- Manual-gig handoff: app → `Free Map Router Gig Handoff.json` → workbook `Gig_Log`

## When the other project must be checked

Inspect both repositories before changing either side only when the proposed change can affect:

- exported address text;
- the optional `GIS` / `DCFS` source;
- selected-job order;
- duplicate-address handling;
- the inbox filename, Drive folder, JSON version, JSON structure, field names, or field meaning; or
- how the app imports, merges, replaces, or preserves workbook-sent stops; or
- workbook Order IDs, displayed stop numbers, the route-order return filename,
  or how the workbook clears and applies returned Route Number values; or
- the manual-gig handoff filename/version/fields, immutable `Gig_ID`, or workbook `Gig_Log` ownership/stale-write rules.

When triggered, the change record must say whether the other project remains compatible or needs a companion change. Do not merge or deploy an incompatible one-sided change. Keep one side backward-compatible during ordered deployment whenever practical.

## Risk-matched integration testing

During development, run only focused handoff tests in each repository whose runtime changes. Before merge, run one complete suite on the final runtime head of each runtime-changed repository. Do not rerun unrelated suites after every small correction, and do not run runtime tests in a repository receiving documentation only. `TESTING_CONTRACT.md` controls failure-stop behavior and reuse of a valid final result.

## Corrected output addresses

The workbook may send optional `originalAddress` values beside a corrected `address` when output-only formatting changes visible address text. The app retains every distinct exact original alias for the corrected route entry, migrates only saved stops whose normalized full address exactly matches one of those aliases, and then de-duplicates them into one corrected stop while preserving the strongest pin and other saved data. The field is optional, is not stored as a second stop, and older address-only inboxes remain valid.

When the operator corrects an address inside Free Map Router, the app retains
the prior exact normalized full address as a hidden alias on that same saved
stop. A later raw workbook address that exactly matches that alias resolves to
the corrected stop, preserves its dedicated GIS/DCFS source and pin, and
attaches the inbox's exact Order IDs to that stop's pending route entry. The
raw address is not recreated as a second stop. Fuzzy, partial, coordinate,
label, client, and inferred alias matching are prohibited.

## Route-order return

The workbook may send optional `orderIds` beside one de-duplicated physical
address. The app preserves them inside the specific pending, Google, and Basic
route snapshots instead of treating them as permanent address identity. The
manual return file is named **Free Map Router Route Order.json** and contains
the selected route slot, optimization status, source export time, sent time,
and visible stop number with its real Order IDs. Address text is audit context
only; the workbook must match jobs by exact Order ID.

The app-side file write and workbook-side clear/write/rebuild must remain
backward-compatible during ordered deployment. The app may create the return
file before the workbook receiver is published; the workbook must ignore a
missing file and reject damaged, duplicate, stale, or structurally invalid
return data without clearing Route Number values.

## Manual-gig handoff

Phase 2C adds a separate explicit app → workbook handoff named **Free Map Router Gig Handoff.json** in the existing governed Free Map Router folder. It uses the existing limited `drive.file` permission and is written only when the operator presses **Sync Gigs to Workbook** on the Manual Gigs surface. Saving/editing/completing a gig, starting a route, syncing the Manual Work Library, opening the app, and Dashboard activity do not write this file automatically.

`gigHandoffVersion: 1` carries a snapshot of current manual gig occurrences. Each row is identified only by immutable `gigId` and may mirror source (`HNP` or `OTHER`), attached address, work-order/job ID, expected pay, due date, completed date, notes, and the gig's `updatedAt`. It never carries InspectorADE Order IDs, GIS/DCFS source, route membership, repeat-template identity, Home, prediction fields, or workbook-owned Actual Pay.

The workbook companion validates the full payload before planned writes and upserts `Gig_Log` by exact `Gig_ID` only. Address and work-order text are never identity substitutes. A newer FMR timestamp may update only FMR-owned mirror fields; an older incoming row is skipped; same timestamp with different FMR-owned content is ambiguous and must stop rather than guess. A later handoff that omits a previously mirrored Gig_ID is not a deletion instruction. Existing `Gig_Log.Actual_Pay` is workbook-owned and may never be overwritten or cleared by this handoff.

A duplicate exact Drive handoff file, duplicate incoming Gig_ID, duplicate existing `Gig_Log.Gig_ID`, malformed required field, or damaged timestamp/date/pay must fail closed. Phase 2C does not write InspectorADE `Job_Log`, archive, prediction/history, or route-order state.

## When extra work is not required

A change that clearly cannot affect the handoff needs only one sentence in its change record: `No workbook/router integration impact.` It does not require opening the other repository, a companion pull request, cross-project tests, or extra approval.

Use only the tests and smoke checks that cover the changed handoff behavior. This contract must not turn unrelated workbook-only or app-only work into a larger process.
