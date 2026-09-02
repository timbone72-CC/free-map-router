# Free Map Router — Field Work Expansion Roadmap

**Status:** IN PROGRESS — PHASE 2 PRODUCTION-VALIDATED / PHASE 2F-2K ROUTE-PLANNING TRACK PLANNED / PHASE 3 DESIGN AUDIT STARTED  
**Updated:** 2026-09-02  
**Primary repo:** `timbone72-CC/free-map-router`

## Purpose

Make this document the durable execution roadmap for expanding Free Map Router from a workbook-fed route optimizer into a broader field-work tool that can also handle manually entered gigs, route pay, realistic workday planning, multi-day routes, HNP work orders, job-site photos, business Drive storage, and later file-organizer integration.

This is the single planning source of truth for this expansion. Add future ideas here instead of scattering the same plan across multiple documents.

## Data Ownership Rules

- Every manually created gig receives a stable internal `Gig_ID` or equivalent permanent job identity. Address alone is never the job identity.
- Vendor work-order IDs remain stored separately when available.
- InspectorADE jobs and HNP/other gigs may share one route experience, but HNP/other gigs must not enter InspectorADE prediction history or be treated as InspectorADE repeats.
- The app owns route-stop state and field capture state.
- Planning metadata such as estimated service time, due date, planning priority, and day assignment belongs to the exact work item (`Source_ID`/Order ID or `Gig_ID`), not merely to the physical address.
- A physical address may still route once while contributing the combined service time of multiple distinct work items at that stop.
- A future multi-day **Route Plan** is owned by Free Map Router. The workbook may receive the active day's route for numbering/printing, but it must not become the durable database for the whole multi-day plan.
- `Gig_Log` is the durable workbook mirror/ledger for manual gig/pay data; workbook-owned `Actual_Pay` must survive later FMR syncs.
- Google Drive owns job media files once the Phase 4 storage design is approved; the app will record upload state and location rather than treating transient browser state as the durable media archive.
- Existing InspectorADE/workbook address corrections remain owned by the permanent address-corrections store. They are not replaced by the Manual Work Library or by point-in-time backups.
- Cross-device writes must be stale-safe so an older phone/PC state cannot silently replace newer job data.

## Target User Flow

1. Receive InspectorADE jobs from the workbook and/or manually add an HNP or other gig in Free Map Router.
2. Mix all selected work into one planning pool while retaining each exact Order ID / `Gig_ID` even when several work items share one physical address.
3. For an ordinary one-day route, optionally set the route date, departure time, stop-work time, home-by time, and realistic service duration; normal inspection work starts with a five-minute planning default and interior inspections with a twenty-minute planning default unless explicitly overridden.
4. For a larger workload, create a multi-day Route Plan so work can be divided into Day 1 / Day 2 / Day 3 or an automatic number of days without losing or duplicating any selected work item.
5. Optimize each chosen day using the existing Basic or Google route paths; Google remains the traffic-aware time-planning authority while Basic remains the protected fallback route-order option.
6. Show expected route pay, work-item count, physical-stop count, estimated service time, and estimated finish/home time for the selected day where the available data supports it.
7. Use the built-in known-road/construction-avoidance capability when field knowledge says a road or corridor should not be used even if Google's current road data has not caught up. The capability is a standard part of route planning, while entering a restriction is only necessary when there is actually something to avoid.
8. Tap an HNP stop to open its job/work-order view.
9. Capture or attach required job-site photos from the phone using an evidence plan tied to the exact gig/work order, not merely a loose camera roll.
10. Keep each photo tied to the correct `Gig_ID`, work order, evidence category/line item, and capture session from the moment it enters the job workflow.
11. Preserve the original field evidence and any required capture metadata; derivative resize/compression is allowed only after the client-specific requirement is known.
12. Save/upload job media safely to the configured Google Drive destination, with recoverable pending state when offline or interrupted.
13. Send the HNP/gig record and relevant work-order information to the gig side of the workbook and include it on the Google Print route output where appropriate.
14. Record actual pay later without overwriting what the route was expected to earn when planned.

## Route-Planning Usability Principle

The route-planning upgrades are capabilities, not mandatory wizard steps.

