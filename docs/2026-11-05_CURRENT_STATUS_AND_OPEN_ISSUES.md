# Current Status and Open Issues — 2026-11-05

## Purpose and change control
Operator-requested repository checkpoint before work on stale address suggestions.
This is a **Level 1, documentation-only** change: no runtime code, data,
stored schema, authorization, routes, Drive files, deployments, or workbook
handoff are changed. No workbook/router integration impact.

Baseline reviewed: `main` at
`0802de87e2c9c11ccfc46819ecefc23b763ed82a` (merged PR #116).
The three November 5 runtime changes have their own detailed records:
- `docs/2026-11-05_DRIVE_SIGNIN_REUSE_CHANGE_RECORD.md`
- `docs/2026-11-05_SAVED_ADDRESS_FILTERS_CHANGE_RECORD.md`
- `docs/2026-11-05_CORRECTED_ADDRESS_SUGGESTIONS_CHANGE_RECORD.md`

This document began as the checkpoint after PR #116. The final release
status below incorporates PR #118, merged and deployed later that day.

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

## Stale-address correction follow-up and remaining issues

### 1. Corrected address suggestions — code fix deployed; phone test pending
The operator reported old/uncorrected addresses still appearing as suggestions
after a saved address was corrected. PR #118 adds an alias-aware, read-only
filter to `address-corrections.js` and the existing Add/Edit datalist renderer.
When a saved address is explicitly marked as an obsolete alias of another
current saved address, only the corrected address is suggested; searching
the old wording can still offer that corrected address.

- PR: https://github.com/timbone72-CC/free-map-router/pull/118
- Merged `main` commit: `49601c85e548eb8ab9cc42a7cc64f5f991bfa6e5`
- Full CI / JavaScript verification: **passed** (run 42094128823)
- GitHub Pages publication: **passed** (run 42094127465)
- Physical phone check: **not yet reported**; no claim that every old
  suggestion on the actual device is fixed.

The app's suggestion list reads only corrections/aliases already present in
local saved stops. Android browser or keyboard autofill is a separate possible
source of unwanted suggestions and remains unverified. Hidden aliases,
GIS/DCFS source identity, stop IDs, workbook Order IDs, pins, route history,
Drive correction record, and backups were **not** deleted or migrated.

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
- PR #118 was merged and deployed; no migration, deletion, broad deduplication,
  automatic Drive backup, or InspectorADE workbook integration change occurred.
- The next verification for PR #118 is an operator test on the phone to
  distinguish the app datalist from Android/browser autocomplete.
- Any company-name entry feature or county metadata changes require their
  own scoped work; they are **not** part of the suggestion fix.

## Record verification
This note was prepared from merged PRs #115, #116, and #118, the individual
change records, the current `app.js` suggestion code and corrections module,
the address correction contract, GitHub CI and Pages results, and the
operator's reported live observations. This is a documentation-only closeout;
the PR #118 runtime CI and publication checks are recorded above, not
re-executed by this documentation update.
