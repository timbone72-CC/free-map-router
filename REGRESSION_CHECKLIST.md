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
- [ ] Correcting a workbook stop reports that its permanent correction record
      saved successfully; a raw resend after local browser storage is replaced
      still selects the corrected address once.
- [ ] Refresh preserves saved addresses.
- [ ] An address with attached manual gigs cannot be deleted until those gigs
      are deleted, so no gig is orphaned.
- [ ] An active Manual Work Library property is protected from ordinary address
      deletion until the property is archived.
- [ ] Archiving a manual property does not delete its saved address by itself;
      after archive and with no attached gig, normal local address deletion is
      available if the operator still wants it.

## Manual gig checks

Required after manual-gig schema, entry, editing, route-membership, or backup
changes.

- [ ] Create one HNP gig at a new address and confirm exactly one physical stop
      and one gig are saved.
- [ ] Create a second gig at the same address and confirm it has a different
      `Gig_ID` while Build Route still contains that physical stop only once.
- [ ] Work-order ID, expected pay, source, and gig notes survive refresh and edit.
- [ ] Invalid or negative expected pay is rejected without changing prior data.
- [ ] Include in route adds the physical stop to both Google and Basic route
      versions; multiple gigs at that stop do not duplicate it.
- [ ] Removing one of multiple included gigs keeps the shared route stop.
- [ ] Removing the last gig does not remove a pre-existing/manual/workbook stop
      and never removes real workbook Order IDs.
- [ ] Editing/correcting a physical stop preserves every attached gig through
      the retained stop ID or governed ID remap.
- [ ] Deleting a gig does not delete its physical saved address or reusable
      Manual Work Library property.
- [ ] Starting a newer workbook route reapplies every `routeIncluded` manual gig
      to both usable route versions without modifying the pending workbook route.
- [ ] Manual gig details may appear as secondary route detail, but HNP/OTHER is
      never presented as the governed GIS/DCFS route source.
- [ ] Manual gigs never receive invented workbook Order IDs and never change the
      workbook inbox or route-order JSON contract.
- [ ] **Clear Manual Gig Work** keeps every gig record, Gig_ID, source, work-order
      ID, pay, notes, and physical-stop attachment while setting `routeIncluded`
      false and removing only gig route work from both usable route versions.
- [ ] Clearing manual gig work keeps a shared ADE+gig stop because workbook Order
      IDs still need that physical stop, and keeps pre-existing app-only/manual
      stops that were not added solely by gig inclusion.

## Manual Work Library checks

Required after reusable-property storage, Drive sync, archive/restore,
repeat-schedule, due-alert, or manual-property deletion-protection changes.

- [ ] Saving a manual gig creates or updates exactly one reusable property for
      its physical address and attempts the permanent Drive save automatically.
- [ ] A successful save reports that the property was saved permanently in
      Google Drive; a failed/cancelled Drive save leaves the local gig/property
      intact and clearly reports that permanent storage did not complete.
- [ ] The library uses one **Free Map Router Manual Work.json** file in the
      existing app folder and keeps the existing `drive.file` permission.
- [ ] Two gigs at the same physical address still map to one reusable property
      and one physical stop.
- [ ] Editing a manual property's saved address keeps its `propertyId` and
      remembers the prior exact address as an alias.
- [ ] A newer per-property update/archive wins over an older device copy during
      remote/local merge.
- [ ] Sync restores a missing non-archived property as one saved address and does
      not add it to Google Route or Basic Route.
- [ ] Sync does not create GIS/DCFS source, workbook Order IDs, route metadata,
      gig pay, or work-order IDs inside the permanent property record.
- [ ] **Delete Gig**, Build Route **Remove**, Clear Manual Gig Work, and Clear
      InspectorADE Jobs do not archive or delete the reusable property.
- [ ] **Archive** keeps the property in the library and Drive record and can be
      reversed with **Restore**.
- [ ] Archive is blocked while a manual gig occurrence still references that
      property.
- [ ] No permanent hard-delete control is introduced for Manual Work Library
      property records in this phase.
- [ ] A valid Manual Work Library version-1 record migrates to version 2 without
      losing property ID, address/aliases, pin, archive state, or timestamps and
      begins with no repeat schedules.
- [ ] One property can have at most one current repeat template in this phase;
      editing it retains the same immutable `templateId`.
- [ ] A repeat template accepts only a whole cadence count from 1 through 365,
      days/weeks/months, a valid next due date, and nonnegative optional pay.
- [ ] A newer per-template cadence or next-due update wins stale-safe sync over
      an older device copy.
- [ ] **Due Soon** begins exactly four local calendar days before the scheduled
      date, **Due Today** is exact, and later dates become **Overdue**.
- [ ] Home shows a compact due summary without adding a sixth page or changing a
      route merely because work is due.
