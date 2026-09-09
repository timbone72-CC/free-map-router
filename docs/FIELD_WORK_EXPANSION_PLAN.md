# Free Map Router — Field Work Expansion Roadmap

**Status:** IN PROGRESS — PHASE 2I MULTI-DAY ROUTE PLANS COMPLETE / PHASE 2J NEXT / PHASE 3 DESIGN AUDIT STARTED  
**Updated:** 2026-09-08  
**Primary repo:** `timbone72-CC/free-map-router`

## Purpose

Make this document the durable execution roadmap for expanding Free Map Router from a workbook-fed route optimizer into a broader field-work tool that can also handle manually entered gigs, route pay, realistic workday planning, multi-day routes, HNP work orders, job-site photos, business Drive storage, and later file-organizer integration.

This is the single planning source of truth for this expansion. Add future ideas here instead of scattering the same plan across multiple documents.

The evidence and product reasoning behind the current route-planner direction are recorded in `docs/2026-09-02_ROUTE_PLANNER_PRODUCT_AUDIT.md`. That audit preserves alternatives, risks, and deferred ideas; this roadmap carries only the operator-approved direction so the planning source of truth stays concise.

## Data Ownership Rules

- Every manually created gig receives a stable internal `Gig_ID` or equivalent permanent job identity. Address alone is never the job identity.
- Vendor work-order IDs remain stored separately when available.
- InspectorADE jobs and HNP/other gigs may share one route experience, but HNP/other gigs must not enter InspectorADE prediction history or be treated as InspectorADE repeats.
- The app owns route-stop state and field capture state.
- Planning metadata such as estimated service time, due date, locked/assigned day, and day assignment belongs to the exact work item (`Source_ID`/Order ID or `Gig_ID`), not merely to the physical address.
- A physical address may still route once while contributing the combined service time of multiple distinct work items at that stop.
- A future multi-day **Route Plan** is owned by Free Map Router. The workbook may receive the active day's route for numbering/printing, but it must not become the durable database for the whole multi-day plan.
- Route Plan / Day / work-item planning records must be structured with stable identities and stale-write/revision boundaries so future true cross-device synchronization can be added without rebuilding the planner or making one device permanently authoritative.
- `Gig_Log` is the durable workbook mirror/ledger for manual gig/pay data; workbook-owned `Actual_Pay` must survive later FMR syncs.
- Google Drive owns job media files once the Phase 4 storage design is approved; the app will record upload state and location rather than treating transient browser state as the durable media archive.
- Existing InspectorADE/workbook address corrections remain owned by the permanent address-corrections store. They are not replaced by the Manual Work Library or by point-in-time backups.
- Cross-device writes must be stale-safe so an older phone/PC state cannot silently replace newer job data.

## Target User Flow

1. Receive InspectorADE jobs from the workbook and/or manually add an HNP or other gig in Free Map Router.
2. Mix all selected work into one planning pool while retaining each exact Order ID / `Gig_ID` even when several work items share one physical address.
3. For an ordinary one-day route, optionally set the route date, departure time, preferred field-work finish, home-by time, and realistic service duration; normal inspection work starts with a five-minute planning default and verified interior work with a twenty-minute planning default unless explicitly overridden. Preferred field-work finish defaults to 3:00 PM and home-by defaults to 5:00 PM; both are adjustable for the selected day.
4. For a larger workload, create a multi-day Route Plan so work can be divided into Day 1 / Day 2 / Day 3 or an automatic number of days without losing or duplicating any selected work item.
5. Optimize each chosen day using the existing Basic or Google route paths; Google remains the traffic-aware time-planning authority while Basic remains the protected fallback route-order option.
6. Show expected route pay, work-item count, physical-stop count, estimated service time, and estimated finish/home time for the selected day where the available data supports it.
7. Use the built-in known-road/construction-avoidance capability when field knowledge says a road or corridor should not be used even if Google's current road data has not caught up. The capability is a standard part of route planning, while entering a restriction is only necessary when there is actually something to avoid.
8. When the route changes after work has started, use an explicit future **Replan Remaining From Here** path that replans only unfinished work from the current/chosen position back to Home rather than pretending the vehicle is still at Home.
9. Tap an HNP stop to open its job/work-order view.
10. Capture or attach required job-site photos from the phone using an evidence plan tied to the exact gig/work order, not merely a loose camera roll.
11. Keep each photo tied to the correct `Gig_ID`, work order, evidence category/line item, and capture session from the moment it enters the job workflow.
12. Preserve the original field evidence and any required capture metadata; derivative resize/compression is allowed only after the client-specific requirement is known.
13. Save/upload job media safely to the configured Google Drive destination, with recoverable pending state when offline or interrupted.
14. Send the HNP/gig record and relevant work-order information to the gig side of the workbook and include it on the Google Print route output where appropriate.
15. Record actual pay later without overwriting what the route was expected to earn when planned.

