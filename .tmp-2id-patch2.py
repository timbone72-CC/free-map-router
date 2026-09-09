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

replace_once(
    "route-history.js",
    '''            migrateOneDayRouteHistory,
            normalizeRoutePlan,
            workItemKey,
''',
    '''            completeActiveDayStop,
            completedStandaloneStopIds,
            completedWorkItemKeys,
            migrateOneDayRouteHistory,
            normalizeRoutePlan,
            workItemKey,
''',
)
replace_once(
    "route-history.js",
    '''            const days = normalized.days.map((day) => ({
                ...day,
                dayContext: normalizeDayContext(day.dayContext),
                google: normalizeRouteSnapshot(
                    day.google,
                    validIds,
                    true,
                ),
                basic: normalizeRouteSnapshot(
                    day.basic,
                    validIds,
                    false,
                ),
            }));
''',
    '''            const retainedWorkKeys = new Set(
                workItems.map((item) => workItemKey(item.kind, item.workItemId)),
            );
            const retainedStandaloneIds = new Set(
                standaloneStops.map((stop) => stop.stopId),
            );
            const days = normalized.days.map((day) => {
                const nextDay = {
                    ...day,
                    dayContext: normalizeDayContext(day.dayContext),
                    google: normalizeRouteSnapshot(day.google, validIds, true),
                    basic: normalizeRouteSnapshot(day.basic, validIds, false),
                };
                const completedWorkItems = (day.completedWorkItems || []).filter(
                    (item) =>
                        retainedWorkKeys.has(workItemKey(item.kind, item.workItemId)) &&
                        (!validIds || validIds.has(item.stopId)),
                );
                const completedStandaloneStops = (
                    day.completedStandaloneStops || []
                ).filter(
                    (item) =>
                        retainedStandaloneIds.has(item.stopId) &&
                        (!validIds || validIds.has(item.stopId)),
                );
                if (completedWorkItems.length) nextDay.completedWorkItems = completedWorkItems;
                else delete nextDay.completedWorkItems;
                if (completedStandaloneStops.length) {
                    nextDay.completedStandaloneStops = completedStandaloneStops;
                } else {
                    delete nextDay.completedStandaloneStops;
                }
                return nextDay;
            });
''',
)
replace_once(
    "route-history.js",
    '''            const workItems = next.activePlan.workItems.filter((item) => {
                const key = workItemKey(item.kind, item.workItemId);
                return incomingKeys.has(key) || otherDayIds.has(key);
            });
''',
    '''            const completedKeys = completedWorkItemKeys(next.activePlan);
            const workItems = next.activePlan.workItems.filter((item) => {
                const key = workItemKey(item.kind, item.workItemId);
                return (
                    incomingKeys.has(key) ||
                    otherDayIds.has(key) ||
                    completedKeys.has(key)
                );
            });
''',
)
replace_once(
    "route-history.js",
    '''            for (const stopId of requiredStandaloneStopIds) {
''',
    '''            for (const stopId of completedStandaloneStopIds(next.activePlan)) {
                requiredStandaloneStopIds.add(stopId);
            }
            for (const stopId of requiredStandaloneStopIds) {
''',
)
replace_once(
    "route-history.js",
    '''                const days = plan.days.map((day) => ({
                    ...day,
                    revision: day.revision + 1,
                    updatedAt: now,
                    google: remapSnapshot(
                        day.google,
                        replacements,
                        validIds,
                        true,
                    ),
                    basic: remapSnapshot(
                        day.basic,
                        replacements,
                        validIds,
                        false,
                    ),
                }));
''',
    '''                const remappedStopId = (oldId) => {
                    const replacement = replacements[oldId];
                    return typeof replacement === "string" && replacement.trim()
                        ? replacement.trim()
                        : oldId;
                };
                const days = plan.days.map((day) => {
                    const nextDay = {
                        ...day,
                        revision: day.revision + 1,
                        updatedAt: now,
                        google: remapSnapshot(day.google, replacements, validIds, true),
                        basic: remapSnapshot(day.basic, replacements, validIds, false),
                    };
                    const completedWorkItems = (day.completedWorkItems || [])
                        .map((item) => ({ ...item, stopId: remappedStopId(item.stopId) }))
                        .filter((item) => !validIds || validIds.has(item.stopId));
                    const completedStandaloneById = new Map();
                    for (const item of day.completedStandaloneStops || []) {
                        const stopId = remappedStopId(item.stopId);
                        if (validIds && !validIds.has(stopId)) continue;
                        if (!completedStandaloneById.has(stopId)) {
                            completedStandaloneById.set(stopId, { ...item, stopId });
                        }
                    }
                    if (completedWorkItems.length) nextDay.completedWorkItems = completedWorkItems;
                    else delete nextDay.completedWorkItems;
                    const completedStandaloneStops = Array.from(
                        completedStandaloneById.values(),
                    );
                    if (completedStandaloneStops.length) {
                        nextDay.completedStandaloneStops = completedStandaloneStops;
                    } else {
                        delete nextDay.completedStandaloneStops;
                    }
                    return nextDay;
                });
''',
)
replace_once(
    "route-history.js",
    '''            return normalizeRoutePlan({
                ...plan,
                workItems,
                standaloneStops,
            });
''',
    '''            const days = plan.days.map((day) => {
                const nextDay = { ...day };
                const completedWorkItems = (day.completedWorkItems || []).filter(
                    (item) => workItemKey(item.kind, item.workItemId) !== key,
                );
                if (completedWorkItems.length) nextDay.completedWorkItems = completedWorkItems;
                else delete nextDay.completedWorkItems;
                return nextDay;
            });
            return normalizeRoutePlan({
                ...plan,
                workItems,
                standaloneStops,
                days,
            });
''',
)
replace_once(
    "route-history.js",
    '''        function writeGoogleSchedule(
''',
    '''        function completeActivePlanStop(
            history,
            stopId,
            validIds = null,
            completedAt = null,
        ) {
            const normalized = normalizeRouteHistory(history, validIds);
            if (!normalized.activePlan) {
                throw new Error("There is no active Route Plan to complete.");
            }
            const nextPlan = completeActiveDayStop(
                normalized.activePlan,
                stopId,
                { completedAt: completedAt || nextTimestamp() },
            );
            return attachCompatibility({
                activePlan: sanitizedRoutePlan(nextPlan, validIds),
                pending: normalized.pending,
            });
        }

        function writeGoogleSchedule(
''',
)
replace_once(
    "route-history.js",
    '''            ROUTE_HISTORY_CHANGED_EVENT,
            ROUTE_HISTORY_VERSION,
''',
    '''            ROUTE_HISTORY_CHANGED_EVENT,
            ROUTE_HISTORY_VERSION,
            completeActivePlanStop,
''',
)