- [ ] Due work shows **Add to Route** only as an operator action; due status alone
      never creates a gig or selects/adds a route stop.
- [ ] **Add to Route** creates a new immutable `Gig_ID`, inherits template
      source/pay/default notes, leaves work-order ID blank, and includes the
      physical stop once in both Google and Basic routes.
- [ ] Scheduled **Add to Route** never invents workbook Order IDs and never
      changes the pending workbook route or InspectorADE source/history.
- [ ] Adding due work advances the next due date from the scheduled due date,
      not the button-press date. Missed daily/weekly periods skip to the first
      future scheduled occurrence; monthly recurrence keeps its anchor day and
      safely clamps short months.
- [ ] A schedule-save or schedule-advance Drive failure keeps the local schedule,
      gig, route action, and next due date intact and clearly offers **Sync
      Library** as the retry.
- [ ] The library adds no sixth page, timer, polling loop, MutationObserver,
      background notification service, Google Calendar integration, or automatic
      Add to Route behavior.

## Build Route checks

Required after route-list, numbering, optimization, Google Maps, or Garmin
changes.

- [ ] Selected addresses appear exactly once.
- [ ] Up and Down move exactly one selected stop.
- [ ] Remove removes exactly one stop and updates the Address checkbox.
- [ ] Build Route Remove does not delete/archive a Manual Work Library property.
- [ ] Optimize preserves every selected address exactly once.
- [ ] Home remains the unnumbered start and finish.
- [ ] Visible numbering, when present, matches the current route order.
- [ ] Reordering or re-optimizing produces one stable render, not a loop.
- [ ] Send Route Order uses the selected Google or Basic route and its visible
      stop positions.
- [ ] App-only stops are not assigned invented workbook Order IDs.
- [ ] Multiple workbook jobs at one physical stop receive the same stop number.
- [ ] Multiple manual gigs at one physical stop also receive one physical stop
      number rather than duplicate driving stops.
- [ ] **Clear InspectorADE Jobs** removes workbook Order IDs from both Google and
      Basic routes, removes ADE-only route stops, and preserves gig-only, shared,
      and unrelated app-only/manual stops.
- [ ] Clear InspectorADE Jobs does not delete saved addresses, manual gig
      records, pins/corrections, Home, or the pending workbook route.
- [ ] Clear Manual Gig Work removes only gig-managed gig-only route stops; ADE
      and shared stops remain once and the pending workbook route remains intact.
- [ ] Source-specific clearing changes an optimizer label to Manually Changed
      only when visible route membership changes; metadata-only clearing leaves
      the optimizer status stable.

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
- [ ] Duplicate physical-stop identity remains address-based.
- [ ] Manual gig identity remains `Gig_ID`-based and separate from stop identity.
- [ ] Manual Work Library property identity remains `propertyId`-based and
      separate from both physical-stop identity and `Gig_ID`.
- [ ] Manual Work Library repeat-template identity remains `templateId`-based and
      separate from property identity, stop identity, and `Gig_ID`.
- [ ] Home remains separate from job stops.
- [ ] Backup and restore preserve saved stops, Home, manual gigs, and named route
      snapshots; the separate permanent Manual Work Library remains intact.
- [ ] An older version-1 backup without gigs still restores normally with an
      empty manual-gig collection.
- [ ] Damaged/orphan gig rows in a backup cannot damage valid Home, stops, or
      route data.
- [ ] A newer workbook inbox keeps both usable route orders, saves its jobs as
      New Route Available, and keeps saved addresses.
- [ ] Cancelling Start New Route preserves Google Route, Basic Route, and the
      pending route; confirming it replaces both usable slots with every pending
      job exactly once and clears the pending snapshot before included manual
      gigs are reapplied.
- [ ] Failure or cancellation leaves prior stored data recoverable.
- [ ] Pending, Google, and Basic snapshots retain their own workbook Order IDs;
      receiving a newer pending route does not rewrite either usable route.
- [ ] A raw workbook resend that matches a saved correction alias selects the
      corrected stop once, carries its Order IDs, and does not recreate the old
      address.
- [ ] A missing, damaged, or duplicate permanent-correction file stops the
      inbox import before it can recreate an old address.
- [ ] Merging an already-created old-address duplicate remaps all affected
      route snapshots, Order IDs, and attached manual gigs to the retained stop.
- [ ] Route-order return happens only after the operator taps its button and
      writes one exact JSON file in the existing app folder.
- [ ] Manual Work Library writes do not change Drive permission, inbox structure,
      route-order JSON structure, workbook data, InspectorADE history, or
      prediction data.
- [ ] Neither source-specific clear action changes backup schema, Drive
      permissions, inbox structure, route-order JSON structure, workbook data,
      InspectorADE history, or prediction data.

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