## Route-Planning Usability Principle

The route-planning upgrades are capabilities, not mandatory wizard steps.

- The current simple one-day routing path must remain quick and usable when the operator does not need advanced planning controls.
- Departure time, preferred field-work finish, home-by time, per-work-item duration overrides, multi-day planning, manual day locking, and similar planning controls should be available when useful without forcing the operator to configure every field for every route.
- Sensible defaults should carry ordinary routes so the operator can use the extra detail only when the day requires it.
- Standard built-in capabilities such as known-road/construction avoidance remain part of the product even though no restriction entry is needed on days when there is nothing known to avoid.

## Route-Planner Product Structure Principle

Prepare the app for a modern route-planner experience early, but defer professional visual polish until the planning behavior has survived real field use.

Early route-planner phases should establish the permanent structural concepts that later polish will use:

- current day / Route Plan context;
- a day summary model for work-item count, physical stops, pay, departure, preferred field finish, estimated home time, and warnings when data supports them;
- a planning **Map / List** ownership model rather than a route surface that is only a long list of controls;
- reusable stop-card data such as stop number, address, exact work items, service time, due status, ETA/schedule facts when available, and active-plan completion status;
- a clear distinction between primary route actions such as Optimize / Start Route and secondary maintenance, export, workbook, Garmin, clear, and advanced planning actions;
- responsive boundaries that can later support desktop map+list and phone map/list switching without creating two different planner systems;
- styling and visual polish separated from route behavior so a later professional-design pass does not require rebuilding the planner.

Plain early UI is acceptable. Do not spend implementation time polishing temporary layouts that the roadmap already intends to replace.

## Future True-Sync Readiness Boundary

True cross-device synchronization is a future capability, not part of the current route-planner runtime phases.

Prepare for it now by keeping Route Plan / Day / work-item state capable of record-level revision/stale-write protection and by avoiding a permanent assumption that one browser/device is the master copy. Backup/restore remains recovery behavior and must not be mislabeled as live synchronization.

A later dedicated design may compare an authenticated central store such as Firestore with a database behind the existing backend. Provider choice, live-sync runtime, offline queueing, conflict UI, and any new permissions are intentionally deferred and require their own governed design before implementation.

## Product Lanes

Keep one master roadmap, but treat the expansion as two visible product lanes so route planning and field-media work do not become one giant release.

### Lane 1 — Route Planner Core

Phase 2F through Phase 2K: selectable sync, work-item planning metadata, time-aware routing, planner UI foundation, multi-day Route Plans, active-plan completion state, replanning, day-aware workbook return/print, known-road handling, persistence, and route-planner soak/polish.

### Lane 2 — Field Operations

Phase 3 through Phase 6: work-order/evidence workflow, photos, business Drive media, file-organizer integration, and broader field-work cleanup/soak.

The lanes share exact work identity and route context, but Phase 3 runtime must not be built on an unstable Route Plan model.

## Planned Job Lifecycle

Initial lifecycle to validate during implementation:

`RECEIVED -> ROUTE_PLANNED -> IN_PROGRESS -> PHOTOS_PENDING -> COMPLETE -> UPLOADED -> SUBMITTED -> PAID`

