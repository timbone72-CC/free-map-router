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
    "route-plan.js",
    "    function normalizeRoutePlanDay(value) {\n",
    '''    function normalizeCompletedWorkItem(value) {
        const ref = normalizeWorkItemRef(value);
        return {
            ...ref,
            completedAt: normalizedTimestamp(
                value?.completedAt,
                "Completed work timestamp",
            ),
        };
    }

    function normalizeCompletedStandaloneStop(value) {
        if (!value || typeof value !== "object") {
            throw new Error("Completed standalone stop is required.");
        }
        return {
            stopId: normalizedId(value.stopId, "Completed standalone stop ID"),
            completedAt: normalizedTimestamp(
                value.completedAt,
                "Completed standalone stop timestamp",
            ),
        };
    }

    function normalizeRoutePlanDay(value) {
''',
)
replace_once(
    "route-plan.js",
    '''        const day = {
            dayId: normalizedId(value.dayId, "Day ID"),
            revision: normalizedRevision(value.revision, "Day revision"),
            updatedAt: normalizedTimestamp(value.updatedAt, "Day updatedAt"),
            dayContext: copiedDayContext(value.dayContext),
            google: normalizeRouteSnapshot(value.google, { allowSchedule: true }),
            basic: normalizeRouteSnapshot(value.basic, { allowSchedule: false }),
        };
        unionDayWorkItems(day);
        return day;
''',
    '''        const completedWorkItems = (Array.isArray(value.completedWorkItems)
            ? value.completedWorkItems
            : []
        ).map(normalizeCompletedWorkItem);
        const completedStandaloneStops = (
            Array.isArray(value.completedStandaloneStops)
                ? value.completedStandaloneStops
                : []
        ).map(normalizeCompletedStandaloneStop);
        const day = {
            dayId: normalizedId(value.dayId, "Day ID"),
            revision: normalizedRevision(value.revision, "Day revision"),
            updatedAt: normalizedTimestamp(value.updatedAt, "Day updatedAt"),
            dayContext: copiedDayContext(value.dayContext),
            google: normalizeRouteSnapshot(value.google, { allowSchedule: true }),
            basic: normalizeRouteSnapshot(value.basic, { allowSchedule: false }),
        };
        if (completedWorkItems.length) day.completedWorkItems = completedWorkItems;
        if (completedStandaloneStops.length) {
            day.completedStandaloneStops = completedStandaloneStops;
        }
        unionDayWorkItems(day);
        return day;
''',
)
replace_once(
    "route-plan.js",
    '''        if (days.length === 0) throw new Error("An active Route Plan requires at least one Day.");
''',
    '''        const completedWorkDayByKey = new Map();
        const completedStandaloneDayByStopId = new Map();
        for (const day of days) {
            for (const completed of day.completedWorkItems || []) {
                const key = workItemKey(completed.kind, completed.workItemId);
                const planItem = workByKey.get(key);
                if (!planItem || planItem.stopId !== completed.stopId) {
                    throw new Error(`Completed work item ${key} is outside the Route Plan pool.`);
                }
                if (routeDayByStopId.has(completed.stopId)) {
                    throw new Error(`Completed work item ${key} cannot remain on a Route Plan route.`);
                }
                if (completedWorkDayByKey.has(key)) {
                    throw new Error(`Completed work item ${key} is duplicated.`);
                }
                completedWorkDayByKey.set(key, day.dayId);
            }
            for (const completed of day.completedStandaloneStops || []) {
                if (!standaloneById.has(completed.stopId)) {
                    throw new Error(
                        `Completed standalone stop ${completed.stopId} is outside the Route Plan pool.`,
                    );
                }
                if (routeDayByStopId.has(completed.stopId)) {
                    throw new Error(
                        `Completed standalone stop ${completed.stopId} cannot remain on a Route Plan route.`,
                    );
                }
                if (completedStandaloneDayByStopId.has(completed.stopId)) {
                    throw new Error(
                        `Completed standalone stop ${completed.stopId} is duplicated.`,
                    );
                }
                completedStandaloneDayByStopId.set(completed.stopId, day.dayId);
            }
        }

        if (days.length === 0) throw new Error("An active Route Plan requires at least one Day.");
''',
)
replace_once(
    "route-plan.js",
    '''    function planningByKey(records) {
''',
    '''    function completedWorkItemKeys(planValue) {
        const plan = normalizeRoutePlan(planValue);
        return new Set(
            plan.days.flatMap((day) =>
                (day.completedWorkItems || []).map((item) =>
                    workItemKey(item.kind, item.workItemId),
                ),
            ),
        );
    }

    function completedStandaloneStopIds(planValue) {
        const plan = normalizeRoutePlan(planValue);
        return new Set(
            plan.days.flatMap((day) =>
                (day.completedStandaloneStops || []).map((item) => item.stopId),
            ),
        );
    }

    function remainingPlanWorkItems(planValue) {
        const plan = normalizeRoutePlan(planValue);
        const completed = completedWorkItemKeys(plan);
        return plan.workItems
            .filter((item) => !completed.has(workItemKey(item.kind, item.workItemId)))
            .map((item) => ({ ...item }));
    }

    function remainingStandaloneStops(planValue) {
        const plan = normalizeRoutePlan(planValue);
        const completed = completedStandaloneStopIds(plan);
        return plan.standaloneStops
            .filter((stop) => !completed.has(stop.stopId))
            .map((stop) => ({ ...stop }));
    }

    function routeSnapshotWithoutStop(snapshot, stopId, allowSchedule) {
        if (!snapshot) return null;
        const routeIds = snapshot.routeIds.filter((id) => id !== stopId);
        const copyMapWithoutStop = (source) =>
            Object.fromEntries(
                Object.entries(source || {}).filter(([id]) => id !== stopId),
            );
        return normalizeRouteSnapshot(
            {
                ...snapshot,
                routeIds,
                optimizationStatus:
                    routeIds.length > 0
                        ? snapshot.optimizationStatus
                        : "not_optimized",
                orderIdsByStopId: copyMapWithoutStop(snapshot.orderIdsByStopId),
                workbookPayByStopId: copyMapWithoutStop(snapshot.workbookPayByStopId),
                gigIdsByStopId: copyMapWithoutStop(snapshot.gigIdsByStopId),
                gigManagedStopIds: (snapshot.gigManagedStopIds || []).filter(
                    (id) => id !== stopId,
                ),
                schedule: null,
            },
            { allowSchedule },
        );
    }

    function completeActiveDayStop(planValue, stopIdValue, options = {}) {
        const plan = normalizeRoutePlan(planValue);
        const stopId = normalizedId(stopIdValue, "Completed stop ID");
        const completedAt = normalizedTimestamp(
            options.completedAt,
            "Completed stop timestamp",
        );
        const day = plan.days.find((item) => item.dayId === plan.activeDayId);
        const routeIds = new Set([
            ...(day.google?.routeIds || []),
            ...(day.basic?.routeIds || []),
        ]);
        if (!routeIds.has(stopId)) {
            throw new Error("The completed stop is no longer in the active Route Plan Day.");
        }
        const representedWork = unionDayWorkItems(day).filter(
            (item) => item.stopId === stopId,
        );
        const standalone = plan.standaloneStops.find(
            (item) => item.stopId === stopId,
        );
        if (!representedWork.length && !standalone) {
            throw new Error("The completed stop has no active Route Plan identity.");
        }
        const completedWorkItems = [...(day.completedWorkItems || [])];
        const existingKeys = new Set(
            completedWorkItems.map((item) =>
                workItemKey(item.kind, item.workItemId),
            ),
        );
        for (const item of representedWork) {
            const key = workItemKey(item.kind, item.workItemId);
            if (!existingKeys.has(key)) {
                existingKeys.add(key);
                completedWorkItems.push({ ...item, completedAt });
            }
        }
        const completedStandaloneStops = [
            ...(day.completedStandaloneStops || []),
        ];
        if (
            standalone &&
            !completedStandaloneStops.some((item) => item.stopId === stopId)
        ) {
            completedStandaloneStops.push({ stopId, completedAt });
        }
        const nextDay = {
            ...day,
            revision: day.revision + 1,
            updatedAt: completedAt,
            google: routeSnapshotWithoutStop(day.google, stopId, true),
            basic: routeSnapshotWithoutStop(day.basic, stopId, false),
        };
        if (completedWorkItems.length) nextDay.completedWorkItems = completedWorkItems;
        else delete nextDay.completedWorkItems;
        if (completedStandaloneStops.length) {
            nextDay.completedStandaloneStops = completedStandaloneStops;
        } else {
            delete nextDay.completedStandaloneStops;
        }
        return normalizeRoutePlan({
            ...plan,
            revision: plan.revision + 1,
            updatedAt: completedAt,
            days: plan.days.map((item) =>
                item.dayId === day.dayId ? nextDay : item,
            ),
        });
    }

    function planningByKey(records) {
''',
)
replace_once(
    "route-plan.js",
    '''        return plan.workItems
            .filter((item) => text(byKey.get(workItemKey(item.kind, item.workItemId))?.assignedDate) === date)
            .map((item) => ({ ...item }));
''',
    '''        const completed = completedWorkItemKeys(plan);
        return plan.workItems
            .filter(
                (item) =>
                    !completed.has(workItemKey(item.kind, item.workItemId)) &&
                    text(byKey.get(workItemKey(item.kind, item.workItemId))?.assignedDate) === date,
            )
            .map((item) => ({ ...item }));
''',
)
replace_once(
    "route-plan.js",
    '''        return plan.workItems
            .filter((item) => !text(byKey.get(workItemKey(item.kind, item.workItemId))?.assignedDate))
            .map((item) => ({ ...item }));
''',
    '''        const completed = completedWorkItemKeys(plan);
        return plan.workItems
            .filter(
                (item) =>
                    !completed.has(workItemKey(item.kind, item.workItemId)) &&
                    !text(byKey.get(workItemKey(item.kind, item.workItemId))?.assignedDate),
            )
            .map((item) => ({ ...item }));
''',
)
replace_once(
    "route-plan.js",
    '''        return plan.standaloneStops
            .filter((stop) => stop.assignedDate === date)
            .map((stop) => ({ ...stop }));
''',
    '''        const completed = completedStandaloneStopIds(plan);
        return plan.standaloneStops
            .filter(
                (stop) =>
                    stop.assignedDate === date && !completed.has(stop.stopId),
            )
            .map((stop) => ({ ...stop }));
''',
)
replace_once(
    "route-plan.js",
    '''        ROUTE_PLAN_SCHEMA_VERSION,
        migrateOneDayRouteHistory,
''',
    '''        ROUTE_PLAN_SCHEMA_VERSION,
        completeActiveDayStop,
        completedStandaloneStopIds,
        completedWorkItemKeys,
        migrateOneDayRouteHistory,
''',
)
replace_once(
    "route-plan.js",
    '''        normalizeWorkItemRef,
        planWorkItemsForDate,
        standaloneStopsForDate,
''',
    '''        normalizeWorkItemRef,
        planWorkItemsForDate,
        remainingPlanWorkItems,
        remainingStandaloneStops,
        standaloneStopsForDate,
''',
)
