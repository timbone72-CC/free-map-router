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
      workbook inbox. Phase 2E may carry an already-routed exact `Gig_ID` in the
      explicit route-order return only as transient print/route context.
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
- [ ] Send Route Order carries exact workbook Order IDs and exact routed manual
      Gig IDs for their physical stops; a shared stop may contain both.
- [ ] A route containing only manual gigs can still return those exact Gig IDs
      without inventing workbook Order IDs or requiring workbook source time.
- [ ] App-only stops with neither workbook nor gig work are not returned and are
      not assigned invented identifiers.
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

## Work-item planning checks — Phase 2G protected baseline

Required after work-item planning, route-work projection, planning backup, or
planner-facing route changes.

- [ ] Planning identity is exact `kind + workItemId`: workbook work uses its
      exact Order ID / `Source_ID`, manual work uses its immutable `Gig_ID`, and
      neither address text nor physical stop ID substitutes for work identity.
- [ ] Two distinct work items attached to one physical address remain two exact
      work items but one driving stop in both Google Route and Basic Route.
- [ ] A shared stop containing workbook and manual-gig work preserves every
      exact Order ID and `Gig_ID` while service time is calculated at the one
      physical stop.
- [ ] Ordinary workbook work with no exact override resolves to five minutes.
- [ ] The twenty-minute interior default is used only through an explicitly
      verified interior-code resolver; unknown or unverified work codes are not
      guessed and stay on the ordinary default unless manually overridden.
- [ ] A manual gig with no exact service-duration override remains explicitly
      unknown; route planning never silently converts that missing duration to
      zero.
- [ ] Known work-item durations at one physical stop add to one stop service
      duration, and route total service time equals the sum of the physical-stop
      totals without double counting shared work.
- [ ] If the same exact `kind + workItemId` appears on two different physical
      stops, route-work projection fails closed instead of choosing one.
- [ ] Saving planning accepts only `serviceMinutes`, `assignedDate`, and
      `lockedDay`; identity, revision, and timestamps cannot be overwritten by
      the planning draft.
- [ ] A stale `expectedRevision` fails closed, while saving the same planning
      values does not create a new revision.
- [ ] `assignedDate` remains a local `YYYY-MM-DD` planning date and does not
      shift through UTC conversion; `lockedDay` remains an explicit boolean.
- [ ] A successful planning save refreshes planning projection only. It does not
      reorder Google or Basic Route, change membership/optimization status, or
      mutate address, source, pay, workbook inbox, gig identity, or prediction
      state.
- [ ] A version-3 backup preserves valid planning records. Valid version-1 and
      version-2 backups restore with empty planning rather than inventing data.
- [ ] Invalid or orphan planning data is isolated and cannot damage valid Home,
      saved stops, route snapshots, workbook Order IDs, or manual `Gig_ID`s.

## Time-aware Google checks — Phase 2H-B protected baseline

Required after Google timing/service request preparation, Google schedule
persistence, Workday timing interactions that affect Google Optimize, or backup
changes that can affect the Google schedule.

- [ ] A timed Google request resolves the saved Route date, Departure, Home By,
      and IANA timezone to whole-second request timing without changing the
      stored local Workday values.
- [ ] Each physical stop is sent to Google exactly once even when several exact
      workbook Order IDs and/or manual `Gig_ID`s share that stop.
- [ ] Known Phase 2G service durations at one physical stop are summed once and
      sent as that visit's `serviceDurationSeconds`.
- [ ] Routed manual work with unknown service duration blocks the time-aware
      request before the Google network call and identifies the missing work
      instead of treating it as zero.
- [ ] Preferred field-work finish is not sent as a hard Google time window; it
      remains a soft post-result overrun/warning.
- [ ] With Home By enabled, skipped, missing, duplicate, unknown, incomplete, or
      Home-By-infeasible Google output applies no partial route and preserves the
      previously accepted route.
- [ ] A complete accepted timed schedule maps visits one-to-one to the accepted
      Google route IDs and is persisted only on Google Route. Basic Route and
      pending route schedule state remain null.
- [ ] Ordinary route-history reads/writes preserve a valid accepted Google
      schedule when its governed route/work and hard timing basis is unchanged.
- [ ] Google route order or membership, represented work metadata, Home, routed
      service duration, Route date, Departure, Home By, or timezone changes make
      the prior schedule stale without deleting the saved route order.
- [ ] Changing only Preferred Finish does not invalidate the accepted schedule
      because Preferred Finish is not part of the hard Google request basis.
- [ ] Whole-app backup version 5 preserves a valid per-Day Google schedule and
      restore returns it only when it remains structurally valid for the saved
      Google route; Basic schedule remains null.
- [ ] Clearing the visible **Home by** field leaves the last valid saved Home By
      unchanged and runs Google Optimize through the existing untimed request
      path while preserving exact stops and service durations.
- [ ] Untimed/Home-By-off optimization does not fabricate or persist a timed
      Home-By-safe schedule, and re-entering a valid Home By restores the timed
      behavior.
- [ ] Changing between Home-By-enabled and Home-By-off mode while Google is
      calculating fails stale rather than applying a result from the wrong mode.
- [ ] Phase 2H-B changes never rewrite saved address text, manually verified
      pins, workbook Order IDs / `Source_ID`s, manual `Gig_ID`s, workbook handoff
      files, route-order return schema, Drive file names, or Drive permissions.

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