The exact labels may change before implementation, but the build must have an explicit lifecycle rather than unrelated checkboxes scattered across the app and workbook.

Rules:

- Completion and upload are separate states.
- A job can be complete in the field while media upload is still pending.
- A failed upload cannot silently mark a job uploaded.
- Later workbook/pay edits must not erase field evidence or the lightweight completion state that is still required by an active Route Plan.

## Roadmap

### Phase 1 — Safe Baseline and Manual Stops

Before runtime work:

- Record the current live app commit/version and rollback point.
- Preserve current workbook import, Basic/Google route selection, corrected-address behavior, route persistence/backups, navigation, and current Google Print behavior.

Build:

- Add manual stop creation directly in Free Map Router.
- Minimum planned fields:
  - stable internal `Gig_ID`
  - source/company (`HNP`, `Other`, etc.)
  - address
  - work-order/job ID when available
  - expected pay when known
  - notes
  - route inclusion state
- Manual stops must behave like normal stops for selection, ordering, Basic optimization, Google optimization, navigation, saving/restoring, and printing.
- Repeated visits to the same address must remain distinct gigs when their IDs/work orders differ.

Acceptance direction:

- Existing workbook-fed routes still work unchanged.
- Manual and workbook stops can coexist in the same route.
- A stale device state cannot silently delete or replace a newer manually entered gig.

**Current status:** Implemented and live-tested. Manual gigs remain separate from InspectorADE history and can share one physical stop with workbook work.

### Phase 1B — Manual Work Library and Due Dates

Keep the next step narrow: add durable reuse and simple scheduling for manual/HNP work without turning Free Map Router into a calendar system.

Permanent Manual Work Library:

- Store reusable manual/HNP properties in one permanent Google Drive Manual Work Library.
- A property record owns the reusable physical address, corrected address/pin when applicable, and property-level notes.
- The library is independent of today's route membership. Removing work from Build Route must not delete the permanent property.
- The library must not replace or duplicate the existing InspectorADE permanent address-corrections file.
- Saving a manual property should update its durable library record automatically when Drive is available; **Back Up Now** remains a separate whole-app recovery snapshot.

Repeat-job templates:

- A repeat template attaches to one permanent manual property and may store company/source, normal expected pay, default notes, cadence, next due date, and alert lead time.
- The template is not today's gig. When the operator chooses **Add to Route**, Free Map Router creates or activates a distinct gig occurrence with its own `Gig_ID`.
- Keep recurrence intentionally small at first: every X days, every X weeks, or every X months.
- The next scheduled occurrence should normally advance from the scheduled due date rather than drifting from a late completion date.

Due alerts:

- Free Map Router automatically evaluates due status when the app opens or refreshes.
- Initial statuses: **Overdue**, **Due Today**, **Due Soon**, and **Upcoming**.
- A small Home summary may show counts such as `2 due soon • 1 overdue` and link to the existing manual-work surface; do not add another top-level page just for alerts.
- A due alert may offer **Add to Route**, but due work is **never automatically added** to Google Route or Basic Route.
- The operator always decides whether a due job belongs on today's route.
- No Google Calendar, background push-notification service, or new notification permission is part of Phase 1B.

Deletion safety:

- **Remove from Route** changes route membership only.
- **Delete Gig** removes only that gig occurrence and keeps the reusable property.
- Normal property removal should prefer **Archive** so an accidental cleanup is recoverable.
- Permanent property deletion must use an explicit destructive warning and must not silently destroy the only durable copy.
- A Build Route removal that deletes the saved address is a defect, not intended behavior and not something the Drive library should mask.

Phase 1B exclusions:

- no InspectorADE workbook schema/runtime changes;
- no changes to InspectorADE `Job_Log`, `Prediction_History`, or prediction scoring;
- no Google Calendar integration;
- no background push notification service;
- no new Google permissions unless a later approved implementation proves they are required;
- no route auto-add from schedules;
- no photo/media workflow yet.

**Current status:** Implemented as the durable Manual Work Library / repeat-template foundation used by the later Phase 2 gig flow.

