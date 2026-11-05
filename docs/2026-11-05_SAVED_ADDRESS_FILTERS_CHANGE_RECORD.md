# Saved Addresses Search and Filters — Level 2 Change Record

Date: 2026-11-05

## Problem and approval
The operator has hundreds of saved addresses and needs easy searches and
view-only filters by GIS/DCFS source, gig company, town, and county.
Filters start at **All** whenever the page reloads. A company appears
in the list as soon as one saved gig uses that company; no minimum count.

## Scope and ownership
- `address-filters.js`: derives filter rows from the current saved stops
  and already-saved manual gigs. Its functions are pure and never write data.
- `app.js`: owns dropdown options, matching, result counts, and Saved
  Addresses presentation. The existing Select All uses filtered addresses
  as before; searching or filtering alone changes no selection or route.
- `index.html`: adds search, company/source, town and county controls
  inside the existing Saved Addresses internal view, and cache-versions
  the affected assets.
- `styles.css`: responsive filter presentation.
- `tests/address-filters.test.js`: focused cases.

Read surfaces: locally saved stops (`source`, address, label, notes),
locally saved manual gigs (`stopId`, `source`), filter controls.
Write surfaces: Saved Addresses DOM only. No data write, migration,
new permission, Drive API call, storage key, change to workbook import,
route order, optimization, backup, or manual-gig entry form.
No workbook/router integration impact.

## Exact behavior and limits
- The company/source filter lists known GIS, DCFS, and saved gig source
  names. If a property has GIS work and HNP gig work, it appears under
  both filters but remains one physical address.
- `Gigs` collectively shows addresses with any saved manual gig.
  Custom gig company names show up on their first actual saved gig;
  this change does not add the separate company-name entry form.
- Town is extracted only from clearly delimited `street, town, ST ZIP`
  addresses. Ambiguous formats show `Unknown town` instead of guessing.
- Existing stop records have no dedicated stored county property.
  County remains `Unknown county` unless it is explicitly supplied
  in the read-only filter input; the current saved-stop contract
  cannot persist county. No guessed county/geocoder lookup.
- All four filters combine; results count shows matched/total saved
  addresses; zero results never hides or deletes any saved stop.
- Refresh resets all filters to All; no persisted search/filter state.

## Protected data and rollback
- Stored address identity, source, source aliases, corrections, pins,
  work orders, gigs, Home, pending route, Basic and Google routes,
  current/previous route history, Drive files, and backups remain intact.
- The existing destructive Delete and Clear Route actions are unchanged.
  Select All still acts on only the currently displayed addresses.
- Potential risks: ambiguous town parsing and slow rendering of hundreds
  of addresses. Unknown labels and simple synchronous read-only filters
  prevent incorrect data changes.
- Prior working main commit:
  `8ec394cdb86166495b2b5564a5b0c56ada1b116c`.
  Rollback by reverting the PR / restoring this baseline if live behavior
  regresses; no data rollback is needed.

## Verification
Focused: `node --test tests/address-filters.test.js`.
Final runtime gate: one passing `npm test` and
`for file in *.js; do node --check "$file"; done` on final head.
Manual smoke after publication:
1. Open Saved Addresses and confirm All count and address list.
2. Search by street and combine GIS, HNP, and a known town.
3. Change to DCFS, Gigs, and a single-company filter; confirm one
   physical stop with multiple sources remains one row.
4. Unknown town/county options do not assert an invented location.
5. Select/unselect a checkbox and navigate away/back; no state loss.
6. Confirm Home, Google Route, Basic Route, saved pin and backup are
   unaffected. Reload should reset to All.
