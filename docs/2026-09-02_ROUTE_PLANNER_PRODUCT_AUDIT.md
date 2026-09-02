# Free Map Router — Route Planner Product Audit

**Date:** 2026-09-02  
**Status:** PRODUCT / ROADMAP AUDIT — NO RUNTIME CODING AUTHORIZED  
**Change class:** Level 1 documentation-only analysis  
**Production FMR baseline:** `c9d9b118f74678ae02c934c5bb50f02794c6fa06`  
**Primary roadmap:** `docs/FIELD_WORK_EXPANSION_PLAN.md`

## Purpose

Audit the current Free Map Router roadmap and live product shape before additional route-planning runtime work begins.

The questions are:

- Are we building the right route-planning architecture?
- Will the app feel and work like a modern route planner rather than a collection of utilities?
- What is already strong and should be preserved?
- What is weak, missing, or likely to create operational friction?
- What is bloated or premature?
- Which audit recommendations should actually change the roadmap, and which should remain deferred ideas?

This is an audit/design record only. It changes no runtime code, route storage, workbook handoff, Google API behavior, Drive data, permissions, deployment, or app behavior. It also does **not** change the roadmap in this commit. The audit is intentionally recorded first so the operator can review the proposed roadmap deltas separately.

## Sources inspected

### Free Map Router governance and roadmap

- `AGENTS.md`
- `CHANGE_CONTROL_CONTRACT.md`
- `CONTRACT.md`
- `INTEGRATION_CONTRACT.md`
- `docs/FIELD_WORK_EXPANSION_PLAN.md`
- `docs/2026-08-27_PHASE_3_FIELD_PHOTO_DESIGN_AUDIT.md`

### Current runtime surfaces relevant to this audit

- `index.html`
- `route-history.js`
- `google-route-provider.js`

### Product/API comparison used during the audit discussion

The audit discussion also compared the current design direction against common modern route-planner patterns and Google Route Optimization capabilities, including:

- time-aware route planning;
- service durations;
- vehicle/visit time windows;
- stop-level ETA/schedule output;
- reoptimization when work conditions change;
- visual route planning and stop-list interaction;
- route restrictions / road-avoidance limitations;
- distinction between a planned route and remaining active work.

External product comparison is supporting design context only. Repository contracts and the operator's real workflow remain the controlling source for Free Map Router behavior.

## Executive assessment

The underlying route-planning architecture is substantially stronger than the current product presentation.

The app is **not on the wrong path**. Several of the expensive architectural decisions are already correct:

- exact work identity is separate from physical-address identity;
- several jobs can share one physical stop without becoming one job;
- InspectorADE work and manual gigs can share one route without contaminating InspectorADE prediction history;
- one driver / one vehicle remains the correct operating model;
- Google and Basic route choices remain protected;
- future multi-day planning is modeled as a higher-level Route Plan rather than as a pile of unrelated saved routes;
- workbook ownership and FMR ownership are being separated intentionally;
- selectable sync is planned before more sophisticated planning depends on the incoming work pool;
- advanced controls are planned as capabilities with sensible defaults rather than mandatory wizard steps.

The main risk is **product shape**, not core identity architecture.

If every planned capability is exposed as another equal-weight button, field, tab, status line, or maintenance control, Free Map Router can become technically capable but operationally noisy. A modern planner should center the user experience on the current day, the route map, remaining work, timing, and one or two primary actions. Secondary controls should remain available without dominating the page.

## What the project is doing right

### 1. Work-item identity is stronger than address-based planning

The roadmap correctly assigns planning metadata such as duration, due date, and day assignment to the exact work item (`Source_ID` / Order ID or `Gig_ID`) rather than to the address.

This is essential because one property may contain more than one job with different pay, duration, due-date, completion, or workbook identity.

**Keep this. Do not simplify it away.**

### 2. Shared physical stops are modeled correctly

One address may be one driving stop while still retaining every exact work identity attached to it.

That is the correct route-planner abstraction:

- one drive;
- one map stop;
- multiple work items when necessary;
- combined service time at that physical stop;
- no identity merging.

### 3. One-driver / one-vehicle is the correct product boundary

Free Map Router does not need fleet-dispatch complexity merely because commercial route products support fleets.

The operator is planning one driver's work. Multi-day planning should continue to mean one driver across several calendar days, not several simultaneous vehicles.

### 4. The Route Plan → Day → Route concept is sound

The proposed internal model is strong:

