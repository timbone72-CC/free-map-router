# Free Map Router Contract

This contract protects behavior the user has approved. It does not require
features that have not been built.

## 1. App purpose

Free Map Router stores addresses for one driver, keeps Google and Basic ordered
versions of one job route, and opens the selected version in Google Maps.

## 2. Address rules

1. Address is the only required stop field.
2. Any valid address may be added, regardless of company or source.
3. Company, client, label, and notes are optional display information. They
   never determine duplicates, saved locations, route order, or optimization.
4. One normalized physical address represents one saved stop.
5. Correcting a saved stop's written address retains that stop's ID, dedicated
   GIS/DCFS source, saved metadata, strongest pin, selection, and route
   membership. The prior exact normalized full address is remembered as a
   hidden alias of the corrected stop.
6. A later workbook address that exactly matches a saved correction alias uses
   the corrected stop. It must not recreate the prior address as a second stop
   or detach that workbook stop's Order IDs.
7. Every saved address correction is also kept in the app-owned Google Drive
   corrections record. It retains the original full address, corrected display
   address, dedicated GIS/DCFS source, and strongest saved pin. Workbook Order
   IDs remain attached only to the fresh workbook route snapshot, never to a
   permanent correction record.

## 3. Saved-data rules

1. Stops and the home address remain saved in the current browser until the
   user deletes or replaces them.
2. Home is stored separately from stops and is never imported or counted as a
   stop.
3. Existing legacy address data remains available as a recovery copy during
   migration.
4. A complete valid coordinate pair may be saved with an address. Partial or
   invalid coordinates are rejected.
5. A later import must not overwrite a manually saved coordinate pair with a
   less reliable location.
6. Free address lookup is started only by the user, caches successful results,
   shows OpenStreetMap attribution, and is limited to one outside request per
   second.
7. A found location is not silently treated as manually verified.
8. Clicking the map or dragging its pin marks the coordinates as manually
   verified and saves them with the address.
9. A manually verified pin must remain protected from later imports and
   automatic lookups.
10. Pin placement provides free **Aerial** and **Roads** views, with Aerial
    shown first so the user can identify the physical property.
11. **Clear Route** removes every stop from the selected Google or Basic route
    slot without deleting any saved address, pin, note, Home value, or setting.
12. **Delete All Addresses** requires confirmation and removes all currently
    saved stops plus Google, Basic, and pending routes from this app. It does not
    delete Home, settings, workbook history, Google Doc history, or older backup
    files. When manual gigs exist, address deletion must stop rather than orphan
    those gigs; the operator deletes the gigs first.
13. The app retains exactly two usable route versions: **Google Route** and
    **Basic Route**. Each remains saved in the current browser until replaced or
    cleared under the approved route controls.
14. The app opens on Google Route. The operator may switch between Google Route
    and Basic Route inside Build Route; the last selected slot is not restored
    on reload.

## 4. Page and menu rules

1. The app uses a visible **Go to** dropdown menu.
2. The menu contains these five understandable pages:
   **Home**, **Addresses**, **Import Addresses**, **Build Route**, and
   **Settings**.
3. Only the selected page is shown. The app must not return to one long page
   requiring the user to scroll through every feature.
4. Existing pages may not be renamed, removed, combined, or reordered without
   the user's approval.
5. Settings stores the Geoapify key only in the current browser. The key must
   never be committed to GitHub, included in route links, or displayed in full
   after saving.
6. Settings provides a downloadable backup and restore. The backup contains
   Home, saved addresses, pins, manual gigs, Google Route, Basic Route, and any
   pending new workbook route, but never the Geoapify key.
7. Google Drive backup uses the limited `drive.file` permission and may access
   only files created or selected for this app. It must never request access to
   every file in Google Drive.
8. The app creates and owns one Google Drive folder named **Free Map Router**.
   Its cloud backup is saved inside that folder and is not dependent on another
   application's filing rules.
9. Settings provides **Back Up Now** and **Restore from Drive**. Google Drive is
   accessed only after the user taps one of those controls. Ordinary address,
   gig, pin, Home, Google Route, and Basic Route changes stay on the device and
   do not trigger an automatic Drive write.
10. Correcting a saved address is the sole exception to the manual-backup rule:
    it writes only the small, app-owned **Free Map Router Address
    Corrections.json** record to the existing app folder. This is not a route
    backup and does not write Home, routes, gigs, notes, labels, or API keys.
    Before workbook addresses are matched, the app loads that record. A
    correction-save failure leaves the device copy intact and reports that it
    was not saved permanently; a correction-load failure stops the workbook
    import rather than recreating a known old address.
11. The app folder contains one workbook handoff file named **Free Map Router
    Address Inbox.json**. It is reserved for Daily Print jobs from
    **InspectorADE Repeat Job Predictor - LIVE**.
12. The approved business-account sign-in uses the private read-only backend to
   check that inbox. Valid Daily Print addresses from an accepted current or
   newer export are added to saved addresses without weakening existing pins.
   A newly accepted route uses workbook print order and waits as **New Route
   Available** without replacing either usable route.
