(function attachRouteWorkPlanning(root, factory) {
    const workItemPlanning =
        typeof module === "object" && module.exports
            ? require("./work-item-planning.js")
            : root?.FMRWorkItemPlanning;
    const routeWorkPlanning = factory(workItemPlanning);

    if (typeof module === "object" && module.exports) {
        module.exports = routeWorkPlanning;
    }

    if (root) {
        root.FMRRouteWorkPlanning = routeWorkPlanning;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteWorkPlanning(workItemPlanning) {
    "use strict";

    if (!workItemPlanning) {
        throw new Error("Free Map Router work-item planning failed to load.");
    }

    const {
        normalizePlanningList,
        resolveWorkItemServiceMinutes,
        workItemKey,
    } = workItemPlanning;

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function uniqueIds(values) {
        const result = [];
        const seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const id = text(value);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            result.push(id);
        }
        return result;
    }

    function objectMap(value) {
        return value && typeof value === "object" ? value : {};
    }

    function routeWorkItemRefs(routeSnapshot) {
        const routeIds = uniqueIds(routeSnapshot?.routeIds);
        const orderIdsByStopId = objectMap(routeSnapshot?.orderIdsByStopId);
        const gigIdsByStopId = objectMap(routeSnapshot?.gigIdsByStopId);
        const refs = [];
        const identityStops = new Map();

        for (const stopId of routeIds) {
            const stopRefs = [
                ...uniqueIds(orderIdsByStopId[stopId]).map((workItemId) => ({
                    stopId,
                    kind: "workbook",
                    workItemId,
                })),
                ...uniqueIds(gigIdsByStopId[stopId]).map((workItemId) => ({
                    stopId,
                    kind: "gig",
                    workItemId,
                })),
            ];

            for (const ref of stopRefs) {
                const key = workItemKey(ref.kind, ref.workItemId);
                const previousStopId = identityStops.get(key);
                if (previousStopId && previousStopId !== stopId) {
                    throw new Error(
                        `Work item ${key} is attached to more than one route stop.`,
                    );
                }
                identityStops.set(key, stopId);
                refs.push(ref);
            }
        }

        return refs;
    }

    function projectedWorkItem(ref, planningByKey, options) {
        const key = workItemKey(ref.kind, ref.workItemId);
        const planningRecord = planningByKey.get(key) || null;
        const serviceMinutes = resolveWorkItemServiceMinutes(
            ref.kind,
            ref.workItemId,
            planningRecord ? [planningRecord] : [],
            options,
        );

        return {
            kind: ref.kind,
            workItemId: ref.workItemId,
            serviceMinutes,
            serviceMinutesOverride: planningRecord?.serviceMinutes ?? null,
            assignedDate: planningRecord?.assignedDate ?? null,
            lockedDay: planningRecord?.lockedDay === true,
            planningRevision: planningRecord?.revision ?? null,
            planningUpdatedAt: planningRecord?.updatedAt ?? null,
        };
    }

    function buildRoutePlanningProjection(routeSnapshot, planningRecords, options = {}) {
        const routeIds = uniqueIds(routeSnapshot?.routeIds);
        const normalizedPlanning = normalizePlanningList(planningRecords);
        const planningByKey = new Map(
            normalizedPlanning.map((record) => [
                workItemKey(record.kind, record.workItemId),
                record,
            ]),
        );
        const refs = routeWorkItemRefs(routeSnapshot);
        const refsByStopId = new Map(routeIds.map((stopId) => [stopId, []]));

        for (const ref of refs) {
            refsByStopId.get(ref.stopId)?.push(ref);
        }

        let routeWorkItemCount = 0;
        let routeKnownServiceMinutes = 0;
        let routeComplete = true;

        const stops = routeIds.map((stopId) => {
            const items = (refsByStopId.get(stopId) || []).map((ref) =>
                projectedWorkItem(ref, planningByKey, options),
            );
            let knownServiceMinutes = 0;
            let complete = true;

            for (const item of items) {
                if (item.serviceMinutes === null) {
                    complete = false;
                } else {
                    knownServiceMinutes += item.serviceMinutes;
                }
            }

            routeWorkItemCount += items.length;
            routeKnownServiceMinutes += knownServiceMinutes;
            if (!complete) routeComplete = false;

            return {
                stopId,
                workItemCount: items.length,
                serviceMinutes: complete ? knownServiceMinutes : null,
                knownServiceMinutes,
                complete,
                items,
            };
        });

        return {
            routeStopCount: routeIds.length,
            workItemCount: routeWorkItemCount,
            serviceMinutes: routeComplete ? routeKnownServiceMinutes : null,
            knownServiceMinutes: routeKnownServiceMinutes,
            complete: routeComplete,
            stops,
        };
    }

    return Object.freeze({
        routeWorkItemRefs,
        buildRoutePlanningProjection,
    });
});
