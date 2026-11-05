# Corrected Address Suggestions — Level 2 Change Record
Date: 2026-11-05

## Problem and evidence
The operator reports obsolete/uncorrected addresses appearing while creating a
new address, even after manually correcting the corresponding saved address.

The app-owned `refreshAddressSuggestions()` function previously rendered up
to eight raw `jobs[].address` strings. It did not consult the saved stop's
`addressAliases`. A separately retained old-address stop can therefore
produce a stale suggestion even when another saved stop explicitly records
that same address as an old alias.

This confirms a **reproducible code-path possibility**, not a diagnosis of
the operator's exact device data. Android browser/keyboard autofill is outside
the app-owned datalist and cannot be diagnosed from repository code alone.

## Approved narrowly scoped behavior
- Only **current** saved addresses should be offered in the app-owned Add/Edit
  and Manual Gig address datalist.
- If another saved stop's explicit exact full-address alias marks a saved
  address obsolete, hide that obsolete suggestion in the datalist.
- Typing the obsolete address still finds/offers the **corrected** current
  address through its retained alias.
- Keep existing case-insensitive substring search, eight-result cap, and
  stable current-stop ordering. Leave unrelated addresses available.
- Do not delete, merge, rewrite, or migrate any saved records merely to change
  suggestions. Old aliases remain in place for future workbook matching.

## Owning files, read/write surfaces
- `address-corrections.js`: pure `savedAddressSuggestions` helper;
  reads the already saved `address` and `addressAliases` fields and returns
  only suggested strings. It never writes records or calls Drive.
- `app.js`: the existing `refreshAddressSuggestions()` reads the current
  search field and replaces only `#addressSuggestions` option elements.
- `index.html`: cache versions of those two scripts.
- `tests/address-corrections.test.js`: focused assertion of stale-duplicate
  hiding, search through aliases, no data modification, cap, and wiring.
- Existing version-pin test assertions: only expected script cache URL updated.

Read surfaces: already loaded saved stops and form input.
Write surface: address `datalist` option DOM only.
No workbook/router integration impact. No Google Drive request or permission
change, background sync, geocoding, storage write, route mutation, or schema
change.

## Known limit and safety
The helper can only apply correction aliases already present in this device's
saved stops; it does not silently fetch remote correction files to populate the
suggestions. A browser/keyboard suggestion that is not part of the app datalist
may still appear and must be distinguished in a device smoke test.

Aliases remain hidden from the visible list but are preserved in saved stop
records and in the separate governed Drive correction record. GIS/DCFS source,
order IDs, pin verification, Manual Work Library, manual gigs, Home, Google and
Basic routes, pending route, print output, and backups are protected.

## Verification and rollback
- Focused: `node --test tests/address-corrections.test.js`.
- Final runtime gate: one successful complete `npm test` and root JS syntax
  check on exact final head (GitHub CI acceptable). A failure blocks merge.
- Inspect diff for unrelated changes before merge.
- Smoke after publication: open Addresses > Add/Edit, type an obsolete address
  known to be aliased to a corrected saved address; confirm only the corrected
  string appears in the **app datalist**. Also test a known unrelated address
  and a Manual Gig address input. Confirm nothing about saved addresses, pins,
  GIS/DCFS source, route order, or Drive corrections changed.
- Before fix baseline: main commit
  `59afa29c925aa3faf80396645397daaf482bd7b3`.
  If the suggestion UI regresses, revert this PR / restore the prior release
  through repository rollback procedure. No data rollback is needed because
  the fix only reads saved records.

## Release closeout (2026-11-05)
- Implementation merged via PR #118:
  https://github.com/timbone72-CC/free-map-router/pull/118
- Published `main` merge commit:
  `49601c85e548eb8ab9cc42a7cc64f5f991bfa6e5`.
- GitHub's "Verify Contract and App" workflow on that merge commit passed
  (run 42094128823; full regression suite and JavaScript syntax).
- GitHub Pages build and deployment passed on the same commit
  (run 42094127465).
- Post-deployment physical phone test: **not yet reported**. The operator has
  not confirmed whether the observed stale suggestion came from the app's
  datalist versus Android keyboard/browser autofill. Do not claim this fix
  resolves all device-side suggestions until that distinction is tested.
- Source, aliases, stored stops, routes, backups, and Drive records were not
  migrated or deleted. This fix only changes the suggestion presentation.