### Phase 2 — Gig Workbook Handoff, Route Pay, and Mixed Print

Create a separate gig data path rather than reusing InspectorADE `Job_Log`.

Implemented behavior:

- manual gigs carry due/completed dates while preserving immutable `Gig_ID` identity;
- expected route pay combines InspectorADE and manual-gig work without combining their histories;
- manual gig records sync explicitly through the governed Gig Handoff into workbook `Gig_Log`;
- workbook `Actual_Pay` remains workbook-owned and is preserved by later FMR syncs;
- route return carries exact workbook Order IDs and exact manual `Gig_ID` values by visible physical stop;
- Google Print can show InspectorADE and manual-gig cards in the same current route packet;
- blank manual expected pay remains visibly unknown rather than silently becoming `$0`;
- visible **Include in Route** checkboxes show and control manual-gig route membership directly;
- Drive identity is pinned to the governed Free Map Router folder/resources rather than name-based duplicate-folder lookup.

**Production checkpoint — 2026-08-27:** Phase 2A through Phase 2E were production-validated after an ordered workbook-first rollout. The governed workbook handoff produced a current 13-job LIVE route, the production FMR read it successfully, and the mixed exact Order-ID/Gig-ID round trip had already passed in the Live Sandbox/shared handoff with mixed Google Doc output. See `docs/2026-08-27_PHASE_2_PRODUCTION_COMPLETION_RECORD.md`.

Use a real-work soak before adding photo/media runtime. Watch for route-pay mismatches, stale gig sync, wrong route membership, mixed-print identity errors, and Drive handoff failures. Phase 2 completion does not authorize Phase 3 runtime edits.

### Phase 2F — Selectable Sync Cleanup

Finish the already-approved workbook ↔ Free Map Router route-membership cleanup before multi-day planning depends on that boundary.

Required behavior:

- send exactly the selected eligible InspectorADE assignments;
- retain every distinct selected `Source_ID` / work-order identity when multiple selected assignments share one physical address;
- completed, cancelled, or previously sent work must not silently re-enter a new route sync merely because another assignment shares the address;
- resend/override must be explicit;
- prediction identity remains separate from FMR stop identity and permanent address correction;
- starting or refreshing a workbook route must not silently discard included manual gigs.

Acceptance direction:

- a deliberately selected small subset reaches FMR with no extra eligible/completed/cancelled jobs;
- same-address multi-order work remains one physical driving stop with all intended work IDs preserved;
- later route-planning phases can trust the incoming work pool.

### Phase 2G — Work-Item Planning Foundation

Add the minimum planning metadata needed to model a real workday without turning a physical address into a work-item identity.

Planning rules:

- service duration belongs to the exact work item, not the address;
- normal InspectorADE inspection planning default: **5 minutes** unless overridden;
- interior inspection planning default: **20 minutes** unless overridden;
- do not infer or hard-code which InspectorADE job/work codes are interior until the mapping is verified against real work;
- once a verified code mapping exists, FMR should automatically apply the interior planning default to those exact verified codes; unknown or unverified codes must not be guessed and remain subject to the normal default/manual override;
- if one physical stop contains a five-minute job and a twenty-minute job, the planner should treat that stop as one drive stop with **25 minutes** of service time;
- manual/HNP gigs may later carry their own default or per-occurrence duration without changing physical-stop identity;
- due date / assigned day / locked-day information, when available, belongs to the exact work item;
- generic High/Medium/Low planning priority is intentionally excluded from the first route-planner release unless a later real workflow proves it is needed;
- geography must not push genuinely due work to a later day merely because another split looks cleaner;
- local route date/time values must be timezone-safe so a future morning route does not shift because of UTC or daylight-saving conversion;
- new planning records should use stable identities and revision/update boundaries that do not depend on one browser being permanently authoritative.

Cross-system implication:

- the current workbook and Free Map Router handoff does not yet carry due date, service duration, or locked/assigned-day metadata;
- before any integration change, audit what exact InspectorADE/workbook fields are actually available and decide which system owns each planning field;
- additions to the workbook handoff must be backward compatible and optional unless explicitly versioned.