13. **Start New Route** requires confirmation, replaces both Google Route and
    Basic Route with the pending workbook jobs in print order, marks both Not
    Optimized, and clears the pending snapshot. Reconnecting to the same export
    preserves both usable route orders. An older export never replaces or
    stages a route automatically. Manual gigs whose `routeIncluded` value is
    true are then reapplied to both usable route versions by physical stop, so
    starting a workbook route does not silently discard planned manual work.
14. Downloaded and Google Drive backups preserve Google Route, Basic Route, any
    pending workbook route, and manual gigs. Older valid version-1 backups
    without gigs remain restorable and yield an empty gig collection.
15. Repeated manual backup requests are serialized so the latest requested
    state is written last.
16. Settings provides an **Update App** control that works only while online,
    removes only Free Map Router's app cache and service-worker registration,
    and reloads a cache-busted app URL. It does not delete Home, saved
    addresses, manual gigs, pins, Google Route, Basic Route, pending route,
    backups, or browser settings.
17. The private backend may read the existing workbook inbox from the exact
    approved Drive folder through its dedicated service account. That reader is
    available only to the approved business Google identity, uses read-only
    Drive access, validates the existing inbox contract, and never creates,
    edits, moves, or deletes a Drive file.
18. A workbook inbox may include one or more real Order IDs for a physical
    stop. Those IDs remain attached to the pending route and then to both named
    route versions; a newer pending workbook route cannot replace the IDs that
    belong to either usable route.
19. **Send Route Order to Workbook** writes only the displayed Google or Basic
    route to **Free Map Router Route Order.json** after the operator taps the
    button and approves the existing limited Drive connection. It never runs as
    an automatic Drive write. A duplicate exact route-order file stops the send
    instead of choosing one silently.
20. Downloaded and Drive backups retain each saved stop's optional address
    correction aliases. Older backups without aliases remain valid.

## 5. Route rules

1. A saved home address is required to build a round trip.
2. Every round trip starts and finishes at the saved home address.
3. Home is not included in the stop count.
4. Optimization may change stop order, but it must not add, remove, or silently
   replace selected stops.
5. Stops have no appointment windows unless the user approves that feature.
6. Home may use the free lookup and manual pin correction. Its verified
   coordinates remain stored only with the separate home record.
7. Free optimization requires verified coordinates for Home and every selected
   stop, and shortens the complete round trip anchored at Home.
8. Optimization must never return a route longer than its initial free
   nearest-stop order.
9. Address text remains the primary Google Maps destination and the
   user-facing route label. Coordinates stay hidden and are exported only when
   the user manually corrected that pin.
10. With a saved Geoapify key, the free **Optimize Route** action automatically
    finds and remembers missing coordinates for selected addresses before
    ordering them.
11. **Google Optimize** sends each ordinary stop to the private backend as its
    written address. The backend uses Google Geocoding for that request before
    Google Route Optimization. Google Optimize minimizes estimated driving time
    using traffic-aware road travel. A manually corrected stop instead uses its
    protected coordinates. Google results used for optimization do not rewrite
    saved pins or address text.
12. Automatic lookup never changes address text and never marks a pin as
    manually corrected.
13. A round trip that exceeds one safe Google Maps link is divided into
    numbered map sections. The sections preserve the optimized order, connect
    end-to-start without gaps, include every selected stop once, and finish at
    Home.
14. Build Route displays selected job stops with two-digit numbers matching
    the current route order. Home remains unnumbered at Start and Finish.
15. Build Route labels and Garmin point names may show `DCFS` or `GIS` when
    that source exists in the saved label or notes. They never insert `MCS`;
    when neither approved source is present, they show the number and address.
16. The live workbook may send an optional dedicated route `source` of `GIS` or
    `DCFS` with an address. That authoritative source is stored separately from
    client labels and notes, updates the matching physical address, and is used
    first by Build Route and Garmin. Older inboxes without `source` remain valid.
17. Up, Down, Remove, Clear Route, Start Navigation, Done, Google Maps, and
    Garmin operate on the Google or Basic slot selected in Build Route. Basic
    Optimize always selects and updates only Basic Route. Google Optimize always
    selects and updates only Google Route. **Start Navigation** opens the first
    displayed job without completing or removing it. A pending workbook route
    changes neither slot until confirmed Start New Route creates both versions
    and selects Google Route.
18. After the approved business account signs in once, the app asks Google to
    renew that identity automatically when the app loads again. If Google
    cannot renew it, the existing company-account sign-in control remains
    available. Google identity credentials are never stored in browser storage,
    app backups, or Drive files.
19. When the business-authenticated app checks the workbook inbox, Build Route
    shows that the check is in progress. A newly accepted route reports **New
    Route Available** with its address count; a completed check with no newer
    route reports that the workbook route is up to date.
20. Build Route shows whether the selected Google or Basic route was last
    ordered by Google Optimize, by the basic optimizer, manually changed after
    optimization, or not optimized. This status remains saved with its route
    across reloads and backups. Up or Down after optimization marks only that
    selected route as manually changed; Start New Route creates both route
    versions as not optimized before any included manual-gig stops are reapplied.