## Planner checks — Phase 2H-C protected baseline

Required after planner-model derivation, Build Route planner rendering, planner
map/list interaction, or planner responsive-presentation changes.

- [ ] One physical `stopId` produces one numbered planner card, while every
      attached workbook Order ID / `Source_ID` and manual `Gig_ID` remains a
      distinct exact work row beneath that card.
- [ ] Day summary work-item count and physical-stop count remain separate facts.
- [ ] Missing represented pay remains incomplete rather than becoming a false
      complete `$0`; unknown manual service time remains incomplete rather than
      becoming `0 min`.
- [ ] Current Google ETA/travel/field-finish/Home/Preferred Finish/Home By facts
      appear only while the governed schedule basis and current service total
      still match. Stale timing is withheld without deleting route order.
- [ ] Basic Route never receives traffic-aware Google ETA/Home-By confidence.
- [ ] Planner markers use only valid saved display coordinates. Null, empty,
      partial, or invalid coordinates are not coerced into map points, and
      Google request-only geocoding coordinates are never used as planner-map
      truth.
- [ ] An unplottable route stop remains in the full ordered card list and route
      identity and increments the visible unplottable count rather than being
      dropped.
- [ ] Marker/card focus resolves the same exact `stopId` and does not add,
      remove, reorder, complete, optimize, edit pins, write planning data,
      trigger Google, or write Drive/workbook state.
- [ ] Every protected Build Route control remains present and the app keeps
      exactly the existing five top-level pages.
- [ ] Desktop and phone consume the same planner model with no alternate route
      array, persisted phone route state, MutationObserver, polling loop, or
      duplicate event-registration loop.
- [ ] Desktop/tablet can keep the planner map visible while route cards scroll in
      their own bounded pane; the phone breakpoint returns that pane to normal
      document flow and preserves the existing List/Map presentation behavior.
- [ ] Planner work adds no new map provider/package/API key, OAuth permission,
      Drive file, storage/backup schema, workbook handoff schema, or Google
      optimization request/response contract.

## Multi-day planning checks — Phase 2I-C

Required after Route Plan Day management, local automatic assignment, Day
selection, manual move/lock, or the bounded multi-day Build Route controls.

- [ ] A current one-day route remains usable without creating additional Days or
      completing a wizard. The app still has exactly five top-level pages.
- [ ] Building a multi-day plan requires explicit replacement confirmation.
      Cancel leaves the active Route Plan and planning records unchanged.
- [ ] A created plan has one stable active Day at a time and each Day has its own
      local Route date / Departure / Preferred finish / Home By context.
- [ ] Switching the Day selector changes only the active `dayId` and renders that
      Day through the existing Workday/planner owners; it does not call Google or
      change the pending workbook route.
- [ ] Automatic Day-count suggestion is a minimum based on known service time and
      the Workday target. Unknown manual-gig duration is reported separately and
      is never counted as zero.
- [ ] Automatic Day assignment is deterministic with identical input and uses no
      network, Google Optimize, Drive, or workbook handoff call.
- [ ] Same-address exact work remains together on one Day by default. Multiple
      Order IDs and/or `Gig_ID`s at one `stopId` never create duplicate visits on
      separate Days.
- [ ] Existing locked `assignedDate` values win. Conflicting locked assignments
      fail visibly; a lock outside the requested Day range remains intact and is
      not silently moved or cleared.
- [ ] Actual manual-gig due dates may affect assignment priority. Workbook due
      dates are not invented because the current governed inbox does not provide
      them.
- [ ] Saved display coordinates may influence local geography ordering. Missing
      coordinates never remove work and request-only Google geocoding never
      becomes planner truth.
- [ ] Unknown-duration manual work with no valid existing Day remains visibly
      unassigned; overflow and assignment conflicts remain visible for manual
      adjustment rather than disappearing.
- [ ] Manual move changes every exact work item at that physical address to the
      selected Day and preserves exact work identity. Manual lock/unlock writes
      only the existing planning `assignedDate` / `lockedDay` fields (plus
      standalone-stop lock state where no exact work identity exists).
- [ ] Generated/reassigned Google and Basic Day candidates preserve every
      assigned physical stop once, preserve exact Order IDs / `Gig_ID`s, clear
      stale schedule confidence, and begin `not_optimized` until the operator
      explicitly optimizes that selected Day.
- [ ] No exact work or standalone route-only stop is silently dropped from the
      active plan when it cannot be assigned; unassigned work stays represented
      in the plan pool and assignment controls.
- [ ] A stale Route Plan revision or changed planning snapshot blocks a bulk Day
      commit. If the paired Route Plan write fails after planning persistence,
      the pre-action planning snapshot is restored.
- [ ] The pending newer workbook route survives plan creation, reassignment, Day
      switching, manual move, and manual lock unchanged.
- [ ] Whole-app backup version 5 round-trips a multi-day Route Plan and its
      planning records without inventing extra work, Days, schedules, or due
      dates. Valid backup versions 1-4 remain restorable.
- [ ] The multi-day controls load before `app.js`, use the existing owner render
      functions, and add no post-load UI rewrite, MutationObserver, polling loop,
      second mobile planner state, new provider, API key, OAuth scope, Drive
      filename, or workbook handoff schema.