- **Route Plan** = the selected workload across one or more days;
- **Day** = one dated portion of that plan;
- **Route** = the Google or Basic ordering for that day.

This is preferable to accumulating unrelated current/previous/day-1/day-2 route snapshots.

### 5. Time-aware routing belongs in the core planner

The proposed planning inputs are useful and grounded in the operator's real workflow:

- route date / departure time;
- normal inspection planning default around 5 minutes;
- interior inspection planning default around 20 minutes;
- stop-work preference around 3:00 PM;
- home-by target around 5:00 PM;
- per-work-item override when a job is known to differ.

The important principle is that the defaults should make an ordinary route easy. The operator should not be required to configure every field every day.

### 6. The roadmap correctly separates route-planning ownership from workbook ownership

FMR should own the multi-day plan. The workbook should remain the workbook/job-history/print side rather than becoming the long-term database for temporary day assignments.

This boundary should remain protected.

### 7. Road/construction avoidance belongs in the standard toolset

Known-road / construction avoidance is correctly treated as a standard planned capability rather than an optional product add-on.

The operator should not be required to enter a restriction when nothing is wrong, but when field knowledge says a bridge or corridor is closed, the planner should have a normal place to record and use that information.

### 8. Fail-closed integration behavior is valuable

The integration contract is intentionally strict about exact IDs, stale handoffs, duplicates, and ambiguous matches.

That strictness may feel heavy internally, but it protects against the much worse failure mode: a route that silently sends, prints, completes, or renumbers the wrong work.

The fix is to simplify the visible operator flow, not to weaken the identity rules.

## What is weak or missing

### Finding 1 — Build Route is still a utility panel rather than a modern planning surface

The current Build Route page exposes many actions at similar visual weight, including:

- workbook route check;
- Basic optimization;
- Google optimization;
- clear route;
- open in Google Maps;
- send route order to workbook;
- Garmin export;
- clear InspectorADE jobs;
- clear manual gig work;
- Start Navigation;
- Done & Navigate Next.

Each action may be legitimate. The problem is that the page does not yet establish a strong visual hierarchy.

A modern planning surface should revolve around:

- current day / route-plan context;
- map;
- numbered stops;
- remaining work;
- expected pay;
- expected service/drive time;
- estimated work finish / home time;
- one primary planning action;
- one primary field-execution action.

**Audit recommendation:** move the modern planning-map / stop-card UX earlier in the route-planning track, before sophisticated multi-day management is built on top of a plain list.

### Finding 2 — the planning map arrives too late in the current roadmap

Multi-day planning is difficult to understand or manually correct without seeing the geographic split.

A user should be able to look at Day 1 / Day 2 and immediately see whether the partition makes geographic sense.

A numbered internal route map also helps with:

- same-address review;
- known-road warnings;
- manual day movement;
- route sanity checks;
- visual understanding of why a day is too long.

**Audit recommendation:** introduce a Build Route planning map / map-list interaction before or as part of the first multi-day implementation, not as cleanup at the end.

### Finding 3 — 3:00 PM should be a preferred field-work finish, not automatically a hard failure boundary

The operator's clarified workflow is:

- typically stop doing jobs around 3:00 PM;
- use the remaining travel time to be home around 5:00–5:30 PM depending on location;
- sometimes work later when the day justifies it.

Therefore 3:00 PM is better modeled as a **preferred field-work finish target**.

The home-by value is the stronger operational constraint, but it is still editable by day.

A good planner should be able to report, for example:

> Best route finishes field work at 3:18 PM and returns home about 4:46 PM.

rather than incorrectly declaring the whole plan invalid solely because one worthwhile job extends a few minutes beyond 3:00 PM.

**Audit recommendation:** revise the roadmap wording so 3:00 PM is a soft/preferred work-stop target by default, with an operator-selectable stricter mode only if later needed. Keep home-by editable.

### Finding 4 — planned route and remaining route need separate concepts

Current `Done & Navigate Next` behavior removes completed work from the active route. That is useful for reducing the remaining list, but a future multi-day planner needs enough state to prevent completed work from being re-added during a replan.

The original audit suggestion was to **preserve completed stops**. The operator correctly raised a storage/memory concern.

That original wording is superseded by the correction below.

## Completed-stop correction — accepted operator constraint

Do **not** build an unlimited detailed completed-route archive into Free Map Router.

The correct model is:

