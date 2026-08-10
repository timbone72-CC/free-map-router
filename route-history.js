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
    const ROUTE_HISTORY_VERSION = 1;

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
        };
    }

    function normalizeRouteHistory(value, validIds = null) {
        return {
            version: ROUTE_HISTORY_VERSION,
            current: normalizeRouteSnapshot(value?.current, validIds),
            previous: normalizeRouteSnapshot(value?.previous, validIds),
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

    function replaceRoute(history, slot, routeIds, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        const key = slot === "previous" ? "previous" : "current";
        const existing = normalized[key];
        normalized[key] = normalizeRouteSnapshot(
            {
                routeIds,
                sourceUpdatedAt: existing?.sourceUpdatedAt || null,
            },
            validIds,
        );
        return normalized;
    }

    function applyWorkbookRoute(history, routeIds, sourceUpdatedAt, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        const incomingTimestamp = normalizedTimestamp(sourceUpdatedAt);
        if (!incomingTimestamp) {
            throw new Error("The workbook route is missing a valid export time.");
        }

        const currentTimestamp = normalized.current?.sourceUpdatedAt || null;
        if (currentTimestamp && incomingTimestamp < currentTimestamp) {
            return { history: normalized, result: "older" };
        }
        if (currentTimestamp && incomingTimestamp === currentTimestamp) {
            return { history: normalized, result: "same" };
        }

        return {
            history: {
                version: ROUTE_HISTORY_VERSION,
                current: normalizeRouteSnapshot(
                    { routeIds, sourceUpdatedAt: incomingTimestamp },
                    validIds,
                ),
                previous: normalized.current,
            },
            result: "newer",
        };
    }

    return {
        ROUTE_HISTORY_VERSION,
        STORAGE_KEY,
        applyWorkbookRoute,
        normalizeRouteHistory,
        normalizeRouteSnapshot,
        readRouteHistory,
        replaceRoute,
        writeRouteHistory,
    };
});
