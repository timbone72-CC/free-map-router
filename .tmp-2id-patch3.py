from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one anchor, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


def append_once(path, marker, addition):
    p = Path(path)
    text = p.read_text()
    if marker in text:
        return
    p.write_text(text.rstrip() + "\n\n" + addition.strip() + "\n")

p = Path("route-plan-days.js")
s = p.read_text()
for old, new, n in [
    ("for (const item of plan.workItems) {", "for (const item of routePlan.remainingPlanWorkItems(plan)) {", 1),
    ("for (const standalone of plan.standaloneStops) {", "for (const standalone of routePlan.remainingStandaloneStops(plan)) {", 1),
    ("const standaloneStops = original.standaloneStops.map((stop) => ({", "const sourceWorkItems = replacing ? routePlan.remainingPlanWorkItems(original) : original.workItems; const sourceStandaloneStops = replacing ? routePlan.remainingStandaloneStops(original) : original.standaloneStops; const standaloneStops = sourceStandaloneStops.map((stop) => ({", 1),
    ("const workStopIds = new Set(original.workItems.map((item) => item.stopId));", "const workStopIds = new Set(sourceWorkItems.map((item) => item.stopId));", 1),
    ("return { dayId, revision:", "return { ...(previous?.completedWorkItems?.length ? { completedWorkItems: previous.completedWorkItems } : {}), ...(previous?.completedStandaloneStops?.length ? { completedStandaloneStops: previous.completedStandaloneStops } : {}), dayId, revision:", 1),
    ("workItems: original.workItems, standaloneStops, days,", "workItems: sourceWorkItems, standaloneStops, days,", 1),
]:
    if s.count(old) < n:
        raise SystemExit(f"route-plan-days.js missing anchor {old!r}")
    s = s.replace(old, new, n)
p.write_text(s)

p = Path("route-plan-controls.js")
s = p.read_text()
old = '"This replaces current Day assignments and per-Day route versions for this active plan. " + "Saved addresses, pins, manual gigs, workbook history, permanent corrections, and the pending workbook route are not deleted.\\n\\n" + "Google will NOT be called automatically."'
new = '"This replaces current Day assignments and per-Day route versions for this active plan. " + "Temporary completion progress is discarded, but completed work is removed from the replacement plan instead of being resurrected. " + "Saved addresses, pins, manual gigs, workbook history, permanent corrections, and the pending workbook route are not deleted.\\n\\n" + "Google will NOT be called automatically."'
if s.count(old) != 1:
    raise SystemExit(f"route-plan-controls.js replacement warning anchor count={s.count(old)}")
p.write_text(s.replace(old, new, 1))

replace_once(
    "app.js",
    '''    readRouteHistory,
    remapRouteStopIds,
''',
    '''    completeActivePlanStop,
    readRouteHistory,
    remapRouteStopIds,
''',
)
replace_once(
    "app.js",
    '''    routeIds = nextRouteIds;
    persistActiveRoute(
        nextRouteIds.length === 0 ? "not_optimized" : null,
    );
    renderRouteList();
    renderJobsList();
''',
    '''    routeHistory = completeActivePlanStop(
        routeHistory,
        currentStopId,
        savedJobIds(),
    );
    routeHistory = writeRouteHistory(
        localStorage,
        routeHistory,
        savedJobIds(),
    );
    routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
    renderRouteList();
    renderJobsList();
''',
)
replace_once(
    "app.js",
    '''`Start the new ${pendingCount}-job route? This replaces both the saved Google Route and Basic Route. Saved addresses and pins will be kept.`''',
    '''`Start the new ${pendingCount}-job route? This replaces the active Route Plan, both saved route versions, and any temporary completion progress for that plan. Saved addresses, pins, manual gigs, and the pending route jobs being started will be kept.`''',
)

