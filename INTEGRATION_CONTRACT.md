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

## When extra work is not required

A change that clearly cannot affect the handoff needs only one sentence in its change record: `No workbook/router integration impact.` It does not require opening the other repository, a companion pull request, cross-project tests, or extra approval.

Use only the tests and smoke checks that cover the changed handoff behavior. This contract must not turn unrelated workbook-only or app-only work into a larger process.
