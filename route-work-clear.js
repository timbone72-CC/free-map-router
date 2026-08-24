(function attachFreeMapRouterRouteWorkClear(root, factory) {
    const routeHistory =
        typeof module === "object" && module.exports
            ? require("./route-history.js")
            : root?.FMRRouteHistory;
    const api = factory(routeHistory);

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.FMRRouteWorkClear = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteWorkClear(routeHistory) {
    "use strict";

    if (!routeHistory) {
        throw new Error("Free Map Router route history failed to load.");
    }

    const { normalizeRouteHistory, normalizeRouteSnapshot } = routeHistory;

    function stringIds(values) {
        const result = [];
        const seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const id = String(value ?? "").trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            result.push(id);
        }
        return result;
    }

    function countIdsByStopId(value) {
        const source = value && typeof value === "object" ? value : {};
        return Object.values(source).reduce(
            (total, ids) => total + stringIds(ids).length,
            0,
        );
    }

    function nextOptimizationStatus(snapshot, routeChanged, routeIds) {
        if (!routeChanged) return snapshot.optimizationStatus;
        if (routeIds.length === 0) return "not_optimized";
        return snapshot.optimizationStatus === "not_optimized"
            ? "not_optimized"
            : "manually_changed";
    }

    function clearInspectorAdeSnapshot(snapshot, validIds = null) {
        if (!snapshot) {
            return {
                snapshot: null,
                removedOrderIdCount: 0,
                removedStopCount: 0,
            };
        }

        const workbookStopIds = new Set(
            snapshot.routeIds.filter(
                (stopId) => stringIds(snapshot.orderIdsByStopId?.[stopId]).length > 0,
            ),
        );
        const routeIds = snapshot.routeIds.filter((stopId) => {
            if (!workbookStopIds.has(stopId)) return true;
            return stringIds(snapshot.gigIdsByStopId?.[stopId]).length > 0;
        });
        const routeChanged = routeIds.length !== snapshot.routeIds.length;
        const removedOrderIdCount = countIdsByStopId(snapshot.orderIdsByStopId);

        const nextSnapshot = normalizeRouteSnapshot(
            {
                ...snapshot,
                routeIds,
                optimizationStatus: nextOptimizationStatus(
                    snapshot,
                    routeChanged,
                    routeIds,
                ),
                orderIdsByStopId: {},
                workbookPayByStopId: {},
                gigIdsByStopId: snapshot.gigIdsByStopId,
                gigManagedStopIds: snapshot.gigManagedStopIds,
            },
            validIds,
        );

        return {
            snapshot: nextSnapshot,
            removedOrderIdCount,
            removedStopCount: snapshot.routeIds.length - routeIds.length,
        };
    }

    function clearManualGigSnapshot(snapshot, validIds = null) {
        if (!snapshot) {
            return {
                snapshot: null,
                removedGigIdCount: 0,
                removedStopCount: 0,
            };
        }

        const gigManaged = new Set(snapshot.gigManagedStopIds || []);
        const routeIds = snapshot.routeIds.filter((stopId) => {
            const hasGigIds =
                stringIds(snapshot.gigIdsByStopId?.[stopId]).length > 0;
            const hasWorkbookIds =
                stringIds(snapshot.orderIdsByStopId?.[stopId]).length > 0;
            const removableGigOnlyStop =
                hasGigIds && gigManaged.has(stopId) && !hasWorkbookIds;
            return !removableGigOnlyStop;
        });
        const routeChanged = routeIds.length !== snapshot.routeIds.length;
        const removedGigIdCount = countIdsByStopId(snapshot.gigIdsByStopId);

        const nextSnapshot = normalizeRouteSnapshot(
            {
                ...snapshot,
                routeIds,
                optimizationStatus: nextOptimizationStatus(
                    snapshot,
                    routeChanged,
                    routeIds,
                ),
                gigIdsByStopId: {},
                gigManagedStopIds: [],
            },
            validIds,
        );

        return {
            snapshot: nextSnapshot,
            removedGigIdCount,
            removedStopCount: snapshot.routeIds.length - routeIds.length,
        };
    }

    function clearInspectorAdeRouteWork(history, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        const google = clearInspectorAdeSnapshot(normalized.google, validIds);
        const basic = clearInspectorAdeSnapshot(normalized.basic, validIds);

        return {
            history: normalizeRouteHistory(
                {
                    version: normalized.version,
                    google: google.snapshot,
                    basic: basic.snapshot,
                    pending: normalized.pending,
                },
                validIds,
            ),
            removedOrderIdCount:
                google.removedOrderIdCount + basic.removedOrderIdCount,
            removedStopCount:
                google.removedStopCount + basic.removedStopCount,
        };
    }

    function clearManualGigRouteWork(history, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        const google = clearManualGigSnapshot(normalized.google, validIds);
        const basic = clearManualGigSnapshot(normalized.basic, validIds);

        return {
            history: normalizeRouteHistory(
                {
                    version: normalized.version,
                    google: google.snapshot,
                    basic: basic.snapshot,
                    pending: normalized.pending,
                },
                validIds,
            ),
            removedGigIdCount:
                google.removedGigIdCount + basic.removedGigIdCount,
            removedStopCount:
                google.removedStopCount + basic.removedStopCount,
        };
    }

    return Object.freeze({
        clearInspectorAdeRouteWork,
        clearManualGigRouteWork,
    });
});
