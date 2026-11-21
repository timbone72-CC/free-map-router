# FMR — Known Oklahoma city-to-county filtering

**Date:** 2026-11-21  
**Risk:** Level 2, address filtering display only  
**Baseline:** `main` at `934930633aecd1ece77c0cfb963a42bec2c440eb` (PR #154).

## Need
The City and County filters for Optimize New Stop Only must list cities and counties tied to actual saved stops, not an unrelated statewide dropdown. Saved stops usually do not include county metadata, so most currently display "Unknown county." Use reliable known city/county relationships, while allowing newly saved towns to appear in City and their recognized counties in County automatically.

## Narrow change
- `address-filters.js`: preserve the current comma-delimited city/state extraction; use verified Oklahoma city-to-county associations when the saved stop has no explicit county. The same shared helper serves Saved Addresses and the insert-one picker; dropdowns remain derived only from currently saved/eligible addresses.
- `index.html`: bump only `address-filters.js` cache version, no new controls or styling.
- `tests/address-filters.test.js` and `tests/google-insert-stop-filters.test.js`: prove dynamically added saved towns and associated counties show up without pre-populating unvisited cities, exact city/county selection, protection of explicit metadata and no guesses for ambiguous or out-of-scope cities.

**Reference:** U.S. District Court for the Northern District of Oklahoma city/county directory: https://oknd.uscourts.gov/ok-city-jurisdictions . A deliberately small validated offline lookup covers common western Oklahoma and nearby service towns. Municipalities in multiple counties are omitted from this lookup: the town alone cannot accurately determine the county of every street address. For unsupported or unclear cities, show **Unknown county** rather than invent a county. New saved cities always enter the City filter immediately; their county is auto-filled when the reference covers that city.

## Safety
- **Read:** saved stop address and optional county metadata; existing eligible saved stops/filters.
- **Write:** only dropdown display values; no stop, route, planning, pin, work-order, account, API or Drive writes.
- No user history or "visited city" registry is added. The City and County lists are scoped to saved stops; they do not enumerate all Oklahoma cities.
- No network calls are added. No Google optimization, work item, import, workbook handoff or route order behavior changes. No Cross-System Reality Gate.
- No change to county values stored in backups because no county metadata migration is needed.

## Verify
- Focused filter tests followed by exact-head full `npm test` and first-party JS syntax checks in GitHub CI.
- One live affected-surface check: saved Elk City/Weatherford/Vici/Lawton addresses display Beckham/Custer/Dewey/Comanche respectively, City and County select only eligible saved stops, and adding a new saved city adds only its matching options.
- Rollback: revert this isolated PR back to `934930633aecd1ece77c0cfb963a42bec2c440eb` if address filtering regresses. 
