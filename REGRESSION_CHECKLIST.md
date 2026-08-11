# Free Map Router Regression Checklist

This checklist owns verification. Use the smallest set of checks that fully
covers the selected change level and affected behavior.

## Automated checks — every pull request

CI performs these automatically:

- [ ] `npm test` passes as the complete repository suite.
- [ ] Every first-party root JavaScript file passes `node --check`.
- [ ] Contract-gate tests pass.
- [ ] Every local script loaded by `index.html` exists and has a cache-version
      query.
- [ ] Runtime exceptions are declared and structurally valid.
- [ ] The diff contains no unrelated files or blocks.

Documentation-only Level 1 changes do not require a live app smoke test. A
runtime change must complete the checks below that match its affected surface.

## Quick runtime check — Level 1

For a low-risk runtime wording or appearance change:

- [ ] Open only the affected page.
- [ ] Confirm the changed text or appearance.
- [ ] Perform the nearest existing control once.
- [ ] Confirm navigation away from and back to the page remains responsive.

## Core page smoke check — Level 2 and Level 3 when relevant

- [ ] Home opens and the saved Home value remains intact.
- [ ] Addresses opens and one checkbox can be checked and unchecked.
- [ ] Import Addresses opens without changing saved data by itself.
- [ ] Build Route opens and shows the current selected stops once.
- [ ] Settings opens without exposing the saved API key.
- [ ] Page navigation remains responsive.

## Extended responsiveness check

Required only when changing list rendering, page state, script order, event
registration, observers, timers, polling, or any code that can repeatedly
rewrite the DOM.

- [ ] Check a first, middle, and last address in a longer list.
- [ ] Select All runs once and selects the expected addresses.
- [ ] Clear runs once and clears selection without deleting addresses.
- [ ] Edit opens one address without freezing the page.
- [ ] Navigate between Addresses and Build Route several times.
- [ ] Leave the changed page open for at least 30 seconds and confirm it remains
      responsive with no flicker, repeated rewrite, or unresponsive warning.

## Address page checks

Required after changes to address selection, editing, list rendering, stored-stop
identity, or a script that can affect the Address page.

- [ ] Check and uncheck one address immediately.
- [ ] Select All selects all visible addresses exactly once.
- [ ] Clear clears selection without deleting addresses.
- [ ] Delete removes only the confirmed selected addresses.
- [ ] Edit loads the correct address and preserves its saved pin and notes.
- [ ] Correcting a workbook stop preserves its ID, GIS/DCFS source, strongest
      pin, route selection, and prior exact address alias.
- [ ] Refresh preserves saved addresses.

## Build Route checks

Required after route-list, numbering, optimization, Google Maps, or Garmin
changes.

- [ ] Selected addresses appear exactly once.
- [ ] Up and Down move exactly one selected stop.
- [ ] Remove removes exactly one stop and updates the Address checkbox.
- [ ] Optimize preserves every selected address exactly once.
- [ ] Home remains the unnumbered start and finish.
- [ ] Visible numbering, when present, matches the current route order.
- [ ] Reordering or re-optimizing produces one stable render, not a loop.
- [ ] Send Route Order uses the selected Google or Basic route and its visible
      stop positions.
- [ ] App-only stops are not assigned invented workbook Order IDs.
- [ ] Multiple workbook jobs at one physical stop receive the same stop number.

## Garmin export checks

- [ ] GPX contains Home, every selected stop once, and Home again.
- [ ] GPX preserves Build Route order.
- [ ] Garmin stop names use only approved display fields.
- [ ] MCS is not inserted into Garmin stop names.
- [ ] DCFS or GIS appears only when that source exists in saved data.
- [ ] Missing coordinates stop export with a clear address list.
- [ ] Garmin export changes do not modify Address-page or Build Route controls.

## Saved-data and import checks

Required for Level 3 data changes and any Level 2 import or storage change.

- [ ] Existing saved addresses remain present.
- [ ] Manual pins are not weakened by imports or automatic lookup.
- [ ] Duplicate identity remains address-based.
- [ ] Home remains separate from job stops.
- [ ] Backup and restore preserve saved stops and Home.
- [ ] A newer workbook inbox keeps both usable route orders, saves its jobs as
      New Route Available, and keeps saved addresses.
- [ ] Cancelling Start New Route preserves Google Route, Basic Route, and the
      pending route; confirming it replaces both usable slots with every pending
      job exactly once and clears the pending snapshot.
- [ ] Failure or cancellation leaves prior stored data recoverable.
- [ ] Pending, Google, and Basic snapshots retain their own workbook Order IDs;
      receiving a newer pending route does not rewrite either usable route.
- [ ] A raw workbook resend that matches a saved correction alias selects the
      corrected stop once, carries its Order IDs, and does not recreate the old
      address.
- [ ] Merging an already-created old-address duplicate remaps all affected
      route snapshots and Order IDs to the retained workbook stop.
- [ ] Route-order return happens only after the operator taps its button and
      writes one exact JSON file in the existing app folder.

## Google Maps checks

- [ ] A small route opens as one round trip.
- [ ] A large route splits without dropping or reordering stops.
- [ ] Split sections connect end-to-start and finish at Home.

## Level 3 release checks

- [ ] The full impact record is complete.
- [ ] Realistic fixtures or the safe environment were used.
- [ ] Recovery and rollback steps were verified.
- [ ] Explicit pre-merge operator approval was recorded.
- [ ] All affected workflow and data-preservation checks passed.

## Publication check — runtime changes only

- [ ] Required automated checks passed on the branch.
- [ ] The change merged through a pull request.
- [ ] GitHub Pages published the expected commit.
- [ ] The required affected live check passed.
- [ ] A failed live check triggered rollback before additional changes to the
      broken surface.
