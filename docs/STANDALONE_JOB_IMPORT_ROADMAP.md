# Standalone Job Import Roadmap

## Purpose

Make Free Map Router independently usable without removing or weakening the
InspectorADE workbook handoff.

The finished app will support three separate ways to receive route stops:

1. Workbook Drive inbox
2. Local file import
3. Manual entry or paste

All accepted stops will enter one common review, correction, duplicate, pin,
selection, optimization, Google Maps, and Garmin workflow.

## Target architecture

```text
Workbook Drive Inbox -----------+
                                |
Local CSV / spreadsheet file ---+--> Import Review
                                |         |
Manual entry / pasted list -----+         v
                                      Accepted Stops
                                           |
                                           v
                                   Address Readiness
                                           |
                          +----------------+----------------+
                          |                                 |
                          v                                 v
                  Existing Free Optimizer          Google Road Optimizer
                          |                                 |
                          +----------------+----------------+
                                           |
                                           v
                                  Visible Route Order
                                           |
                          +----------------+----------------+
                          |                                 |
                          v                                 v
                    Google Maps Sections             Garmin GPX
```

The workbook is one source in this architecture. It is not the app's database
and it is not required for direct-file routes.

## Design principle — one import pipeline

The app should not build unrelated parsers that each write saved data in a
different way.

Every source should produce a common staged stop record containing at least:

- proposed address;
- original address;
- route source label: GIS, DCFS, or blank;
- import origin: workbook, file, or manual;
- optional job reference;
- coordinates and pin strength when already available;
- correction status;
- duplicate status;
- accepted/rejected status.

Only reviewed and accepted staged records may enter normal saved-stop storage.

## Phase 0 — documentation and sample inventory

Deliverables:

- standalone import and address-correction contract;
- this roadmap;
- file-type and header inventory;
- sanitized representative input fixtures;
- exact Level 3 impact record before runtime work.

Collect representative samples for:

- GIS InspectorADE CSV;
- DCFS InspectorADE CSV;
- mixed or unknown CSV;
- a file with malformed spacing;
- a file containing duplicates;
- a file with missing city, state, or ZIP;
- a file containing a known wrong or uncertain address;
- `.xlsx` and `.xls` examples only when those formats are truly needed.

Exit condition:

- supported first-stage file formats and headers are known from real samples;
- no live app behavior changed;
- no customer file is committed to GitHub.

## Phase 1 — common import staging model

Create an app-owned staging layer used by all future local import paths.

Responsibilities:

- preserve raw input separately from proposed output;
- normalize safe formatting;
- retain `originalAddress`;
- carry import origin separately from GIS/DCFS source;
- detect duplicates before saved data changes;
- report accepted, rejected, duplicate, and unresolved counts;
- apply no changes until the operator confirms the review.

The existing workbook inbox must remain backward-compatible while being adapted
to the same internal staging model where practical.

Exit condition:

- fixed fixtures prove no import writes before confirmation;
- cancelled or failed imports preserve the current route and saved stops;
- workbook inbox behavior remains unchanged from the operator's perspective.

## Phase 2 — direct CSV import

Add a local file picker to the Import Addresses page.

First-stage behavior:

1. Operator chooses one CSV file.
2. App reads it locally in the browser.
3. App detects a supported header pattern.
4. App shows every proposed route stop in Import Review.
5. Operator resolves ambiguous source or address rows.
6. Operator accepts the reviewed rows.
7. Accepted rows are saved and optionally selected for the current route.

Required support:

- standard CSV quoting;
- commas inside quoted values;
- line-ending differences;
- UTF-8 text;
- separate or combined address columns;
- recognizable GIS/DCFS source fields;
- safe rejection of unsupported structures.

Exit condition:

- real sanitized GIS and DCFS CSVs import correctly;
- repeated import creates no duplicate physical stops;
- all accepted rows can be routed without the workbook.

## Phase 3 — governed address correction

Add one app-owned address-correction pipeline.

Order of operations:

1. Preserve raw address.
2. Apply safe whitespace, capitalization, and punctuation normalization.
3. Apply only exact approved correction-table rules.
4. Compare against existing saved aliases and pins.
5. Mark house-number, street-identity, city, state, or ZIP disagreement for
   review.
6. Optionally geocode unresolved accepted addresses using the existing controlled
   geocoder workflow.
7. Require manual confirmation or pin placement where confidence is inadequate.

The correction pipeline must be shared by local file, manual, and workbook
imports where doing so does not change the workbook inbox contract.

Exit condition:

- known malformed examples are corrected consistently;
- original values remain visible and recoverable;
- no test permits a silent house-number change;
- manual pins remain strongest.

## Phase 4 — source and origin display

Update the Addresses and Import Review pages to show origin without changing
approved route labels.

Examples:

```text
420 NW GRANITE AVE
Route source: GIS
Imported from: Local File
```