21. The route-order return uses the visible stop positions, including any gaps
    caused by app-only stops, and sends every real workbook Order ID attached to
    a physical stop. It never guesses an Order ID from address text. The button
    stops with a clear message when the displayed route contains no workbook
    Order IDs or one Order ID identifies more than one physical stop.
22. Correcting or de-duplicating a workbook-linked stop preserves its Order IDs
    in the pending, Google, and Basic snapshots. When an existing duplicate is
    merged, every affected snapshot is remapped to the retained workbook stop
    without changing route status or source export time. Manual gigs attached to
    a merged stop are remapped to the same retained stop ID.
23. **Clear InspectorADE Jobs** is a confirmed Build Route action that clears
    workbook Order IDs from both Google Route and Basic Route. A workbook-only
    physical stop is removed from those usable routes; a stop that still has
    manual-gig route work remains exactly once. Unrelated app-only/manual stops,
    all saved addresses and pins, manual gig records, and the pending workbook
    route remain unchanged.
24. **Clear Manual Gig Work** is a confirmed Build Route action that turns off
    `routeIncluded` for saved manual gigs and clears manual-gig route metadata
    from both Google Route and Basic Route. A stop added solely for manual gig
    work is removed only when no workbook Order IDs still need it. Shared
    ADE+gig stops, ADE-only stops, pre-existing app-only/manual stops, all saved
    gig records and addresses, and the pending workbook route remain unchanged.

## 6. Manual gig rules

1. A manually entered paid job is a **gig/work item**, not a physical-stop
   identity and not an InspectorADE assignment.
2. Every manual gig receives one immutable internal `Gig_ID`. Address and vendor
   work-order ID are not gig identity.
3. Every gig references one existing physical stop by `stopId`. Multiple gigs
   may reference the same stop without creating duplicate driving stops.
4. A gig source such as `HNP` or `OTHER` is separate from the governed physical
   stop `GIS`/`DCFS` source and must never overwrite or impersonate it.
5. Vendor work-order/job ID is optional metadata. Two different `Gig_ID`s may
   carry the same work-order text without being silently merged.
6. `Expected_Pay` is an optional nonnegative planning value. Actual pay,
   submission state, completion lifecycle, and photo state are outside Phase 1A.
7. `routeIncluded=true` means the gig's physical stop is included in both saved
   route versions. Multiple included gigs at one property still produce one
   physical stop.
8. Removing the last included gig may remove a route stop only when that stop
   was added solely by manual-gig inclusion. A pre-existing manually selected
   stop or a stop carrying workbook Order IDs must remain.
9. Deleting a manual gig does not delete its physical saved address. Deleting a
   physical address is blocked while any gig still references it.
10. Manual gigs never create or guess workbook Order IDs, never become
    InspectorADE `Source_ID`s, and never enter InspectorADE `Job_Log`,
    `Prediction_History`, or prediction scoring.
11. Downloaded and Drive backups preserve manual gigs. Version-1 backups without
    gigs remain valid and restore with no manual gigs.
12. Manual Drive backup/restore is recovery, not live multi-device
    synchronization. Phase 1A does not claim stale-device conflict resolution.
13. Clearing manual gig route work is not gig deletion: immutable `Gig_ID`,
    source, work-order ID, expected pay, notes, physical-stop attachment, and
    timestamps remain saved, while `routeIncluded` is set false so the route
    intent matches the cleared state.

## 7. Change control

1. A live-tested change confirmed by the user as **Works** becomes protected.
2. Before changing runtime behavior, the relevant product, change-control, and
   regression contracts must be read.
3. The required process must match the risk: low-risk work stays light, normal
   features receive focused protection, and high-risk data or deployment work
   receives stronger review and rollback controls.
4. Protected behavior may not be removed, weakened, bypassed, or silently
   replaced without approval.
5. Only files and behavior required for the approved change may be modified.
6. Experimental behavior may not be written directly to `main`.
7. The user's approval of a documented Level 1 or Level 2 scope counts once; do
   not require duplicate approval unless the scope changes.
8. Level 3 changes require explicit pre-merge approval because they can broadly
   affect data, permissions, routing, or deployment.
9. New features, fields, pages, services, paid APIs, or workflow changes require
   approval before implementation.
10. A change is incomplete if its risk-matched regression checks fail or if it
    violates this contract.
11. Guardrails must not be expanded merely to slow development. They exist to
    make forward progress safer and more reliable.

## 8. Required regression protection

Tests must continue to protect:

- address-only stop creation;
- company-independent address identity;
- safe legacy migration;
- valid coordinate pairs and manual-coordinate priority;
- home stored separately from stops;
- round trips starting and finishing at home;
- large routes split without dropping or reordering stops;
- manual Gig_ID identity without weakening physical-stop identity;
- same-address gigs remaining distinct while routing once;
- gig attachment surviving physical-stop correction/remap;
- symmetric ADE/gig route-work clearing without deleting the other source or
  the physical stop;
- version-1 backup compatibility and version-2 gig preservation; and
- the five-page dropdown menu with only one selected page visible.