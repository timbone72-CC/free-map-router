(function attachFreeMapRouterBackup(root, factory) {
    const routeHistory =
        typeof module === "object" && module.exports
            ? require("./route-history.js")
            : root?.FMRRouteHistory;
    const backup = factory(routeHistory);

    if (typeof module === "object" && module.exports) {
        module.exports = backup;
    }

    if (root) {
        root.FMRBackup = backup;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBackup(routeHistory) {
    "use strict";

    const BACKUP_VERSION = 1;

    if (!routeHistory) {
        throw new Error("Free Map Router route history failed to load.");
    }

    const { normalizeRouteHistory } = routeHistory;

    function createBackup({ home, stops, routeIds, routes }) {
        const validIds = new Set(
            (Array.isArray(stops) ? stops : [])
                .map((stop) => stop?.id)
                .filter((id) => typeof id === "string" && id.trim()),
        );
        const normalizedRoutes = normalizeRouteHistory(
            routes || {
                current: { routeIds },
                previous: null,
            },
            validIds,
        );
        return {
            app: "free-map-router",
            backupVersion: BACKUP_VERSION,
            createdAt: new Date().toISOString(),
            home: home || null,
            stops: Array.isArray(stops) ? stops : [],
            routeIds: normalizedRoutes.google?.routeIds.length
                ? normalizedRoutes.google.routeIds
                : normalizedRoutes.basic?.routeIds || [],
            routes: normalizedRoutes,
        };
    }

    function parseBackup(text) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error("That file is not a valid Free Map Router backup.");
        }

        if (
            parsed?.app !== "free-map-router" ||
            parsed?.backupVersion !== BACKUP_VERSION ||
            !Array.isArray(parsed?.stops) ||
            !Array.isArray(parsed?.routeIds)
        ) {
            throw new Error("That file is not a valid Free Map Router backup.");
        }

        const validIds = new Set(
            parsed.stops
                .map((stop) => stop?.id)
                .filter((id) => typeof id === "string" && id.trim()),
        );
        const routes = normalizeRouteHistory(
            parsed.routes || {
                current: { routeIds: parsed.routeIds },
                previous: null,
            },
            validIds,
        );

        return {
            home: parsed.home || null,
            stops: parsed.stops,
            routeIds: routes.google?.routeIds.length
                ? routes.google.routeIds
                : routes.basic?.routeIds || [],
            routes,
        };
    }

    function backupFilename(date = new Date()) {
        return `free-map-router-backup-${date.toISOString().slice(0, 10)}.json`;
    }

    return {
        BACKUP_VERSION,
        backupFilename,
        createBackup,
        parseBackup,
    };
});