```text
2194 SW 56TH ST
Route source: DCFS
Imported from: Workbook
```

A stop that has arrived from more than one origin may display:

```text
Imported from: Workbook, Local File
```

Build Route and Garmin continue to show only the approved route source label,
not the import origin.

Exit condition:

- operator can tell where a saved stop came from;
- GIS/DCFS labels remain unchanged;
- MCS is never introduced as a dedicated route source.

## Phase 5 — spreadsheet support

Add `.xlsx` only after CSV is stable and real samples prove a need.

Requirements:

- use a pinned, reviewed parser bundled with the app;
- do not rely on an uncontrolled CDN script;
- treat formulas as data, never executable code;
- support the same staging and review model as CSV;
- reject encrypted, damaged, unsupported, or oversized files safely.

Legacy `.xls` support is a separate decision because it adds parser and fixture
complexity. It must not delay a useful CSV release.

Exit condition:

- spreadsheet imports produce the same staged records as equivalent CSVs;
- no file is uploaded merely to parse it;
- security and license review are complete.

## Phase 6 — route readiness panel

Before optimization, show a clear summary:

- selected stop count;
- GIS count;
- DCFS count;
- blank-source count;
- workbook-origin count;
- file-origin count;
- manual-origin count;
- manual-pin count;
- geocoded count;
- unresolved-coordinate count;
- duplicate addresses collapsed;
- addresses requiring review.

Optimization must be blocked only for problems that truly make a complete route
unsafe, such as missing coordinates or unresolved duplicate identity.

Exit condition:

- operator can verify the batch before free or Google optimization;
- unresolved stops cannot disappear silently.

## Phase 7 — Google optimization compatibility

Standalone imports must feed the same complete selected route used by Google
road-aware optimization.

The Google backend receives only:

- opaque stop IDs;
- Home coordinates;
- accepted stop coordinates;
- approved objective and request metadata.

It does not need to know whether a stop came from the workbook, a file, or manual
entry, and it does not receive source labels or original file contents.

Exit condition:

- one file-imported 60–70 stop batch is returned exactly once per stop;
- Google Maps and Garmin preserve the returned order;
- a Google failure leaves the file-imported route intact and usable with the
  existing free optimizer.

## Phase 8 — backup, restore, and recovery

Update backup and restore validation only as needed for optional origin and alias
metadata.

Required behavior:

- old backups remain loadable;
- new backups preserve accepted origins and aliases;
- restoring an old backup may lose optional origin history but not the address,
  ID, notes, or strongest pin;
- restore does not re-read the original local file;
- deleted stops may be reintroduced only through an intentional restore or
  import, with the existing confirmation behavior.

Exit condition:

- round-trip backup tests pass;
- pre-change rollback commit is recorded;
- no workbook data is required to recover file-imported routes.

## Phase 9 — real workflow validation

Validate these full workflows:

### Workbook route

Workbook → Drive inbox → Import Review/readiness → optimization → Google Maps →
Garmin

### Local GIS file route

GIS CSV → Import Review/correction → optimization → Google Maps → Garmin

### Local DCFS file route

DCFS CSV → Import Review/correction → optimization → Google Maps → Garmin

### Mixed-source route

Workbook stops + local file stops + manual stop → duplicate review → one complete
route → Google Maps → Garmin

Use realistic batches of approximately:

- 15 jobs;
- 25 jobs;
- 50 jobs;
- 70 jobs.

Exit condition:

- every accepted stop appears exactly once;
- route labels are correct;
- origin display is correct;
- duplicate physical stops do not create unnecessary visits;
- address corrections are approved and traceable;
- Garmin receives the same final visible order.

## Protected behavior

The project must preserve:

- current workbook inbox compatibility;
- workbook `Job_Log` authority;
- independent print and router actions;
- Home start and finish;
- GIS/DCFS source rules;
- MCS prohibition;
- manual pin strength;
- current free optimizer;
- optional Google optimizer contract;
- Google Maps section continuity;
- Garmin naming and complete route order;
- Clear Route and Delete All distinctions;
- Drive backup behavior unless explicitly changed under a separate impact record.

## Recommended implementation order

1. Finish documentation and collect real sanitized samples.
2. Build common staging and review behavior.
3. Add CSV import.
4. Add governed address correction and readiness display.
5. Validate workbook and local-file routes together.
6. Add optional Google optimization.
7. Add `.xlsx` only after CSV is proven.
8. Consider legacy `.xls` last.

This order gives the app useful independence before adding the more complex paid
routing service.

## Change level and approval

This roadmap is Level 1 documentation.

Runtime work is Level 3 because it may change import behavior, stored metadata,
duplicate merging, address correction, and route inputs. Each runtime phase must
use a dedicated branch and pull request, exact impact record, focused tests,
complete final verification, rollback plan, and explicit operator approval
before merge.

The workbook remains a separate source. A companion workbook change is required
only when a runtime proposal changes the existing inbox schema or meaning.