- The current simple one-day routing path must remain quick and usable when the operator does not need advanced planning controls.
- Departure time, stop-work time, home-by time, per-work-item duration overrides, multi-day planning, manual day locking, and similar planning controls should be available when useful without forcing the operator to configure every field for every route.
- Sensible defaults should carry ordinary routes so the operator can use the extra detail only when the day requires it.
- Standard built-in capabilities such as known-road/construction avoidance remain part of the product even though no restriction entry is needed on days when there is nothing known to avoid.

## Planned Job Lifecycle

Initial lifecycle to validate during implementation:

`RECEIVED -> ROUTE_PLANNED -> IN_PROGRESS -> PHOTOS_PENDING -> COMPLETE -> UPLOADED -> SUBMITTED -> PAID`

The exact labels may change before implementation, but the build must have an explicit lifecycle rather than unrelated checkboxes scattered across the app and workbook.

Rules:

- Completion and upload are separate states.
- A job can be complete in the field while media upload is still pending.
- A failed upload cannot silently mark a job uploaded.
- Later workbook/pay edits must not erase field evidence or route history.

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
- do not infer or hard-code which InspectorADE job codes are interior until the mapping is verified against real work;
- if one physical stop contains a five-minute job and a twenty-minute job, the planner should treat that stop as one drive stop with **25 minutes** of service time;
- manual/HNP gigs may later carry their own default or per-occurrence duration without changing physical-stop identity;
- due date / priority / locked-day information, when available, belongs to the exact work item;
- geography must not push genuinely due work to a later day merely because another split looks cleaner;
- local route date/time values must be timezone-safe so a future morning route does not shift because of UTC or daylight-saving conversion.

Cross-system implication:

- the current workbook Address Inbox is address-oriented, so any future InspectorADE per-order planning metadata must be added backward-compatibly and must retain exact `Source_ID` ownership;
- the workbook must not become the durable owner of FMR route-day state.

### Phase 2H — Time-Aware Single-Day Routing

Make the existing Google route model reflect the operator's real working day before multi-day splitting is introduced.

Initial workday controls:

- **Route date / departure time:** operator-selected, with a convenient current-time default for same-day planning;
- **Stop working jobs:** default **3:00 PM**, editable for the selected day;
- **Home by:** default **5:00 PM**, editable for the selected day;
- the 3:00 PM target means the field work itself should normally be finished by then, not merely that a final long inspection may begin at 2:59 PM;
- the home-by value reserves the remaining time for the return trip and may be changed on days the operator is willing to work later;
- these controls should have usable defaults and must not force an extra setup workflow for an ordinary one-day route.

Google-route requirements:

- feed realistic service duration into the Google model rather than the current zero-second visit assumption;
- use the selected future departure time so traffic-aware planning is based on the intended route date/time rather than simply the moment the Optimize button is pressed;
- preserve the current one-driver / one-vehicle round trip that starts and ends at Home;
- preserve traffic-aware time optimization, the working large-route 30s/60s solver timeout behavior, and complete-response validation;
- retain useful Google schedule output such as visit timing, vehicle start/end timing, and total service/travel duration so the app can show a truthful estimated day instead of only stop order;
- if the selected work cannot fit the chosen workday, report the overflow clearly rather than silently omitting work.

Basic route boundary:

- Basic Route remains a protected fallback ordering method;
- because it does not use Google's live/forecast traffic model, it must not present the same confidence in time-of-day/home-by estimates as Google Route.

### Phase 2I — Multi-Day Route Plans

Add a deliberate planning layer above the current Google/Basic route slots rather than multiplying ad-hoc saved routes.

Target model:

- **Route Plan** = all selected work to be completed across one or more days;
- **Day** = one dated subset of that plan with its own departure, stop-work, home-by, work-item assignments, and route status;
- **Route** = the Google or Basic ordering for that day;
- existing valid single-day Google/Basic route history must migrate safely into a one-day plan rather than disappear.

Planner behavior:

- allow Day 1 / Day 2 / Day 3 or automatic day count;
- multi-day planning is available when needed and must not replace the simple one-day path for smaller workloads;
- split the workload using geography plus due dates / priority plus realistic service time and daily hours;
- keep multiple work items at one physical address on the same day by default so the operator is not sent to the same property on separate days without a deliberate override;
- allow manual movement or locking of work items between days before final optimization;
- every selected work item must appear exactly once across the active plan unless the operator explicitly removes it;
- no silent skipping, duplication, or overflow loss;
- optimize each day separately as one vehicle rather than pretending different calendar days are multiple simultaneous vehicles;
- make Google reoptimization an explicit action so automatic splitter retries cannot create wasteful API usage loops.

Day summary direction:

- show work-item count and physical-stop count separately;
- show expected pay when available;
- show estimated service time, drive time, and home time when supported by the chosen optimizer;
- make it obvious which day and optimizer are currently displayed.

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
- new work arriving mid-plan should be reviewable and deliberately inserted into an existing day or a new day;
- started, completed, printed, or otherwise locked work must not silently move to another day during replan;
- backups/restores must preserve the multi-day plan and its exact work-item identity;
- any future true multi-device route-plan editing must use stale-safe revision rules rather than treating backup/restore as live synchronization;
- API usage should be guarded so FMR performs local/geographic candidate splitting first and sends only serious day candidates to Google rather than brute-force retrying many combinations.

#### Standard known-road / construction avoidance

Known-road/construction avoidance is a **standard built-in route-planning capability**.

It is not an optional add-on that may be omitted from the planned product. At the same time, ordinary routing must not force the operator to enter or acknowledge a restriction when there is no known road problem that day.

Design direction:

- the feature ships as part of the standard route-planning toolset;
- when no known restrictions are recorded, routing proceeds normally with no extra required setup;
- the operator may add a known closed or undesirable road/corridor with a short name, reason, and optional until-date;
- the operator may remove, ignore, or temporarily disable any saved road restriction;
- the feature must never modify saved job addresses, Order IDs, `Gig_ID`s, permanent correction aliases, or prediction identity;
- when a restriction applies to a plan/day, FMR should use the known restriction as planning guidance and/or warn when the selected Google route appears to depend on that blocked corridor;
- because normal Google Maps multi-stop links recalculate the actual road path, the first version must not falsely promise that a marked road can never be used by Google Maps navigation;
- any later stronger enforcement method (for example, forced detour waypoints or a different route-path/navigation contract) requires its own design and approval rather than silently replacing the current Google Maps behavior.

This standard feature exists for cases where field knowledge is newer or more accurate than Google's current road-closure data. The capability should always be available even though the operator only needs to enter restrictions when a real closure or avoidance condition exists.

Real-world soak and calibration:

- test representative large routes, same-address multi-order stops, manual gigs, interior inspections, different departure/stop/home times, known road closures, and day-to-day replanning;
- compare predicted versus actual finish/home times;
- keep five-minute normal and twenty-minute interior service defaults as starting estimates, not immutable truths;
- add a configurable daily reserve/buffer only if field evidence shows the planner is consistently too aggressive;
- retain a clean rollback path between each implementation slice instead of shipping the whole track as one giant route-system replacement.

**Phase 2F-2K sequencing rule:** complete and validate each phase before making the next phase depend on it. Phase 3 design work may continue in parallel, but Phase 3 runtime coding should not depend on an unstable route/day identity model.

### Phase 3 — HNP Work-Order View and Field Photo Evidence

**Status:** DESIGN AUDIT IN PROGRESS — NO RUNTIME CODING AUTHORIZED.**

An HNP stop should be able to open a job/work-order view in the app, but the photo workflow must preserve field evidence and client-specific requirements rather than reducing every job to a generic Inside/Outside photo bucket.

Initial work-order concept to audit:

- work-order/job details and current instructions;
- evidence plan / required-shot checklist for the active order;
- broad groups such as Identity/Access, Exterior, Interior, Work/Line Item, Damage/Measurements, Notices/Final Secure where useful;
- before/during/after stages for work line items when required;
- required/collected photo counts as a completeness aid, not as a substitute for coverage;
- job notes and unable-to-complete/exception notes;
- field QC before leaving the property;
- completion action that cannot claim evidence-ready status when required evidence is missing.

Photo evidence requirements already established by the Phase 3 audit:

- Every photo entering the job workflow must be associated with exact `Gig_ID`, work-order ID when present, evidence category/line item, and capture/visit context.
- Original field photos are source evidence and must not be overwritten, renamed in place, moved, deleted, or silently stripped of metadata by the workflow.
- The active work order/client instructions control exact shot count, allowed image type/size, date/time/GPS requirements, line-item mapping, and submission deadline.
- Preserve capture date/time and GPS/location when the client requires them; do not invent missing metadata.
- Retakes and true accidental duplicates must remain distinguishable enough to avoid mixing required angles or visits.
- Before/during/after work should retain stage identity and matching-angle context when required.
- The app must support a field QC check before the operator leaves when a return trip would be costly or impossible.
- Compression/resizing may be used only after confirming client acceptance; originals remain retained separately.

Reliability requirements:

- Do not hold a large batch of full-resolution images only in volatile browser memory.
- Captured/attached evidence must have recoverable pending state before it is considered safe.
- Offline or failed uploads remain visibly pending; a failed upload cannot mark the job uploaded.
- Closing/reopening the app must not lose the job/evidence manifest for photos already accepted into the workflow.
- A later visit or correction must not overwrite the original visit record or original submitted package.

#### Phase 3 audit boundary with Field Photo Prep

A separate `field-photo-prep` project already has a contract foundation for protecting original photos while creating resized copies. Its approved role is company-neutral derivative preparation: select existing photos, create separate resized copies, preserve supported metadata, and share/upload those copies through Android. Its contract explicitly excludes a job database, vendor-specific workflow, automatic upload, and direct Drive API integration in the initial release.

Therefore the current design direction is:

- Free Map Router owns job identity, work-order context, evidence requirements, evidence manifest, route linkage, and job-level completion/QC state.
- Field Photo Prep may later remain an optional derivative-processing helper, but it must not become the authority for `Gig_ID`, work-order state, route state, or evidence completeness.
- Do not make Phase 3 depend on Field Photo Prep runtime until that project is itself approved and implemented; its GitHub `main` currently does not contain a production Android runtime.
- Do not duplicate photo-byte ownership in both apps without an explicit handoff contract.

See `docs/2026-08-27_PHASE_3_FIELD_PHOTO_DESIGN_AUDIT.md` for the evidence-based starting audit.

### Phase 4 — Business Google Drive Job Media

Photo/work-order storage must use a configurable Drive destination and must not hard-code the current personal Google account.

The design must support moving new job media to the business Google Drive/account without rebuilding the photo system.

Candidate structure:

```text
Field Jobs/
  HNP/
    2026/
      <ADDRESS>/
        <GIG_OR_WORK_ORDER_ID>/
          Work Order/
          Original Photos/
          Prepared Photos/
          <ADDRESS>-<GIG_OR_WORK_ORDER_ID>.zip
```

Drive requirements to settle before implementation:

- exact business account/folder ownership;
- authorization method used by the app/backend;
- private-by-default sharing behavior;
- who may access job folders;
- retention period for work orders, original photos, prepared copies, and ZIP packages;
- whether old personal-Drive records are migrated or only new jobs use business Drive;
- whether Drive retains individual photos, a ZIP package, or both.

Upload integrity:

- The app records pending, uploaded, and failed media state.
- A job is not marked fully uploaded until the expected files are verified at the destination.
- Cross-device retries must not duplicate or overwrite unrelated job media.
- Original evidence and prepared/upload copies must remain distinguishable.

### Phase 5 — Existing File Organizer Integration

Review the existing file-organizer workbook before assigning it responsibilities.

Preferred separation:

- Free Map Router owns the relationship between route stop, gig/work order, and the job evidence manifest.
- The organizer may handle later filing, cleanup, retention, movement, indexing, or archival.
- The organizer must not be required to infer which unsorted photos belong to which job.
- Do not duplicate a filing function in both systems unless one is explicitly the authoritative writer and the other is read-only/supporting.

### Phase 6 — Field Workflow Cleanup and Soak

After the core features work together:

- streamline taps and status visibility for phone use;
- clearly show job state, photo state, upload state, and pay state;
- confirm remote/multi-device edits cannot overwrite newer field state;
- add practical recovery for interrupted work;
- validate representative real HNP jobs before broad use.

A successful test run is not the end of the rollout. Use a controlled soak period with real jobs and watch for sync conflicts, missing photos, duplicate uploads, Drive filing errors, route-pay mismatches, and workbook handoff problems before expanding the feature set.

