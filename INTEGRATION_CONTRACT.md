# Workbook ↔ Free Map Router Integration Contract

## Connected projects

- Upstream workbook: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`
- Downstream app: `timbone72-CC/free-map-router`
- Forward handoff: workbook → `Free Map Router Address Inbox.json` → app
- Return handoff: app → `Free Map Router Route Order.json` → workbook

## When the other project must be checked

Inspect both repositories before changing either side only when the proposed change can affect:

- exported address text;
- the optional `GIS` / `DCFS` source;
- selected-job order;
- duplicate-address handling;
- the inbox filename, Drive folder, JSON version, JSON structure, field names, or field meaning; or
- how the app imports, merges, replaces, or preserves workbook-sent stops; or
- workbook Order IDs, displayed stop numbers, the route-order return filename,
  or how the workbook clears and applies returned Route Number values.

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

## When extra work is not required

A change that clearly cannot affect the handoff needs only one sentence in its change record: `No workbook/router integration impact.` It does not require opening the other repository, a companion pull request, cross-project tests, or extra approval.

Use only the tests and smoke checks that cover the changed handoff behavior. This contract must not turn unrelated workbook-only or app-only work into a larger process.
