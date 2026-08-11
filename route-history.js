(function attachFreeMapRouterRouteHistory(root, factory) {
    const routeHistory = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = routeHistory;
    }

    if (root) {
        root.FMRRouteHistory = routeHistory;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteHistory() {
    "use strict";

    const STORAGE_KEY = "fmr_route_history_v1";
    const ROUTE_HISTORY_VERSION = 2;
    const OPTIMIZATION_STATUSES = new Set([
        "not_optimized",
        "basic_optimized",
        "google_optimized",
        "manually_changed",
    ]);

    function normalizedOptimizationStatus(value) {
        return OPTIMIZATION_STATUSES.has(value) ? value : "not_optimized";
    }

    function normalizedTimestamp(value) {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    function normalizedRouteIds(values, validIds = null) {
        const result = [];
        const seen = new Set();

        for (const rawId of Array.isArray(values) ? values : []) {
            if (typeof rawId !== "string") continue;
            const id = rawId.trim();
            if (!id || seen.has(id) || (validIds && !validIds.has(id))) continue;
            seen.add(id);
            result.push(id);
        }

        return result;
    }

    function normalizeRouteSnapshot(value, validIds = null) {
        if (!value || typeof value !== "object") return null;
        const routeIds = normalizedRouteIds(value.routeIds, validIds);
        const sourceUpdatedAt = normalizedTimestamp(value.sourceUpdatedAt);
        if (routeIds.length === 0 && !sourceUpdatedAt) return null;

        return {
            routeIds,
            sourceUpdatedAt,
            optimizationStatus:
                routeIds.length === 0
                    ? "not_optimized"
                    : normalizedOptimizationStatus(value.optimizationStatus),
        };
    }

    function copiedSnapshot(snapshot, optimizationStatus = null) {
        if (!snapshot) return null;
        return {
            routeIds: snapshot.routeIds.slice(),
            sourceUpdatedAt: snapshot.sourceUpdatedAt,
            optimizationStatus:
                optimizationStatus || snapshot.optimizationStatus,
        };
    }

    function migrateLegacyHistory(value, validIds = null) {
        const current = normalizeRouteSnapshot(value?.current, validIds);
        const previous = normalizeRouteSnapshot(value?.previous, validIds);
        let google = null;
        let basic = null;

        if (current?.optimizationStatus === "basic_optimized") {
            basic = copiedSnapshot(current);
        } else {
            google = copiedSnapshot(current);
        }

        if (previous?.optimizationStatus === "google_optimized" && !google) {
            google = copiedSnapshot(previous);
        } else if (
            previous?.optimizationStatus === "basic_optimized" &&
            !basic
        ) {
            basic = copiedSnapshot(previous);
        } else if (previous && !basic) {
            basic = copiedSnapshot(previous);
        } else if (previous && !google) {
            google = copiedSnapshot(previous);
        }

        if (!google && current) {
            google = copiedSnapshot(current, "not_optimized");
        }
        if (!basic && current) {
            basic = copiedSnapshot(current, "not_optimized");
        }

        return {
            version: ROUTE_HISTORY_VERSION,
            google,
            basic,
            pending: null,
        };
    }

    function normalizeRouteHistory(value, validIds = null) {
        const usesNamedSlots =
            value?.version === ROUTE_HISTORY_VERSION ||
            Object.hasOwn(value || {}, "google") ||
            Object.hasOwn(value || {}, "basic") ||
            Object.hasOwn(value || {}, "pending");

        if (!usesNamedSlots) {
            return migrateLegacyHistory(value, validIds);
        }

        const pending = normalizeRouteSnapshot(value?.pending, validIds);
        return {
            version: ROUTE_HISTORY_VERSION,
            google: normalizeRouteSnapshot(value?.google, validIds),
            basic: normalizeRouteSnapshot(value?.basic, validIds),
            pending: pending?.routeIds.length ? pending : null,
        };
    }

    function readRouteHistory(storage, validIds = null) {
        try {
            const raw = storage?.getItem?.(STORAGE_KEY);
            return normalizeRouteHistory(raw ? JSON.parse(raw) : null, validIds);
        } catch {
            return normalizeRouteHistory(null, validIds);
        }
    }

    function writeRouteHistory(storage, history, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function normalizedSlot(slot) {
        return slot === "basic" ? "basic" : "google";
    }

    function replaceRoute(history, slot, routeIds, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        const key = normalizedSlot(slot);
        const existing = normalized[key];
        normalized[key] = normalizeRouteSnapshot(
            {
                routeIds,
                sourceUpdatedAt: existing?.sourceUpdatedAt || null,
                optimizationStatus:
                    existing?.optimizationStatus || "not_optimized",
            },
            validIds,
        );
        return normalized;
    }

    function setRouteOptimizationStatus(
        history,
        slot,
        optimizationStatus,
        validIds = null,
    ) {
        const normalized = normalizeRouteHistory(history, validIds);
        const key = normalizedSlot(slot);
        const existing = normalized[key];
        if (!existing) return normalized;

        normalized[key] = normalizeRouteSnapshot(
            {
                ...existing,
                optimizationStatus,
            },
            validIds,
        );
        return normalized;
    }

    function workbookRouteRelation(history, sourceUpdatedAt) {
        const normalized = normalizeRouteHistory(history);
        const incomingTimestamp = normalizedTimestamp(sourceUpdatedAt);
        if (!incomingTimestamp) {
            throw new Error("The workbook route is missing a valid export time.");
        }

        const timestamps = [
            normalized.google?.sourceUpdatedAt,
            normalized.basic?.sourceUpdatedAt,
            normalized.pending?.sourceUpdatedAt,
        ]
            .filter(Boolean)
            .sort();
        const latestTimestamp = timestamps[timestamps.length - 1];

        if (!latestTimestamp || incomingTimestamp > latestTimestamp) {
            return "newer";
        }
        if (incomingTimestamp < latestTimestamp) return "older";
        return normalized.pending?.sourceUpdatedAt === incomingTimestamp
            ? "pending"
            : "same";
    }

    function stageWorkbookRoute(
        history,
        routeIds,
        sourceUpdatedAt,
        validIds = null,
    ) {
        const normalized = normalizeRouteHistory(history, validIds);
        const result = workbookRouteRelation(normalized, sourceUpdatedAt);
        if (result !== "newer") return { history: normalized, result };

        normalized.pending = normalizeRouteSnapshot(
            {
                routeIds,
                sourceUpdatedAt,
                optimizationStatus: "not_optimized",
            },
            validIds,
        );
        return { history: normalized, result };
    }

    function startPendingRoute(history, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        if (!normalized.pending || normalized.pending.routeIds.length === 0) {
            return { history: normalized, result: "none" };
        }

        const freshRoute = copiedSnapshot(
            normalized.pending,
            "not_optimized",
        );
        return {
            history: {
                version: ROUTE_HISTORY_VERSION,
                google: copiedSnapshot(freshRoute),
                basic: copiedSnapshot(freshRoute),
                pending: null,
            },
            result: "started",
        };
    }

    return {
        ROUTE_HISTORY_VERSION,
        STORAGE_KEY,
        normalizeRouteHistory,
        normalizeRouteSnapshot,
        readRouteHistory,
        replaceRoute,
        setRouteOptimizationStatus,
        stageWorkbookRoute,
        startPendingRoute,
        workbookRouteRelation,
        writeRouteHistory,
    };
});