- a completed stop disappears from the **remaining work** view;
- while the current Route Plan is active, FMR retains only enough lightweight completion identity/status to know that the work is already done and must not be re-added during replanning;
- the active plan may retain a small completion timestamp/status when useful;
- detailed duplicate copies of address, coordinates, pay, route geometry, map data, notes, and other already-owned job data should not be accumulated merely to preserve route history;
- when the Route Plan is deliberately closed/finished, detailed completed-route state should be purged unless a later separately approved bounded-history feature proves useful;
- permanent job history remains in the systems that already own it (InspectorADE workbook history and manual gig records), not in a second FMR route-history archive.

**Accepted design principle:** preserve lightweight completion state for the active Route Plan, not permanent completed-stop history.

This still enables safe replanning without turning browser storage into a route-history attic.

### Finding 5 — the planner needs an explicit “Replan Remaining” model

Initial daily planning should continue to build a round trip:

`Home → planned work → Home`

But once the driver is already in the field, replanning should not pretend the vehicle is still at Home.

A modern field flow should eventually support an explicit action such as:

**Replan Remaining From Here**

Conceptually:

`current location / chosen current point → remaining unfinished work → Home`

Completed work remains locked out through the lightweight active-plan completion state described above.

This does **not** require continuous background GPS tracking or fleet telemetry. A user-invoked current-location replan is sufficient for the first version.

### Finding 6 — stop-level ETA/schedule output is useful and currently discarded

The current Google provider mainly converts the result into:

- ordered stop IDs;
- skipped stop IDs;
- total distance;
- total duration.

The future time-aware planner will benefit from retaining useful schedule facts such as visit timing and route start/end timing.

This does not mean every timestamp must be shown permanently. It means the planner should have enough schedule information to support a useful planning view.

Potential visible result:

| Stop | Work | ETA | Service |
| --- | --- | ---: | ---: |
| 01 | GIS inspection | 8:14 AM | 5m |
| 02 | interior inspection | 8:31 AM | 20m |
| 03 | GIS inspection | 9:08 AM | 5m |

**Audit recommendation:** keep schedule/ETA support in the time-aware planning phase, but do not require a dense schedule table in the first mobile UI. Use the data to power cards and summaries.

### Finding 7 — Home should eventually become an operational dashboard, not primarily a setup page

The current Home page is mainly Home Base configuration.

That is appropriate during setup but weak as the mature landing experience.

A route-planner home surface should eventually prioritize useful current-day information such as:

- work available;
- work planned today;
- work planned on later days;
- expected pay;
- departure;
- preferred field-work finish;
- estimated home time;
- due work;
- known road restrictions;
- a clear **Start Today's Route** action.

Home Base editing can remain available without being the dominant daily experience.

**Audit recommendation:** add a bounded Home/dashboard UX-polish item after the route-plan foundation is stable. Do not rebuild Home before the planner has reliable day data.

### Finding 8 — generic “priority” is premature UI

The roadmap mentions due date / priority / locked-day information.

Due date, assigned day, locked day, service duration, and manual movement all have concrete operator meaning today.

A separate High / Medium / Low priority field is not yet grounded in an observed workflow need and would add another algorithm rule and another UI control.

**Audit recommendation:** keep room for priority internally if future evidence requires it, but do not expose or depend on a generic priority field in the first route-planning release.

### Finding 9 — road avoidance is valuable, but arbitrary street blacklisting must not be overpromised

The requirement is good. The implementation must be truthful.

A first useful version may need to:

- store the known restriction;
- show it on the planning surface;
- warn when a route appears to depend on the affected corridor;
- offer replan / detour-assist / ignore behavior;
- preserve the fact that Google Maps navigation may recalculate its own road path.

The feature should not claim that an arbitrary road can always be technically blacklisted in every Google navigation path unless a verified implementation proves that behavior.

### Finding 10 — multi-day planning should remain a two-stage problem

The cleanest first design is:

**Pass 1 — Day assignment**

Use the available planning facts to create sensible day groups:

- geography;
- due date;
- service duration;
- available day length;
- same-address grouping;
- manual day locks/moves.

**Pass 2 — Route optimization**

Optimize each selected day as one driver / one vehicle.

If a day comes back too long, move only boundary work and re-run that day rather than brute-forcing many Google combinations.

This keeps API use predictable and makes the planner's behavior explainable.

## What is bloated

### 1. Equal-weight controls are bloated; the underlying capabilities are not necessarily bloated

The app has accumulated several legitimate controls. The UI becomes bloated when all of them remain visible and equally prominent during ordinary routing.

Recommended hierarchy:

