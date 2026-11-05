# Current Status and Open Issues — 2026-11-05

## Purpose and change control
Operator-requested repository checkpoint before work on stale address suggestions.
This is a **Level 1, documentation-only** change: no runtime code, data,
stored schema, authorization, routes, Drive files, deployments, or workbook
handoff are changed. No workbook/router integration impact.

Baseline reviewed: `main` at
`0802de87e2c9c11ccfc46819ecefc23b763ed82a` (merged PR #116).
The two November 5 runtime changes have their own detailed records:
- `docs/2026-11-05_DRIVE_SIGNIN_REUSE_CHANGE_RECORD.md`
- `docs/2026-11-05_SAVED_ADDRESS_FILTERS_CHANGE_RECORD.md`

## Changes completed and verified

### PR #115 — repeated Google Drive account chooser (Samsung A16)
- Merged into `main` on 2026-11-05. Earlier A16 behavior prompted for a
  business account repeatedly, unlike the primary Samsung phone.
- Fix keeps OAuth access tokens **in memory only**, stores a non-secret
  previously-verified-folder hint for possible grant reuse, deduplicates
  concurrent token requests, and retains chooser/folder-verification fallback.
- No changed Drive permission scope, saved stops, routes, backups, or backend
  contract. Automated tests and GitHub Pages deployment passed for the merge.
- Operator feedback after updating: *"as far as I know, it seems to work."*
  This is a positive preliminary device check, **not** confirmation that
  every Drive flow, reload, or edge case has been field-tested.
- Reference: https://github.com/timbone72-CC/free-map-router/pull/115

### PR #116 — saved-address search and source/location filters
- Merged into `main` on 2026-11-05; commit
  `0802de87e2c9c11ccfc46819ecefc23b763ed82a`.
- Added read-only search by address, label/notes, town, or company/source;
  dynamic filters for GIS, DCFS, Gigs, and each existing gig-company source;
  town and county filters; and matching-address counts. Filters start on
  **All** after an app reload.
- A company becomes available as a filter as soon as a saved gig uses it
  once. Multiple sources can label the **same saved stop** without creating
  a duplicate from the filter.
- Town is inferred only from sufficiently clear comma-delimited addresses.
  The stored saved-stop contract lacks a county field: **Unknown county** is
  expected and must not be replaced with guessed values.
- Verified on merged commit: full GitHub "Verify Contract and App" workflow
  passed (run 42092325349), and Pages build/deployment succeeded
  (run 42092324685).
- Operator's immediate live feedback: *"It looks like it works."* This is
  a positive basic smoke check, not a completed multi-device regression.
- Reference: https://github.com/timbone72-CC/free-map-router/pull/116

## Open issues — not fixed by these pull requests

### 1. Stale or uncorrected addresses in Create Address suggestions
**Next isolated issue.** The operator reports that after correcting an
address, its former/incorrect spelling can still appear as an address
suggestion. Desired result: show the corrected, usable address rather than
an obsolete suggestion, while still accepting future raw workbook imports.

Current code observation: `app.js::refreshAddressSuggestions()` populates the
saved-only suggestion list from `jobs[].address`, de-duplicates exact
case-insensitive strings, and caps visible suggestions at eight. It does
**not** directly include `addressAliases` or iterate the permanent Drive
address-corrections record. Therefore the **underlying reason is not yet
confirmed**; a remaining saved stop/duplicate or a separate browser suggestion
source must be distinguished before changing data or filtering rules.

Protection requirement: an old address may be a required **hidden alias**
used to match a future GIS/DCFS workbook export to the corrected stop.
Do **not** delete corrections, aliases, Order IDs, saved stops, or the Drive
correction record just to remove an obsolete *visible suggestion*. Inspect
the exact read-only source and reproduce first; then make a separate,
focused fix with tests, review, and normal publish checks.

### 2. Entering a new company name when adding/editing an address
The operator requested a source/company field with GIS, DCFS, and custom
company names such as HNP. **Not implemented as part of PR #116.**
PR #116 only exposes source names that are already present on saved gigs.
New input/edit behavior remains separate work; do not claim it is available.

### 3. Town/county classification gaps
County remains Unknown unless explicit county data exists. Non-comma
legacy formats can remain Unknown town. Adding persistent county metadata or
an address-parsing/geocoding expansion was **not** approved or implemented
with the read-only filters. Keep separate from the stale-suggestions fix.

## Protected behavior and next action
- Preserve saved stop identity, exact GIS/DCFS source, corrected address,
  hidden original-address aliases, pinned coordinates, workbook Order IDs,
  manual gigs, route selections, Google/Basic route history, Home, backups,
  and existing Google Drive permissions and files.
- No migration, deletion, broad deduplication, automatic Drive backup,
  or change to the InspectorADE workbook integration is authorized here.
- Next: inspect the **visible suggestion** path in read-only mode, verify the
  source of stale entries and reproduction, then implement/test only that
  behavior on a separate development branch. The next fix has **not** been
  implemented or deployed at this checkpoint.

## Record verification
This note was prepared from both merged pull requests, their existing change
records, the current `app.js` suggestion function, the address correction
contract/records, GitHub CI and Pages results, and the operator's reported
live observations. Documentation-only diff and governance review are required;
no runtime test is implied by a docs-only commit.
