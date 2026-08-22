(function attachFreeMapRouterBackup(root, factory) {
    const routeHistory =
        typeof module === "object" && module.exports
            ? require("./route-history.js")
            : root?.FMRRouteHistory;
    const gigContract =
        typeof module === "object" && module.exports
            ? require("./gig-contract.js")
            : root?.FMRGigContract;
    const backup = factory(routeHistory, gigContract);

    if (typeof module === "object" && module.exports) {
        module.exports = backup;
    }

    if (root) {
        root.FMRBackup = backup;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBackup(routeHistory, gigContract) {
    "use strict";

    const BACKUP_VERSION = 2;
    const LEGACY_BACKUP_VERSION = 1;

    if (!routeHistory) {
        throw new Error("Free Map Router route history failed to load.");
    }
    if (!gigContract) {
        throw new Error("Free Map Router gig contract failed to load.");
    }

    const { normalizeRouteHistory } = routeHistory;
    const { normalizeGigList } = gigContract;

    function validStopIds(stops) {
        return new Set(
            (Array.isArray(stops) ? stops : [])
                .map((stop) => stop?.id)
                .filter((id) => typeof id === "string" && id.trim()),
        );
    }

    function createBackup({ home, stops, gigs, routeIds, routes }) {
        const validIds = validStopIds(stops);
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
            gigs: normalizeGigList(gigs, { validStopIds: validIds }),
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

        const supportedVersion =
            parsed?.backupVersion === BACKUP_VERSION ||
            parsed?.backupVersion === LEGACY_BACKUP_VERSION;
        if (
            parsed?.app !== "free-map-router" ||
            !supportedVersion ||
            !Array.isArray(parsed?.stops) ||
            !Array.isArray(parsed?.routeIds)
        ) {
            throw new Error("That file is not a valid Free Map Router backup.");
        }

        const validIds = validStopIds(parsed.stops);
        const routes = normalizeRouteHistory(
            parsed.routes || {
                current: { routeIds: parsed.routeIds },
                previous: null,
            },
            validIds,
        );
        const gigs =
            parsed.backupVersion === LEGACY_BACKUP_VERSION
                ? []
                : normalizeGigList(parsed.gigs, { validStopIds: validIds });

        return {
            home: parsed.home || null,
            stops: parsed.stops,
            gigs,
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