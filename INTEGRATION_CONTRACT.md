# Workbook ↔ Free Map Router Integration Contract

## Connected projects

- Upstream workbook: `timbone72-CC/inspectorade-drop-forecast-workbook-audit`
- Downstream app: `timbone72-CC/free-map-router`
- Handoff direction: workbook → `Free Map Router Address Inbox.json` → app

## When the other project must be checked

Inspect both repositories before changing either side only when the proposed change can affect:

- exported address text;
- the optional `GIS` / `DCFS` source;
- selected-job order;
- duplicate-address handling;
- the inbox filename, Drive folder, JSON version, JSON structure, field names, or field meaning; or
- how the app imports, merges, replaces, or preserves workbook-sent stops.

When triggered, the change record must say whether the other project remains compatible or needs a companion change. Do not merge or deploy an incompatible one-sided change. Keep one side backward-compatible during ordered deployment whenever practical.

## Risk-matched integration testing

During development, run only focused handoff tests in each repository whose runtime changes. Before merge, run one complete suite on the final runtime head of each runtime-changed repository. Do not rerun unrelated suites after every small correction, and do not run runtime tests in a repository receiving documentation only. `TESTING_CONTRACT.md` controls failure-stop behavior and reuse of a valid final result.

## Corrected output addresses

The workbook may send optional `originalAddress` values beside a corrected `address` when output-only formatting changes visible address text. The app retains every distinct exact original alias for the corrected route entry, migrates only saved stops whose normalized full address exactly matches one of those aliases, and then de-duplicates them into one corrected stop while preserving the strongest pin and other saved data. The field is optional, is not stored as a second stop, and older address-only inboxes remain valid.

## When extra work is not required

A change that clearly cannot affect the handoff needs only one sentence in its change record: `No workbook/router integration impact.` It does not require opening the other repository, a companion pull request, cross-project tests, or extra approval.

Use only the tests and smoke checks that cover the changed handoff behavior. This contract must not turn unrelated workbook-only or app-only work into a larger process.
