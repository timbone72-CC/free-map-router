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

    function sameIds(left, right) {
        const a = Array.isArray(left) ? left : [];
        const b = Array.isArray(right) ? right : [];
        return a.length === b.length && a.every((id, index) => id === b[index]);
    }

    function wholeSecondTimestamp(value) {
        const raw = String(value ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw)) return null;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : raw;
    }

    function nonnegativeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : null;
    }

    function normalizeStoredGoogleSchedule(value, routeIds) {
        if (!value || typeof value !== "object") return null;
        const expectedIds = Array.isArray(routeIds) ? routeIds : [];
        const basisKey = String(value.basisKey ?? "").trim();
        const vehicleStartTime = wholeSecondTimestamp(value.vehicleStartTime);
        const vehicleEndTime = wholeSecondTimestamp(value.vehicleEndTime);
        const travelDurationSeconds = nonnegativeNumber(
            value.travelDurationSeconds,
        );
        const totalServiceDurationSeconds = nonnegativeNumber(
            value.totalServiceDurationSeconds,
        );
        const waitDurationSeconds = nonnegativeNumber(value.waitDurationSeconds);
        const visits = Array.isArray(value.visits) ? value.visits : [];

        if (
            !basisKey ||
            !vehicleStartTime ||
            !vehicleEndTime ||
            travelDurationSeconds === null ||
            totalServiceDurationSeconds === null ||
            waitDurationSeconds === null ||
            visits.length !== expectedIds.length
        ) {
            return null;
        }

        const normalizedVisits = visits.map((visit) => ({
            stopId: String(visit?.stopId ?? "").trim(),
            startTime: wholeSecondTimestamp(visit?.startTime),
        }));
        if (
            normalizedVisits.some((visit) => !visit.stopId || !visit.startTime) ||
            !sameIds(
                normalizedVisits.map((visit) => visit.stopId),
                expectedIds,
            )
        ) {
            return null;
        }

        return {
            basisKey,
            vehicleStartTime,
            vehicleEndTime,
            travelDurationSeconds,
            totalServiceDurationSeconds,
            waitDurationSeconds,
            visits: normalizedVisits,
        };
    }

    function rawBrowserGoogleSchedule(routeIds) {
        if (!root?.localStorage || !routeHistory.STORAGE_KEY) return null;
        try {
            const raw = root.localStorage.getItem(routeHistory.STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!sameIds(parsed?.google?.routeIds, routeIds)) return null;
            return normalizeStoredGoogleSchedule(
                parsed?.google?.schedule,
                routeIds,
            );
        } catch {
            return null;
        }
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

        const googleRouteIds = normalizedRoutes.google?.routeIds || [];
        const persistedSchedule = rawBrowserGoogleSchedule(googleRouteIds);
        if (persistedSchedule && normalizedRoutes.google) {
            normalizedRoutes.google = {
                ...normalizedRoutes.google,
                schedule: persistedSchedule,
            };
        }
        if (normalizedRoutes.basic) {
            normalizedRoutes.basic = {
                ...normalizedRoutes.basic,
                schedule: null,
            };
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

        const restoredSchedule =
            parsed.backupVersion === BACKUP_VERSION
                ? normalizeStoredGoogleSchedule(
                      parsed.routes?.google?.schedule,
                      routes.google?.routeIds || [],
                  )
                : null;
        if (restoredSchedule && routes.google) {
            routes.google = {
                ...routes.google,
                schedule: restoredSchedule,
            };
        }

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
        parsedGoogleScheduleForRestore = restoredSchedule
            ? {
                  routeIds: routes.google?.routeIds.slice() || [],
                  schedule: {
                      ...restoredSchedule,
                      visits: restoredSchedule.visits.map((visit) => ({
                          ...visit,
                      })),
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
        const result = parsedPlanningForRestore.map((record) => ({ ...record }));
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
        normalizeStoredGoogleSchedule,
        parseBackup,
        takeParsedGigsForRestore,
        takeParsedGoogleScheduleForRestore,
        takeParsedPlanningForRestore,
    };
});