## Decisions Still Needed Before Phase 3 Photo Runtime

- Exact HNP/client image requirements: original resolution versus accepted resized copies, maximum/minimum dimensions, file type, and file-size limits.
- Exact HNP/client metadata requirements: visible timestamp, EXIF capture time, GPS/location metadata, or combinations of these.
- Whether work-order evidence is entered manually, imported from a file/message, or later parsed from another source.
- Whether the first Phase 3 runtime slice attaches existing camera photos to the exact gig or launches a camera/capture path from inside the job view.
- Whether required-shot rules begin as operator-entered checklists or use a small set of reusable work-type templates.
- Whether and how Field Photo Prep participates in derivative preparation without becoming a second job database.
- Exact business Drive account/folder ownership and authorization method for Phase 4.
- Whether Drive retains originals plus prepared copies, originals plus ZIP, or all three.
- Retention/deletion rules for original evidence, prepared copies, and corrected/resubmitted packages.

## Protected Existing Behavior

Future work must preserve unless a later approved change explicitly says otherwise:

- existing InspectorADE workbook-to-router import;
- exact workbook Order-ID and manual `Gig_ID` identity handoff;
- permanent InspectorADE/workbook address corrections: once a correction is successfully stored in Google Drive, future matching workbook imports should reuse it rather than requiring the operator to correct the same incoming address again;
- governed Free Map Router Drive resource identity and limited `drive.file` scope unless a later approved design proves a permission change is required;
- Basic and Google route choices;
- current one-driver / one-vehicle routing model;
- corrected-address behavior and source association;
- manual **Include in Route** selections and shared-stop behavior;
- same-address work-item identity remaining distinct while the property routes once;
- route persistence and backup behavior;
- route expected-pay behavior and blank-pay warning semantics;
- Google Print output for current InspectorADE and manual gig work;
- navigation/export behavior;
- current Google Maps navigation behavior unless a later road-avoidance design explicitly changes it;
- known-road/construction avoidance is a standard built-in planning capability, while ordinary routing remains usable with no restriction entries when nothing is known to be blocked;
- InspectorADE prediction/history isolation from unrelated gigs;
- workbook ownership of `Actual_Pay`.

## Risk and Change-Control Notes

- This 2026-09-02 roadmap correction is documentation-only Level 1 work. It clarifies that known-road/construction avoidance is a standard planned route feature and that earlier advanced planning controls are capabilities with usable defaults rather than mandatory setup steps; it authorizes no runtime, storage-schema, handoff, API-permission, route-algorithm, Drive, workbook-data, or deployment change.
- Changed surface for this roadmap correction: `docs/FIELD_WORK_EXPANSION_PLAN.md` only.
- Protected behavior: all current production routing, Google/Basic selection, exact Order-ID/`Gig_ID` identity, Drive resources, workbook handoffs, predictions, manual gigs, printing, navigation, and five-page app navigation remain unchanged by this documentation update.
- Verification for this Level 1 update is diff/contract review only; no runtime test or live smoke check is required because no runtime file changes.
- No workbook/router integration impact from this documentation-only change. Future Phase 2F/2G/2J implementation will have cross-system impact and must use `INTEGRATION_CONTRACT.md` and the Cross-System Reality Gate when separately authorized.
- The prior 2026-08-27 roadmap/status update and Phase 3 audit were also documentation-only Level 1 work and authorized no runtime, permission, schema, Drive-media, or deployment change.
- A work-order view that only presents already-stored gig data may be normal feature work, but any new persistent evidence/job schema must be classified by its real storage impact.
- Photo persistence, automatic uploads, business Drive media creation, new OAuth scopes, cross-device media state, and deletion/retention behavior are Level 3 candidates and require their own impact record and explicit pre-merge approval.
- Do not combine selectable sync, work-item planning metadata, time-aware routing, multi-day storage migration, day-aware workbook return, road avoidance, work-order UI, photo-byte storage, compression, Drive upload, and file-organizer integration into one release.
- Each implementation slice must establish one durable ownership boundary and rollback point before the next slice starts.
- Phase 2 remains in real-work soak while Phase 3 is designed; do not reopen or modify R6 conflict reconciliation as part of this expansion.