**Primary daily actions**

- Optimize / Plan
- Start Route

**Secondary planning actions**

- Edit Plan
- Replan Remaining
- switch Google / Basic
- known road restrictions
- move/lock work between days

**Utility / integration / maintenance actions**

- send route order to workbook;
- Garmin export;
- clear one work type;
- clear route;
- integration/status tools.

Do not delete useful capability merely to make the screen shorter. Group and subordinate it.

### 2. Route planning and field-operations/media work are becoming visually mixed in one long master roadmap

The master roadmap currently covers two related but distinct product lanes:

**Route Planner Core**

- sync;
- work-item planning metadata;
- time-aware routing;
- map/list planner;
- multi-day route plans;
- replanning;
- workbook day return/print;
- road restrictions;
- route UX polish.

**Field Operations**

- work-order view;
- evidence requirements;
- photo capture/attachment;
- business Drive media;
- file organizer integration.

These should remain in one master source of truth, but the roadmap should visually separate the two lanes so route-planner work is not buried under photo/media architecture and vice versa.

### 3. Permanent route-history accumulation would be bloat

Do not add an unlimited Recent Routes archive merely because commercial software has history screens.

The operator has not established a need for detailed permanent route history, and long-term job history already belongs elsewhere.

Use active-plan completion state and purge detailed finished-route state unless later evidence proves a bounded history feature is worth the storage and UI cost.

### 4. Generic priority is bloat until a real workflow requires it

Do not expose a control merely because route-planning APIs support it.

### 5. Continuous fleet-style live tracking would be bloat

The first useful field replan can be user-initiated.

Do not add continuous GPS tracking, dispatch telemetry, background monitoring, or fleet dashboards for a one-driver system unless a future use case explicitly requires them.

## Target modern planner experience

The long-term Build Route surface should feel approximately like this conceptually:

> **MON SEP 7**  
> 27 work items · 24 physical stops · $344 expected  
> Depart 7:30 AM · preferred field finish ~3:08 PM · home ~4:42 PM
>
> **Map | List**
>
> numbered route / stop cards
>
> **Optimize**   **Start Route**
>
> Edit Plan / More

The exact UI is not approved by this audit. The important design rule is visual hierarchy:

- the day's plan is the product;
- the map/list explains the plan;
- primary field actions stay obvious;
- maintenance/integration controls remain reachable without dominating the screen.

## Recommended build-order adjustment

The audit recommends this product-oriented route-planning sequence for roadmap review:

1. **Selectable Sync Cleanup** — trust the incoming work pool.
2. **Work-item duration and due-date foundation** — give the planner realistic workload facts.
3. **Time-aware single-day Google routing** — validate service times, future departure, preferred field finish, and home-by behavior.
4. **Modern planning map + stop cards / map-list interaction** — create the visual planning surface before multi-day complexity lands.
5. **Multi-day day-assignment engine** — geography + due date + service duration + available day.
6. **Lightweight active-plan completion state** — completed work disappears from remaining work but stays locked out while the active plan exists; purge detailed completed-route state when the plan closes.
7. **Replan Remaining From Here** — current position / chosen current point → unfinished work → Home.
8. **Day-aware workbook return and print** — active-day subset handoff with exact identities.
9. **Known-road / construction handling** — standard planner capability, truthful about Google Maps recalculation limits.
10. **Real-work soak and calibration** — compare estimates to actual field results and tune defaults.
11. **Route-planner UX polish** — Home/day summary, reduce equal-weight controls, field-friendly mobile run mode.
12. **Resume Phase 3 field-work/photo runtime** once the route/day model is stable enough not to be rebuilt underneath it.

This is an audit recommendation, not a roadmap edit.

## Roadmap delta candidates

The following items are the audit recommendations that appear strong enough to justify roadmap changes **if the operator approves them after reviewing this audit**.

### Candidate A — add an explicit planning-map / stop-card phase before multi-day complexity

**Recommendation:** YES — roadmap change recommended.

Reason: multi-day planning without visual geography would make a correct engine hard to understand and manually correct.

### Candidate B — change 3:00 PM from a hard field-work cutoff to a preferred field-work finish target

**Recommendation:** YES — roadmap wording/behavior change recommended.

Reason: this matches the clarified real workflow. Home-by remains editable and is the stronger daily bound.

### Candidate C — replace “preserve completed stops” with lightweight active-plan completion identity

**Recommendation:** YES — roadmap change recommended.