append_once(
    "CONTRACT.md",
    "## 11. Phase 2I-D active-plan completion protection",
    '''## 11. Phase 2I-D active-plan completion protection

1. `Done & Navigate Next` completes one physical stop in the active Route Plan Day and records every exact workbook Order ID / manual `Gig_ID` represented at that stop. Route-only stops retain only `stopId` plus completion timestamp; no invented work identity is created.
2. Completion records are temporary active-plan facts only: `{kind, workItemId, stopId, completedAt}` for exact work and `{stopId, completedAt}` for standalone route-only stops. They do not copy address, coordinates, pay, notes, route geometry, workbook history, or permanent gig history.
3. Completing a stop removes that physical stop from both Google and Basic candidates for the active Day and clears stale Google schedule confidence. The exact work pool remains available only as identity needed to prevent resurrection while the active plan exists.
4. Completed exact work and completed standalone stops are excluded from Day-count suggestions, automatic reassignment, manual Day-assignment lists, and ordinary Route Plan candidate regeneration. Ordinary writes or slot switching must not resurrect them.
5. Completion writes increment the active Day and Route Plan revision and use the existing route-history v7 stale-write gate. A stale completion or conflicting write fails closed before navigation state is changed.
6. Stop-ID remap carries temporary completion identity to the retained physical stop. Removing an exact work item from the active plan removes its corresponding temporary completion record.
7. Route Plan schema version 1 gains only backward-compatible optional completion arrays; route-history remains version 7 and whole-app backup remains version 5. Older valid Route Plans/backups with no completion arrays normalize with no invented completion state. Backup v5 preserves valid completion arrays.
8. Deliberate active-plan replacement requires the existing explicit confirmation. Cancel leaves plan/completion state unchanged. Replace discards temporary completion progress and carries forward only work that was still remaining, so completed jobs are not silently resurrected by replacement.
9. Starting a newer pending workbook route explicitly replaces the active Route Plan and its temporary completion progress after confirmation. It does not delete saved addresses, pins, manual gigs, permanent corrections, workbook history, or prediction history.
10. No workbook/router handoff schema, Drive filename/permission, Google optimization request, top-level page count, alternate mobile route state, polling loop, observer, or permanent detailed completed-route archive is added by Phase 2I-D.''',
)
append_once(
    "REGRESSION_CHECKLIST.md",
    "## Active-plan completion checks — Phase 2I-D",
    '''## Active-plan completion checks — Phase 2I-D

Required after active-plan completion, remaining-work filtering, or plan replacement changes.

- [ ] `Done & Navigate Next` records every exact Order ID / `Gig_ID` represented at the first physical stop with one completion timestamp and removes that stop from both Google and Basic candidates for the active Day.
- [ ] A route-only stop records only standalone stop identity; no fake workbook/manual work ID is invented.
- [ ] Completing a stop clears stale Google schedule confidence and increments both Day and Route Plan revision before the canonical v7 write.
- [ ] Completed work disappears from remaining-work planning, automatic Day assignment, manual assignment controls, and ordinary candidate regeneration; switching Google/Basic or reassigning Days does not resurrect it.
- [ ] A stale Route Plan completion write fails closed and does not partially change route or completion state.
- [ ] Stop-ID remap preserves exact completion identity at the retained physical stop; removing a completed manual gig removes its temporary completion record too.
- [ ] Backup v5 round-trips valid optional completion state; older Route Plans and backups with no completion state remain valid without invented completions.
- [ ] Active-plan replacement remains explicit: Cancel changes nothing; Replace discards temporary completion progress and carries forward only remaining work. Saved addresses, pins, gigs, corrections, workbook history, prediction history, and pending workbook state are not deleted.
- [ ] Starting a newer pending workbook route explicitly warns that old temporary completion progress is discarded and creates the new plan without inheriting old completion state.
- [ ] Phase 2I-D adds no workbook handoff schema, Drive permission/file, Google request contract, sixth page, alternate phone route state, observer/polling loop, or permanent detailed route-history attic.''',
)
