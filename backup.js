(function attachFreeMapRouterBackup(root, factory) {
    const routeHistory =
        typeof module === "object" && module.exports
            ? require("./route-history.js")
            : root?.FMRRouteHistory;
    const gigContract =
        typeof module === "object" && module.exports
            ? require("./gig-contract.js")
            : root?.FMRGigContract;
    const workItemPlanning =
        typeof module === "object" && module.exports
            ? require("./work-item-planning.js")
            : root?.FMRWorkItemPlanning;
    const backup = factory(routeHistory, gigContract, workItemPlanning, root);

    if (typeof module === "object" && module.exports) {
        module.exports = backup;
    }

    if (root) {
        root.FMRBackup = backup;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBackup(routeHistory, gigContract, workItemPlanning, root) {
    "use strict";

    const BACKUP_VERSION = 4;
    const PLANNING_BACKUP_VERSION = 3;
    const GIG_BACKUP_VERSION = 2;
    const LEGACY_BACKUP_VERSION = 1;
    let parsedGigsForRestore = null;
    let parsedPlanningForRestore = null;

    if (!routeHistory) {
        throw new Error("Free Map Router route history failed to load.");
    }
    if (!gigContract) {
        throw new Error("Free Map Router gig contract failed to load.");
    }
    if (!workItemPlanning) {
        throw new Error("Free Map Router work-item planning failed to load.");
    }

    const {
        normalizeRouteHistory,
        readRouteHistory,
        replaceDayContext,
        validateDayContext,
    } = routeHistory;
    const { normalizeGigList, readGigs } = gigContract;
    const { normalizePlanningList, readPlanningRecords } = workItemPlanning;

    function validStopIds(stops) {
        return new Set(
            (Array.isArray(stops) ? stops : [])
                .map((stop) => stop?.id)
                .filter((id) => typeof id === "string" && id.trim()),
        );
    }

    function currentBrowserGigs(validIds) {
        if (!root?.localStorage) return [];
        return readGigs(root.localStorage, validIds);
    }

    function currentBrowserPlanning() {
        if (!root?.localStorage) return [];
        return readPlanningRecords(root.localStorage);
    }

    function currentBrowserRoutes(validIds) {
        if (!root?.localStorage) return null;
        return readRouteHistory(root.localStorage, validIds);
    }

    function createBackup({ home, stops, gigs, planning, routeIds, routes }) {
        const validIds = validStopIds(stops);
        let normalizedRoutes = normalizeRouteHistory(
            routes || {
                current: { routeIds },
                previous: null,
            },
            validIds,
        );
        const persistedRoutes = currentBrowserRoutes(validIds);
        if (persistedRoutes?.dayContext) {
            normalizedRoutes = normalizeRouteHistory(
                {
                    ...normalizedRoutes,
                    dayContext: persistedRoutes.dayContext,
                },
                validIds,
            );
        }
        const backupGigs =
            gigs === undefined ? currentBrowserGigs(validIds) : gigs;
        const backupPlanning =
            planning === undefined ? currentBrowserPlanning() : planning;
        return {
            app: "free-map-router",
            backupVersion: BACKUP_VERSION,
            createdAt: new Date().toISOString(),
            home: home || null,
            stops: Array.isArray(stops) ? stops : [],
            gigs: normalizeGigList(backupGigs, { validStopIds: validIds }),
            planning: normalizePlanningList(backupPlanning),
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
            parsed?.backupVersion === PLANNING_BACKUP_VERSION ||
            parsed?.backupVersion === GIG_BACKUP_VERSION ||
            parsed?.backupVersion === LEGACY_BACKUP_VERSION;
        if (
            parsed?.app !== "free-map-router" ||
            !supportedVersion ||
            !Array.isArray(parsed?.stops) ||
            !Array.isArray(parsed?.routeIds)
        ) {
            throw new Error("That file is not a valid Free Map Router backup.");
        }

        if (
            parsed.backupVersion === BACKUP_VERSION &&
            parsed.routes?.dayContext !== null &&
            parsed.routes?.dayContext !== undefined
        ) {
            const timingValidation = validateDayContext(parsed.routes.dayContext);
            if (!timingValidation.ok) {
                throw new Error(
                    `That Free Map Router backup has invalid route timing: ${timingValidation.error}`,
                );
            }
        }

        const validIds = validStopIds(parsed.stops);
        let routes = normalizeRouteHistory(
            parsed.routes || {
                current: { routeIds: parsed.routeIds },
                previous: null,
            },
            validIds,
        );
        routes = replaceDayContext(routes, routes.dayContext, validIds);

        const gigs =
            parsed.backupVersion === LEGACY_BACKUP_VERSION
                ? []
                : normalizeGigList(parsed.gigs, { validStopIds: validIds });
        const planning =
            parsed.backupVersion === BACKUP_VERSION ||
            parsed.backupVersion === PLANNING_BACKUP_VERSION
                ? normalizePlanningList(parsed.planning)
                : [];
        parsedGigsForRestore = gigs.map((gig) => ({ ...gig }));
        parsedPlanningForRestore = planning.map((record) => ({ ...record }));

        return {
            home: parsed.home || null,
            stops: parsed.stops,
            gigs,
            planning,
            routeIds: routes.google?.routeIds.length
                ? routes.google.routeIds
                : routes.basic?.routeIds || [],
            routes,
        };
    }

    function takeParsedGigsForRestore() {
        if (!Array.isArray(parsedGigsForRestore)) return null;
        const result = parsedGigsForRestore.map((gig) => ({ ...gig }));
        parsedGigsForRestore = null;
        return result;
    }

    function takeParsedPlanningForRestore() {
        if (!Array.isArray(parsedPlanningForRestore)) return null;
        const result = parsedPlanningForRestore.map((record) => ({ ...record }));
        parsedPlanningForRestore = null;
        return result;
    }

    function backupFilename(date = new Date()) {
        return `free-map-router-backup-${date.toISOString().slice(0, 10)}.json`;
    }

    return {
        BACKUP_VERSION,
        backupFilename,
        createBackup,
        parseBackup,
        takeParsedGigsForRestore,
        takeParsedPlanningForRestore,
    };
});