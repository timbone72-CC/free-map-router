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
})(
    typeof globalThis !== "undefined" ? globalThis : this,
    function buildBackup(routeHistory, gigContract, workItemPlanning, root) {
        "use strict";

        const BACKUP_VERSION = 5;
        const ROUTE_TIMING_BACKUP_VERSION = 4;
        const PLANNING_BACKUP_VERSION = 3;
        const GIG_BACKUP_VERSION = 2;
        const LEGACY_BACKUP_VERSION = 1;
        const SUPPORTED_VERSIONS = new Set([
            LEGACY_BACKUP_VERSION,
            GIG_BACKUP_VERSION,
            PLANNING_BACKUP_VERSION,
            ROUTE_TIMING_BACKUP_VERSION,
            BACKUP_VERSION,
        ]);
        let parsedGigsForRestore = null;
        let parsedPlanningForRestore = null;
        let parsedGoogleScheduleForRestore = null;

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
            markRestoreReplacement,
            normalizeRouteHistory,
            readRouteHistory,
            validateDayContext,
        } = routeHistory;
        const { normalizeGigList, readGigs } = gigContract;
        const { normalizePlanningList, readPlanningRecords } = workItemPlanning;

        function validStopIds(stops) {
            return new Set(
                (Array.isArray(stops) ? stops : [])
                    .map((stop) => stop?.id)
                    .filter(
                        (id) =>
                            typeof id === "string" && id.trim(),
                    ),
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
            try {
                return readRouteHistory(root.localStorage, validIds);
            } catch {
                return null;
            }
        }

        function routeFallback(routeIds) {
            return {
                current: { routeIds },
                previous: null,
            };
        }

        function createBackup({
            home,
            stops,
            gigs,
            planning,
            routeIds,
            routes,
        }) {
            const validIds = validStopIds(stops);
            const persistedRoutes = currentBrowserRoutes(validIds);
            const normalizedRoutes = persistedRoutes ||
                normalizeRouteHistory(
                    routes || routeFallback(routeIds),
                    validIds,
                );
            const backupGigs =
                gigs === undefined
                    ? currentBrowserGigs(validIds)
                    : gigs;
            const backupPlanning =
                planning === undefined
                    ? currentBrowserPlanning()
                    : planning;

            return {
                app: "free-map-router",
                backupVersion: BACKUP_VERSION,
                createdAt: new Date().toISOString(),
                home: home || null,
                stops: Array.isArray(stops) ? stops : [],
                gigs: normalizeGigList(backupGigs, {
                    validStopIds: validIds,
                }),
                planning: normalizePlanningList(backupPlanning),
                routeIds: normalizedRoutes.google?.routeIds.length
                    ? normalizedRoutes.google.routeIds
                    : normalizedRoutes.basic?.routeIds || [],
                routes: normalizedRoutes,
            };
        }

        function validateBackupTiming(parsed) {
            if (parsed.backupVersion === ROUTE_TIMING_BACKUP_VERSION) {
                const value = parsed.routes?.dayContext;
                if (value === null || value === undefined) return;
                const validation = validateDayContext(value);
                if (!validation.ok) {
                    throw new Error(
                        `That Free Map Router backup has invalid route timing: ${validation.error}`,
                    );
                }
                return;
            }

            if (parsed.backupVersion !== BACKUP_VERSION) return;
            const days = Array.isArray(parsed.routes?.activePlan?.days)
                ? parsed.routes.activePlan.days
                : [];
            for (const day of days) {
                if (day?.dayContext === null || day?.dayContext === undefined) {
                    continue;
                }
                const validation = validateDayContext(day.dayContext);
                if (!validation.ok) {
                    throw new Error(
                        `That Free Map Router backup has invalid route timing: ${validation.error}`,
                    );
                }
            }
        }

        function parseBackup(text) {
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch {
                throw new Error(
                    "That file is not a valid Free Map Router backup.",
                );
            }

            if (
                parsed?.app !== "free-map-router" ||
                !SUPPORTED_VERSIONS.has(parsed?.backupVersion) ||
                !Array.isArray(parsed?.stops) ||
                !Array.isArray(parsed?.routeIds)
            ) {
                throw new Error(
                    "That file is not a valid Free Map Router backup.",
                );
            }

            validateBackupTiming(parsed);

            const validIds = validStopIds(parsed.stops);
            let routes;
            try {
                routes = normalizeRouteHistory(
                    parsed.routes || routeFallback(parsed.routeIds),
                    validIds,
                );
            } catch (error) {
                throw new Error(
                    `That Free Map Router backup has invalid route data: ${error?.message || "route data could not be read."}`,
                );
            }

            const gigs =
                parsed.backupVersion === LEGACY_BACKUP_VERSION
                    ? []
                    : normalizeGigList(parsed.gigs, {
                          validStopIds: validIds,
                      });
            const planning =
                parsed.backupVersion === BACKUP_VERSION ||
                parsed.backupVersion === ROUTE_TIMING_BACKUP_VERSION ||
                parsed.backupVersion === PLANNING_BACKUP_VERSION
                    ? normalizePlanningList(parsed.planning)
                    : [];

            parsedGigsForRestore = gigs.map((gig) => ({ ...gig }));
            parsedPlanningForRestore = planning.map((record) => ({
                ...record,
            }));
            routes = markRestoreReplacement(routes);

            parsedGoogleScheduleForRestore = routes.google?.schedule
                ? {
                      routeIds: routes.google.routeIds.slice(),
                      schedule: {
                          ...routes.google.schedule,
                          visits: routes.google.schedule.visits.map(
                              (visit) => ({ ...visit }),
                          ),
                      },
                  }
                : null;

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
            const result = parsedPlanningForRestore.map((record) => ({
                ...record,
            }));
            parsedPlanningForRestore = null;
            return result;
        }

        function takeParsedGoogleScheduleForRestore() {
            if (!parsedGoogleScheduleForRestore) return null;
            const result = {
                routeIds: parsedGoogleScheduleForRestore.routeIds.slice(),
                schedule: {
                    ...parsedGoogleScheduleForRestore.schedule,
                    visits: parsedGoogleScheduleForRestore.schedule.visits.map(
                        (visit) => ({ ...visit }),
                    ),
                },
            };
            parsedGoogleScheduleForRestore = null;
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
            takeParsedGoogleScheduleForRestore,
            takeParsedPlanningForRestore,
        };
    },
);