Reason: protects replanning while avoiding unbounded storage/history accumulation.

### Candidate D — add explicit “Replan Remaining From Here” capability

**Recommendation:** YES — roadmap change recommended.

Reason: a route planned at Home and a route replanned five hours later are different problems. Continuous fleet tracking is not required.

### Candidate E — retain useful Google schedule/ETA facts for planner summaries and stop cards

**Recommendation:** YES — roadmap clarification recommended.

Reason: the time-aware planner should not throw away schedule information it needs to explain the day.

### Candidate F — visually separate Route Planner Core from Field Operations inside the same master roadmap

**Recommendation:** YES — documentation structure change recommended.

Reason: one source of truth is still desirable, but two product lanes should not be interleaved into one mental stack.

### Candidate G — move Home/dashboard modernization into later route-planner UX polish

**Recommendation:** YES, but later — roadmap note recommended, not an early runtime phase.

Reason: the dashboard becomes useful only after reliable day-plan data exists.

### Candidate H — remove generic priority from the first route-planning release

**Recommendation:** YES — roadmap scope reduction recommended.

Reason: due date / assigned day / locked day already cover observed needs. Priority can remain a future possibility.

### Candidate I — keep road avoidance standard but define the first version around planning/warnings rather than a guaranteed arbitrary-road blacklist

**Recommendation:** YES — roadmap clarification recommended.

Reason: preserves the important field feature without promising technical control the current Google Maps navigation contract may not provide.

### Candidate J — do not add permanent detailed route history

**Recommendation:** YES — explicit anti-bloat boundary recommended.

Reason: no demonstrated operational need; active-plan state is enough for safe replanning.

## Recommendations that should **not** become roadmap commitments yet

The audit intentionally does **not** recommend committing these now:

- continuous GPS/fleet tracking;
- dispatcher/fleet dashboards;
- permanent detailed route archive;
- generic High/Medium/Low priority UI;
- lunch/break scheduling as a required first-release rule;
- AI-estimated service duration;
- automatic portal/client deadline ingestion;
- a dense stop-by-stop schedule table as mandatory mobile UI;
- guaranteed arbitrary-street blocking in Google Maps navigation;
- automatic background replanning;
- a new top-level page merely to hold planning controls.

These ideas may become useful later, but adding them now would increase scope without enough evidence.

## Product lanes recommended for the master roadmap

### Lane 1 — Route Planner Core

- selectable sync;
- per-work-item duration/due-date foundation;
- time-aware single-day routing;
- planning map / stop cards;
- multi-day Route Plan;
- lightweight active-plan completion state;
- Replan Remaining From Here;
- day-aware workbook return/print;
- known-road/construction handling;
- field calibration;
- route-planner UX polish.

### Lane 2 — Field Operations

- HNP/manual work-order view;
- evidence checklist/state;
- photo handling;
- business Drive media;
- file-organizer integration.

The lanes share work identity and route context but should not be implemented as one giant release.

## Final audit conclusion

Free Map Router's core planning architecture is in good shape. The project is not suffering from an identity-model failure or a fundamentally wrong routing strategy.

The primary weaknesses are:

- a button-heavy current planning surface;
- insufficient visual planning emphasis;
- incomplete distinction between planned work, remaining work, and completed active-plan state;
- missing field replan semantics;
- a 3:00 PM rule that should match the operator's real preference rather than become unnecessarily rigid;
- a master roadmap that contains both route-planner and field-media lanes without enough visual separation.

The right correction is **not** to replace the architecture. It is to improve product hierarchy, move the map earlier, make time behavior more realistic, keep completion state lightweight, add deliberate remaining-route replanning, and remove premature controls such as generic priority.

If those changes are adopted, the roadmap is well positioned to produce a modern one-driver field route planner while preserving the exact identity, workbook, manual-gig, Drive, and rollback protections already built.

## Change-control record for this audit

- **Changed surface:** this new audit file only.
- **Why Level 1:** documentation-only analysis; no runtime, stored data, route order, workbook handoff, API, Drive, permission, or deployment behavior changes.
- **Protected behavior:** all current production app behavior and the existing `docs/FIELD_WORK_EXPANSION_PLAN.md` remain unchanged.
- **Verification:** diff/contract review and repository CI only; no runtime smoke test is required for this documentation-only record.
- **Integration:** No workbook/router integration impact.
- **Roadmap authorization:** none. This audit records evidence and recommendations first; any roadmap edit must be reviewed separately after the operator sees the exact delta candidates above.
