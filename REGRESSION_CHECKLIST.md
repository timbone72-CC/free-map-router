# Free Map Router Regression Checklist

This checklist owns verification. A change is incomplete when its affected behavior is not covered here and proven before merge.

## Automated checks required for every change

- [ ] `npm test` passes as the complete repository suite.
- [ ] Every first-party root JavaScript file passes `node --check`.
- [ ] Contract-gate tests pass.
- [ ] Every local script loaded by `index.html` exists and has a cache-version query.
- [ ] No first-party production script contains an unapproved `MutationObserver`.
- [ ] The diff contains no unrelated files or blocks.
- [ ] A rollback commit is recorded.

## Address page — protected live smoke test

Required after any change touching `app.js`, `index.html`, script order, selection state, route rendering, or a script loaded after `app.js`.

- [ ] Open the Addresses page without a browser unresponsive warning.
- [ ] Check one address and confirm the checkbox responds immediately.
- [ ] Uncheck the same address and confirm it responds immediately.
- [ ] Check a first, middle, and last address in a longer list.
- [ ] Select All selects all visible addresses once.
- [ ] Clear clears the selection without deleting addresses.
- [ ] Edit opens the selected address without freezing the page.
- [ ] Page navigation remains responsive after repeated selection changes.
- [ ] Leave the page open for at least 30 seconds and confirm CPU use and responsiveness remain normal.

## Build Route — protected live smoke test

Required after route-list, numbering, optimization, Google Maps, or Garmin changes.

- [ ] Selected addresses appear once in the Build Route list.
- [ ] The list does not continuously rewrite or flicker.
- [ ] Up and Down move exactly one selected stop.
- [ ] Remove removes exactly one stop and updates the Address checkbox.
- [ ] Optimize completes and preserves every selected address exactly once.
- [ ] Home remains the unnumbered start and finish.
- [ ] Any visible stop numbering matches the current list order.
- [ ] Reordering or re-optimizing produces one stable renumbering pass.

## Garmin export — protected checks

- [ ] GPX contains Home, every selected stop once, and Home again.
- [ ] GPX preserves the Build Route order.
- [ ] Garmin stop names use only approved display fields.
- [ ] MCS is not inserted into Garmin stop names.
- [ ] DCFS or GIS appears only when that source is actually present in saved data.
- [ ] Missing coordinates stop export with a clear address list.
- [ ] Garmin export changes do not modify the Address page or Build Route controls.

## Saved-data and import checks

- [ ] Existing saved addresses remain present.
- [ ] Manual pins are not weakened by imports or automatic lookup.
- [ ] Duplicate identity remains address-based.
- [ ] Home remains separate from job stops.
- [ ] Backup and restore continue to preserve saved stops and Home.
- [ ] Workbook inbox import replaces only the current route selection and keeps saved addresses.

## Google Maps checks

- [ ] A small route opens as one round trip.
- [ ] A large route splits without dropping or reordering stops.
- [ ] Split sections connect end-to-start and finish at Home.

## Release check

- [ ] All required automated checks passed on the branch.
- [ ] The operator reviewed the intended user-facing behavior.
- [ ] The change merged through a pull request.
- [ ] GitHub Pages published the expected commit.
- [ ] The relevant live smoke test passed on the published app.
- [ ] If live verification failed, the app was rolled back before additional feature work.