### Phase 2H — Time-Aware One-Day Planning

Improve one-day planning before multi-day Route Plans depend on it.

Workday defaults:

- **Departure:** route-day departure time chosen by the operator;
- **Preferred field-work finish:** default **3:00 PM**, editable for the selected day;
- **Home by:** default **5:00 PM**, editable for the selected day;
- 3:00 PM is a preferred field-work finish target, not an automatic route-failure boundary. The planner may show a sensible route that runs somewhat later when that still fits the operator's stronger home-by goal, but it must make the overrun visible rather than hiding it;
- the home-by value is the stronger daily planning bound. If the selected work cannot meet it, the planner must report the overflow/constraint conflict and require an operator adjustment or explicit override rather than silently exceeding it;
- these controls should have usable defaults and must not force an extra setup workflow for an ordinary one-day route.

Google-route requirements:

- feed realistic service duration into the Google model rather than the current zero-second visit assumption;
- use the selected future departure time so traffic-aware planning is based on the intended route date/time rather than simply the moment the Optimize button is pressed;
- preserve the current one-driver / one-vehicle round trip that starts and ends at Home;
- preserve traffic-aware time optimization, the working large-route 30s/60s solver timeout behavior, and complete-response validation;
- retain useful Google schedule output such as visit timing, vehicle start/end timing, and total service/travel duration so the app can show a truthful estimated day instead of only stop order;
- make those schedule facts available to the day summary / stop-card model without requiring a dense timetable as the first mobile UI;
- if the selected work cannot fit the chosen workday, report the overflow clearly rather than silently omitting work.

Planner UI foundation before Phase 2I depends on it:

- establish a real planning Map/List surface within the protected existing navigation rather than adding a new top-level page;
- establish reusable day-summary and stop-card data models before multi-day logic needs to render them;
- preserve exact work identities under each physical stop while displaying one numbered driving stop;
- separate primary planning/execution actions from secondary workbook, Garmin, clear, maintenance, and advanced controls in the page structure even if the first styling remains plain;
- design responsive ownership so later professional desktop/mobile presentation can be added without rebuilding route state or optimization logic;
- do not spend this phase on professional visual polish, animations, decorative styling, or a cosmetic redesign.

Basic route boundary:

- Basic Route remains a protected fallback ordering method;
- because it does not use Google's live/forecast traffic model, it must not present the same confidence in time-of-day/home-by estimates as Google Route.

### Phase 2I — Multi-Day Route Plans

Add a deliberate planning layer above the current Google/Basic route slots rather than multiplying ad-hoc saved routes.

Target model:

- **Route Plan** = all selected work to be completed across one or more days;
- **Day** = one dated subset of that plan with its own departure, preferred field-work finish, home-by, work-item assignments, and route status;
- **Route** = the Google or Basic ordering for that day;
- Route Plan / Day state must have stable identity/revision boundaries suitable for later stale-safe synchronization without requiring live sync in this phase;
- existing valid single-day Google/Basic route history must migrate safely into a one-day plan rather than disappear.

Planner behavior:

- allow Day 1 / Day 2 / Day 3 or automatic day count;
- multi-day planning is available when needed and must not replace the simple one-day path for smaller workloads;
- split the workload using geography plus due dates plus realistic service time and daily hours;
- keep multiple work items at one physical address on the same day by default so the operator is not sent to the same property on separate days without a deliberate override;
- allow manual movement or locking of work items between days before final optimization;
- every selected work item must appear exactly once across the active plan unless the operator explicitly removes it;
- no silent skipping, duplication, or overflow loss;
- optimize each day separately as one vehicle rather than pretending different calendar days are multiple simultaneous vehicles;
- make Google reoptimization an explicit action so automatic splitter retries cannot create wasteful API usage loops.

Active-plan completion and replacement rules:

- a completed work item disappears from the **remaining work** view but retains only the lightweight identity/status needed to prevent it from re-entering the active plan during replanning;
- do not accumulate duplicate copies of address, coordinates, pay, route geometry, notes, or other already-owned job data merely to preserve completed-route history;
- detailed completed-route history is not a permanent FMR archive requirement;
- when the operator starts creating a different Route Plan while another plan is active, FMR should warn that an active plan exists and ask whether to delete/replace it;
- confirming deletion/replacement may purge the old plan's temporary completion state as part of starting the new plan; cancelling must leave the current plan untouched.

Day summary direction:

- show work-item count and physical-stop count separately;
- show expected pay when available;
- show estimated service time, drive time, preferred field finish, and home time when supported by the chosen optimizer;
- use retained Google schedule/ETA facts to support useful stop cards and route summaries without requiring every timestamp to dominate the mobile screen;
- make it obvious which day and optimizer are currently displayed.

**Current status — 2026-09-08:** Complete. Phase 2I-A through 2I-D are merged and published. The final runtime is `de7d63909268f6bac770f671bad15991ae9fb954`. Route-history v7 / backup v5, multi-day Day management, local assignment, per-Day Workday state, manual move/lock, and active-plan completion/replacement are all in the published app. The final coherent deployed-artifact closeout smoke passed with no completed-work resurrection, no pending-work loss, and the five-page desktop/phone planner boundary preserved. See `docs/PHASE_2I_MULTI_DAY_ROUTE_PLAN_CLOSEOUT_2026-09-08.md`.

### Phase 2J — Day-Aware Workbook Return and Print

Make the workbook/FMR integration understand that one active day's route may be a deliberate subset of a larger Route Plan.

Required boundary:

- FMR remains the owner of the complete multi-day plan;
- **Send Route Order to Workbook** sends the active day only;
- the workbook numbers/prints only that returned day while leaving the other planned days stored in FMR;
- the existing exact current-inbox protection must be evolved safely so a valid Day 1 subset is not misclassified as a damaged/missing-ID return merely because Day 2 and Day 3 remain in the source planning pool;
- returned InspectorADE Order IDs and manual `Gig_ID`s remain exact work identity; address text remains context only;
- Day 2 can later be sent/printed without requiring the operator to rebuild the full plan or accidentally re-import Day 1 work;
- route date/day labeling should be visible enough that a printed packet cannot be mistaken for another day's route;
- the current misleading route-order success count should be cleaned up here so the message reports InspectorADE jobs, manual gigs, and total work items rather than only “workbook jobs.”

This phase is cross-application work and must use the Integration Contract / Cross-System Reality Gate when implementation is authorized.

### Phase 2K — Replanning, Persistence, Road Avoidance, and Real-World Soak

Finish the route-planning track by protecting it against the changes that happen during actual field work.

Replanning and persistence:

- a newer workbook export must not silently destroy an existing multi-day plan;
- new work arriving mid-plan must never silently reshuffle or replace the active plan. The exact first-version handling remains intentionally open until this phase is designed; an **Unplanned / New Work** staging area that waits for operator placement or suggestion is a candidate, not yet a locked implementation requirement;
- started, completed, printed, or otherwise locked work must not silently move to another day during replan;
- add an explicit **Replan Remaining From Here** path: initial planning remains `Home → planned work → Home`, while an in-field replan uses the current/chosen position → unfinished work → Home;
- Replan Remaining uses only unfinished work and the active plan's lightweight completion identity so completed jobs cannot be re-added;
- the first version does not require continuous background GPS/fleet tracking. A user-invoked current-location or chosen-current-point replan is sufficient;
- backups/restores must preserve the multi-day plan and its exact work-item identity;
- any future true multi-device route-plan editing must use stale-safe revision rules and an authenticated central authority rather than treating backup/restore as live synchronization;
- Firestore, a central database behind the existing backend, or another sync provider is not selected by this roadmap update; true-sync implementation remains a separate future governed design;
- API usage should be guarded so FMR performs local/geographic candidate splitting first and sends only serious day candidates to Google rather than brute-force retrying many combinations.

#### Standard known-road / construction avoidance

Known-road/construction avoidance is a **standard built-in route-planning capability**.
