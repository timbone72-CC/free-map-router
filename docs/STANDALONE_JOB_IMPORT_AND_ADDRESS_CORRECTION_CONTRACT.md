# Standalone Job Import and Address Correction Contract

## Purpose

This contract defines how Free Map Router may accept jobs directly from local
files without requiring the InspectorADE workbook, while preserving the
workbook as a separate supported source.

The goal is to make the router independently usable for route building without
turning it into a replacement for the workbook's forecasting, completion,
conflict, or historical job-management functions.

## Source model

The app must keep these concepts separate:

- **Import origin** — how the stop entered the app:
  - `workbook`
  - `file`
  - `manual`
- **Route source label** — the approved agency label shown in route output:
  - `GIS`
  - `DCFS`
  - blank

`MCS` must not be introduced as a dedicated route source label.

A local file import must never be labeled `GIS` or `DCFS` merely because it came
from a file. The agency label must come from a recognized field, a reliable file
rule, or explicit operator selection during review.

## Independent operation rule

The app must be able to:

1. open without the workbook;
2. import a supported local file directly in the browser;
3. review and correct imported addresses;
4. save accepted stops in the app;
5. select stops for one route;
6. optimize with the existing free optimizer or the optional Google optimizer;
7. create Google Maps sections;
8. create one Garmin GPX preserving the visible route order.

No workbook connection, workbook Drive inbox, Apps Script execution, or workbook
permission may be required for this direct-file workflow.

## Workbook compatibility rule

The workbook remains a fully supported independent source through the existing
`Free Map Router Address Inbox.json` handoff.

Direct-file import must not:

- change the workbook inbox filename;
- change the workbook inbox schema;
- change workbook-selected order meaning;
- rewrite `Job_Log`;
- write anything back to the workbook;
- require the workbook to understand file-origin metadata;
- prevent older address-only workbook inboxes from loading.

The app may receive stops from the workbook, local files, and manual entry in the
same saved-address collection.

## Initial file support

The recommended staged support is:

### First production stage

- InspectorADE-style CSV files;
- ordinary CSV files containing recognizable address columns;
- pasted address lists as an existing or parallel local input path.

### Later stage after sample validation

- `.xlsx` files;
- legacy `.xls` files only when a safe, pinned, locally bundled parser is
  approved and tested.

Spreadsheet support must not be implemented through an unpinned remote script.
The parser and license must be reviewed before it is added to the public app.

## Local-processing rule

Local file contents should be parsed in the browser whenever practical.

Before the operator explicitly chooses a service that needs routing or geocoding
inputs, the app must not upload the original file to:

- Google Cloud;
- Google Route Optimization;
- Geoapify;
- GitHub;
- Google Drive;
- any analytics or logging service.

Only the minimum accepted stop information may later be sent to an approved
geocoder or route optimizer under its separate contract.

## Import review gate

A local file must never write directly into saved stops without an import review
step.

The review must show at least:

- detected address;
- proposed corrected address;
- city, state, and ZIP when available;
- agency source label or blank;
- import origin `File`;
- accepted, rejected, duplicate, and unresolved status;
- reason for any correction or rejection.

The operator must be able to accept or reject rows before saved data or the
current route is changed.

A failed or cancelled import leaves saved stops and the current route unchanged.

## Address extraction rule

The parser may recognize address components from known headers and safe aliases,
including separate fields for:

- street address;
- city;
- state;
- ZIP code;
- full address;
- agency or client source;
- optional job reference used only for review or traceability.

Header matching must be explicit and tested. The app must not guess arbitrary
numeric or text columns as addresses.

When the file structure is ambiguous, the operator must select or confirm the
address columns before import continues.

## Address correction levels

Address correction has three separate levels.

### Level A — safe formatting normalization

The app may automatically normalize formatting that cannot reasonably change the
physical destination, such as:

- repeated spaces;
- missing spaces between recognized address components;
- capitalization;
- standard punctuation;
- known street-suffix formatting;
- exact approved correction-table matches.

The original file value must remain available as `originalAddress` or equivalent
trace data.

### Level B — verified exact correction rules

An exact governed correction table may change a known malformed address only
when the complete normalized original value matches an approved rule.

Rules must:

- be deterministic;
- include tests for the exact original and corrected values;
- preserve the original value;
- never apply through a loose partial match;
- never infer a different house number.

### Level C — geocoder or map suggestion

A geocoder may suggest a different formatted address or location, but the app
must not silently accept a suggestion that changes:

- house number;
- street name identity;
- city;
- state;
- ZIP code;
- physical coordinates beyond the approved confidence rule.

Such changes require operator review. The app must clearly distinguish a
formatting correction from a possible destination change.

## House-number protection

The app must never silently change a house number.

A house-number difference must be treated as an unresolved address requiring
operator confirmation or a manual pin. The same protection applies to unit
numbers when they are relevant to reaching the correct property.

## Geocoding and pin-strength rule

- Manual pins remain authoritative.
- A file import must not weaken or replace an existing manual pin.
- A new geocoded result may fill missing coordinates after operator acceptance.
- A lower-confidence result must not replace stronger saved coordinates.
- An address with uncertain coordinates must remain visibly unresolved until the
  operator corrects it or places a manual pin.

## Duplicate handling

The app must detect repeated physical addresses across:

- the same file;
- repeated imports of the same file;
- workbook imports;
- earlier local-file imports;
- manual entries.

Repeating the same import must be idempotent: it must not create another saved
stop merely because the file was selected again.

When duplicate physical addresses are combined, the app must preserve:

- the existing stable stop ID where possible;
- strongest/manual pin;
- notes;
- approved GIS or DCFS source;
- original-address aliases;
- import-origin trace showing that the address may have arrived from more than
  one origin.

The route itself should contain one physical stop for one physical address unless
a separately approved requirement proves two visits are necessary.

## Job-detail boundary

The first standalone-import version imports route stops, not a second complete
workbook database.

It may retain a limited job reference for operator review, but it must not claim
to reproduce workbook features such as:

- repeat-job forecasting;
- turn-in history;
- completion workflow;
- conflict resolution;
- cancellation history;
- prediction grading;
- authoritative job history.

Those remain workbook responsibilities.

## Route-order rule

Import order and optimized order are different concepts.

- Accepted file rows may initially enter the route in file order.
- The operator may preserve that order manually or optimize it.
- The free optimizer and Google optimizer may replace route order only after
  their own validation rules pass.
- Google Maps and Garmin exports must use the final visible Build Route order.

## Error and partial-file rule

The import must stop safely when:

- the file cannot be read;
- required headers cannot be identified;
- no valid address rows are found;
- the file type is unsupported;
- the parser reports corruption;
- the row count exceeds the approved import limit;
- a correction rule produces invalid output.

A partial parser failure must not quietly import only the rows read before the
failure. The review must state the total rows examined and the accepted,
rejected, duplicate, and unresolved counts.

## Initial limits

The first production version should use explicit limits, including:

- one selected file per import action;
- maximum 1,000 file rows examined;
- maximum 200 accepted route stops per import;
- maximum 100 selected stops per Google optimization request;
- no background folder watching;
- no automatic re-import when a file changes;
- no automatic API call after file selection.

Changing these limits requires measured testing and a separate impact review.

## Storage and backup rule

Accepted file-imported stops use the app's normal saved-stop storage and backup
behavior.

Any new `importOrigin`, original-address alias, or job-reference field must be:

- optional;
- backward-compatible;
- safely ignored by older backups when possible;
- included in schema migration tests;
- excluded from Google routing requests unless explicitly required.

Restoring an old backup may remove newer import-origin information, but it must
not corrupt the address or pin.

## Security rule

The app must reject executable file content and never evaluate imported cell
text as HTML, JavaScript, formulas, or URLs.

Imported values must be treated as plain text. Spreadsheet formulas must not be
executed. Error messages and previews must use safe text rendering.

## Required tests

Runtime implementation must include tests for:

- InspectorADE CSV with separate address columns;
- CSV with one full-address column;
- quoted commas and multiline-safe CSV handling;
- missing and ambiguous headers;
- empty and damaged files;
- 1,000-row hard limit;
- repeated import idempotence;
- duplicates across workbook, file, and manual origins;
- exact correction-table migration;
- house-number mismatch requiring review;
- preservation of `originalAddress`;
- manual pin preservation;
- GIS/DCFS detection and ambiguous-source review;
- MCS prohibition;
- cancelled review leaving state unchanged;
- accepted rows entering the route in reviewed order;
- Google Maps and Garmin preserving the final visible order;
- backup and restore compatibility.

## Change classification

This document is Level 1 planning.

Runtime implementation is Level 3 because it introduces local-file parsing,
possible stored-data schema additions, automatic address normalization,
duplicate merging, and a second import path.

It requires a dedicated implementation branch, realistic sanitized file
fixtures, complete tests, explicit rollback steps, and explicit operator
approval before merge.
