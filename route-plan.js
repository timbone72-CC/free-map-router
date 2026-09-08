(function attachFreeMapRouterRoutePlan(root, factory) {
    const routePlan = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = routePlan;
    }

    if (root) {
        root.FMRRoutePlan = routePlan;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRoutePlan() {
    "use strict";

    const ROUTE_PLAN_SCHEMA_VERSION = 1;
    const WORK_ITEM_KINDS = new Set(["workbook", "gig"]);
    const OPTIMIZATION_STATUSES = new Set([
        "not_optimized",
        "basic_optimized",
        "google_optimized",
        "manually_changed",
    ]);
    const MIGRATION_EPOCH = "1970-01-01T00:00:00.000Z";

    function text(value) {
        return String(value ?? "").trim();
    }

    function normalizedId(value, label) {
        const id = text(value);
        if (!id) throw new Error(`${label} is required.`);
        return id;
    }

    function normalizedTimestamp(value, label) {
        const raw = text(value);
        const parsed = new Date(raw);
        if (!raw || Number.isNaN(parsed.getTime())) {
            throw new Error(`${label} must be a valid timestamp.`);
        }
        return parsed.toISOString();
    }

    function normalizedRevision(value, label) {
        const revision = Number(value);
        if (!Number.isInteger(revision) || revision < 1) {
            throw new Error(`${label} must be a positive whole number.`);
        }
        return revision;
    }

    function normalizedCalendarDate(value, label) {
        const raw = text(value);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        if (!match) throw new Error(`${label} must be a valid local YYYY-MM-DD date.`);
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) {
            throw new Error(`${label} must be a valid local YYYY-MM-DD date.`);
        }
        return raw;
    }

    function normalizedLocalTime(value, label) {
        const raw = text(value);
        const match = /^(\d{2}):(\d{2})$/.exec(raw);
        if (!match) throw new Error(`${label} must be a valid local HH:MM time.`);
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new Error(`${label} must be a valid local HH:MM time.`);
        }
        return raw;
    }

    function normalizedTimeZone(value) {
        const raw = text(value);
        if (!raw) throw new Error("Day context time zone is required.");
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date(0));
            return raw;
        } catch {
            throw new Error("Day context time zone is invalid.");
        }
    }

    function normalizedWorkItemKind(value) {
        const kind = text(value).toLowerCase();
        if (!WORK_ITEM_KINDS.has(kind)) {
            throw new Error("Route Plan work item kind must be workbook or gig.");
        }
        return kind;
    }

    function workItemKey(kind, workItemId) {
        return `${normalizedWorkItemKind(kind)}:${normalizedId(workItemId, "Work item ID")}`;
    }

    function normalizeWorkItemRef(value) {
        if (!value || typeof value !== "object") {
            throw new Error("Route Plan work item is required.");
        }
        return {
            kind: normalizedWorkItemKind(value.kind),
            workItemId: normalizedId(value.workItemId, "Work item ID"),
            stopId: normalizedId(value.stopId, "Work item stop ID"),
        };
    }

    function normalizeUniqueIds(values, label) {
        const result = [];
        const seen = new Set();
        for (const raw of Array.isArray(values) ? values : []) {
            const id = normalizedId(raw, label);
            if (seen.has(id)) throw new Error(`${label} ${id} is duplicated.`);
            seen.add(id);
            result.push(id);
        }
        return result;
    }

    function normalizedStringMap(value, routeIds, label) {
        const source = value && typeof value === "object" ? value : {};
        const result = {};
        const validStops = new Set(routeIds);
        for (const [rawStopId, rawValues] of Object.entries(source)) {
            const stopId = text(rawStopId);
            if (!validStops.has(stopId)) continue;
            const ids = normalizeUniqueIds(rawValues, label);
            if (ids.length) result[stopId] = ids;
        }
        return result;
    }

    function normalizedWorkbookPayMap(value, routeIds) {
        const source = value && typeof value === "object" ? value : {};
        const result = {};
        const validStops = new Set(routeIds);
        for (const [rawStopId, rawPay] of Object.entries(source)) {
            const stopId = text(rawStopId);
            if (!validStops.has(stopId) || !rawPay || typeof rawPay !== "object") continue;
            const expectedPay = Number(rawPay.expectedPay);
            if (!Number.isFinite(expectedPay) || expectedPay < 0) {
                throw new Error(`Workbook expected pay for ${stopId} is invalid.`);
            }
            if (typeof rawPay.expectedPayComplete !== "boolean") {
                throw new Error(`Workbook expected-pay completeness for ${stopId} is invalid.`);
            }
            result[stopId] = {
                expectedPay: Math.round((expectedPay + Number.EPSILON) * 100) / 100,
                expectedPayComplete: rawPay.expectedPayComplete,
            };
        }
        return result;
    }

    function wholeSecondTimestamp(value, label) {
        const raw = text(value);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw)) {
            throw new Error(`${label} must be a whole-second UTC timestamp.`);
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            throw new Error(`${label} must be a valid timestamp.`);
        }
        return raw;
    }

    function nonnegativeNumber(value, label) {
        if (value === null || value === undefined || value === "") {
            throw new Error(`${label} is required.`);
        }
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
            throw new Error(`${label} must be a nonnegative number.`);
        }
        return number;
    }

    function copiedSchedule(value, routeIds) {
        if (!value || typeof value !== "object") return null;
        const basisKey = normalizedId(value.basisKey, "Google schedule basis key");
        const visits = Array.isArray(value.visits)
            ? value.visits.map((visit) => ({
                  stopId: normalizedId(visit?.stopId, "Google schedule stop ID"),
                  startTime: wholeSecondTimestamp(
                      visit?.startTime,
                      "Google schedule visit start time",
                  ),
              }))
            : [];
        if (
            visits.length !== routeIds.length ||
            visits.some((visit, index) => visit.stopId !== routeIds[index])
        ) {
            throw new Error("Google schedule visits must match the exact route order.");
        }
        return {
            basisKey,
            vehicleStartTime: wholeSecondTimestamp(
                value.vehicleStartTime,
                "Google schedule vehicle start time",
            ),
            vehicleEndTime: wholeSecondTimestamp(
                value.vehicleEndTime,
                "Google schedule vehicle end time",
            ),
            travelDurationSeconds: nonnegativeNumber(
                value.travelDurationSeconds,
                "Google schedule travel duration",
            ),
            totalServiceDurationSeconds: nonnegativeNumber(
                value.totalServiceDurationSeconds,
                "Google schedule service duration",
            ),
            waitDurationSeconds: nonnegativeNumber(
                value.waitDurationSeconds,
                "Google schedule wait duration",
            ),
            visits,
        };
    }

    function normalizedOptimizationStatus(value) {
        const status = text(value);
        return OPTIMIZATION_STATUSES.has(status) ? status : "not_optimized";
    }

    function normalizeRouteSnapshot(value, options = {}) {
        if (value === null || value === undefined) return null;
        if (typeof value !== "object") throw new Error("Route snapshot must be an object.");
        const routeIds = normalizeUniqueIds(value.routeIds, "Route stop ID");
        const sourceUpdatedAt = text(value.sourceUpdatedAt)
            ? normalizedTimestamp(value.sourceUpdatedAt, "Route source timestamp")
            : null;
        if (routeIds.length === 0 && !sourceUpdatedAt) return null;
        return {
            routeIds,
            sourceUpdatedAt,
            optimizationStatus:
                routeIds.length === 0
                    ? "not_optimized"
                    : normalizedOptimizationStatus(value.optimizationStatus),
            orderIdsByStopId: normalizedStringMap(
                value.orderIdsByStopId,
                routeIds,
                "Workbook Order ID",
            ),
            workbookPayByStopId: normalizedWorkbookPayMap(
                value.workbookPayByStopId,
                routeIds,
            ),
            gigIdsByStopId: normalizedStringMap(
                value.gigIdsByStopId,
                routeIds,
                "Manual Gig ID",
            ),
            gigManagedStopIds: normalizeUniqueIds(
                value.gigManagedStopIds,
                "Gig-managed stop ID",
            ).filter((stopId) => routeIds.includes(stopId)),
            schedule: options.allowSchedule === true
                ? copiedSchedule(value.schedule, routeIds)
                : null,
        };
    }

    function copiedDayContext(value) {
        if (value === null || value === undefined) return null;
        if (typeof value !== "object") throw new Error("Day context must be an object or null.");
        return {
            routeDate: normalizedCalendarDate(value.routeDate, "Day context route date"),
            departureTime: normalizedLocalTime(
                value.departureTime,
                "Day context departure",
            ),
            preferredFinishTime: normalizedLocalTime(
                value.preferredFinishTime,
                "Day context preferred finish",
            ),
            homeByTime: normalizedLocalTime(value.homeByTime, "Day context Home By"),
            timeZone: normalizedTimeZone(value.timeZone),
        };
    }

    function routeSnapshotWorkItems(snapshot) {
        if (!snapshot) return [];
        const refs = [];
        for (const stopId of snapshot.routeIds) {
            for (const workItemId of snapshot.orderIdsByStopId?.[stopId] || []) {
                refs.push({ kind: "workbook", workItemId, stopId });
            }
            for (const workItemId of snapshot.gigIdsByStopId?.[stopId] || []) {
                refs.push({ kind: "gig", workItemId, stopId });
            }
        }
        return refs;
    }

    function unionDayWorkItems(day) {
        const byKey = new Map();
        for (const snapshot of [day.google, day.basic]) {
            for (const ref of routeSnapshotWorkItems(snapshot)) {
                const key = workItemKey(ref.kind, ref.workItemId);
                const existing = byKey.get(key);
                if (existing && existing.stopId !== ref.stopId) {
                    throw new Error(`Work item ${key} is attached to more than one physical stop.`);
                }
                byKey.set(key, normalizeWorkItemRef(ref));
            }
        }
        return Array.from(byKey.values());
    }

    function normalizeRoutePlanDay(value) {
        if (!value || typeof value !== "object") {
            throw new Error("Route Plan Day is required.");
        }
        const day = {
            dayId: normalizedId(value.dayId, "Day ID"),
            revision: normalizedRevision(value.revision, "Day revision"),
            updatedAt: normalizedTimestamp(value.updatedAt, "Day updatedAt"),
            dayContext: copiedDayContext(value.dayContext),
            google: normalizeRouteSnapshot(value.google, { allowSchedule: true }),
            basic: normalizeRouteSnapshot(value.basic, { allowSchedule: false }),
        };
        unionDayWorkItems(day);
        return day;
    }

    function normalizeStandaloneStop(value) {
        if (!value || typeof value !== "object") {
            throw new Error("Standalone Route Plan stop is required.");
        }
        const assignedDate = text(value.assignedDate)
            ? normalizedCalendarDate(
                  value.assignedDate,
                  "Standalone stop assigned date",
              )
            : null;
        if (value.lockedDay !== undefined && typeof value.lockedDay !== "boolean") {
            throw new Error("Standalone stop lockedDay must be true or false.");
        }
        return {
            stopId: normalizedId(value.stopId, "Standalone stop ID"),
            assignedDate,
            lockedDay: value.lockedDay === true,
        };
    }

    function normalizeRoutePlan(value) {
        if (!value || typeof value !== "object") throw new Error("Route Plan is required.");
        if (
            value.schemaVersion !== undefined &&
            Number(value.schemaVersion) !== ROUTE_PLAN_SCHEMA_VERSION
        ) {
            throw new Error("Route Plan schema version is unsupported.");
        }

        const workItems = [];
        const workByKey = new Map();
        const workStops = new Set();
        for (const raw of Array.isArray(value.workItems) ? value.workItems : []) {
            const item = normalizeWorkItemRef(raw);
            const key = workItemKey(item.kind, item.workItemId);
            const existing = workByKey.get(key);
            if (existing) {
                if (existing.stopId !== item.stopId) {
                    throw new Error(`Work item ${key} is attached to more than one physical stop.`);
                }
                throw new Error(`Work item ${key} is duplicated in the Route Plan.`);
            }
            workByKey.set(key, item);
            workStops.add(item.stopId);
            workItems.push(item);
        }

        const standaloneStops = [];
        const standaloneById = new Map();
        for (const raw of Array.isArray(value.standaloneStops)
            ? value.standaloneStops
            : []) {
            const standalone = normalizeStandaloneStop(raw);
            if (standaloneById.has(standalone.stopId)) {
                throw new Error(`Standalone stop ${standalone.stopId} is duplicated.`);
            }
            if (workStops.has(standalone.stopId)) {
                throw new Error(
                    `Stop ${standalone.stopId} cannot be both work-backed and standalone.`,
                );
            }
            standaloneById.set(standalone.stopId, standalone);
            standaloneStops.push(standalone);
        }

        const days = [];
        const dayById = new Map();
        const workDayByKey = new Map();
        const routeDayByStopId = new Map();
        for (const raw of Array.isArray(value.days) ? value.days : []) {
            const day = normalizeRoutePlanDay(raw);
            if (dayById.has(day.dayId)) throw new Error(`Day ${day.dayId} is duplicated.`);
            dayById.set(day.dayId, day);
            days.push(day);

            for (const item of unionDayWorkItems(day)) {
                const key = workItemKey(item.kind, item.workItemId);
                const planItem = workByKey.get(key);
                if (!planItem || planItem.stopId !== item.stopId) {
                    throw new Error(`Day ${day.dayId} contains work item ${key} outside the Route Plan pool.`);
                }
                const previousDay = workDayByKey.get(key);
                if (previousDay && previousDay !== day.dayId) {
                    throw new Error(`Work item ${key} appears on more than one Route Plan Day.`);
                }
                workDayByKey.set(key, day.dayId);
            }

            const dayRouteIds = new Set([
                ...(day.google?.routeIds || []),
                ...(day.basic?.routeIds || []),
            ]);
            for (const stopId of dayRouteIds) {
                if (!workStops.has(stopId) && !standaloneById.has(stopId)) {
                    throw new Error(`Day ${day.dayId} contains unknown standalone stop ${stopId}.`);
                }
                const previousDay = routeDayByStopId.get(stopId);
                if (previousDay && previousDay !== day.dayId) {
                    throw new Error(`Physical stop ${stopId} appears on more than one Route Plan Day.`);
                }
                routeDayByStopId.set(stopId, day.dayId);
            }
        }

        if (days.length === 0) throw new Error("An active Route Plan requires at least one Day.");
        const activeDayId = normalizedId(value.activeDayId, "Active Day ID");
        if (!dayById.has(activeDayId)) {
            throw new Error("Active Day ID must identify one saved Route Plan Day.");
        }

        return {
            schemaVersion: ROUTE_PLAN_SCHEMA_VERSION,
            planId: normalizedId(value.planId, "Route Plan ID"),
            revision: normalizedRevision(value.revision, "Route Plan revision"),
            updatedAt: normalizedTimestamp(value.updatedAt, "Route Plan updatedAt"),
            activeDayId,
            workItems,
            standaloneStops,
            days,
        };
    }

    function latestLegacyTimestamp(history) {
        const values = [history?.google?.sourceUpdatedAt, history?.basic?.sourceUpdatedAt]
            .filter(Boolean)
            .map((value) => normalizedTimestamp(value, "Legacy route source timestamp"))
            .sort();
        return values[values.length - 1] || MIGRATION_EPOCH;
    }

    function stableHash(value) {
        const input = JSON.stringify(value);
        let hash = 0x811c9dc5;
        for (let index = 0; index < input.length; index++) {
            hash ^= input.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    function snapshotMigrationIdentity(snapshot) {
        if (!snapshot) return null;
        return {
            routeIds: snapshot.routeIds,
            sourceUpdatedAt: snapshot.sourceUpdatedAt,
            orderIdsByStopId: snapshot.orderIdsByStopId,
            gigIdsByStopId: snapshot.gigIdsByStopId,
        };
    }

    function migrateOneDayRouteHistory(history) {
        if (!history || typeof history !== "object") {
            throw new Error("Normalized route-history v6 input is required for migration.");
        }
        const google = normalizeRouteSnapshot(history.google, { allowSchedule: true });
        const basic = normalizeRouteSnapshot(history.basic, { allowSchedule: false });
        if (!google && !basic) return null;

        const dayContext = copiedDayContext(history.dayContext);
        const identityBasis = {
            dayContext,
            google: snapshotMigrationIdentity(google),
            basic: snapshotMigrationIdentity(basic),
        };
        const identityHash = stableHash(identityBasis);
        const updatedAt = latestLegacyTimestamp({ google, basic });
        const provisionalDay = {
            dayId: `legacy-day-${identityHash}`,
            revision: 1,
            updatedAt,
            dayContext,
            google,
            basic,
        };
        const workItems = unionDayWorkItems(provisionalDay);
        const workStopIds = new Set(workItems.map((item) => item.stopId));
        const standaloneStopIds = normalizeUniqueIds(
            [
                ...(google?.routeIds || []),
                ...(basic?.routeIds || []),
            ].filter((stopId, index, all) => all.indexOf(stopId) === index),
            "Migrated route stop ID",
        ).filter((stopId) => !workStopIds.has(stopId));

        return normalizeRoutePlan({
            schemaVersion: ROUTE_PLAN_SCHEMA_VERSION,
            planId: `legacy-plan-${identityHash}`,
            revision: 1,
            updatedAt,
            activeDayId: provisionalDay.dayId,
            workItems,
            standaloneStops: standaloneStopIds.map((stopId) => ({
                stopId,
                assignedDate: dayContext?.routeDate || null,
                lockedDay: false,
            })),
            days: [provisionalDay],
        });
    }

    function planningByKey(records) {
        const result = new Map();
        for (const raw of Array.isArray(records) ? records : []) {
            if (!raw || typeof raw !== "object") continue;
            let key;
            try {
                key = workItemKey(raw.kind, raw.workItemId);
            } catch {
                continue;
            }
            if (!result.has(key)) result.set(key, raw);
        }
        return result;
    }

    function planWorkItemsForDate(planValue, planningRecords, routeDate) {
        const plan = normalizeRoutePlan(planValue);
        const date = normalizedCalendarDate(routeDate, "Route date");
        const byKey = planningByKey(planningRecords);
        return plan.workItems
            .filter((item) => text(byKey.get(workItemKey(item.kind, item.workItemId))?.assignedDate) === date)
            .map((item) => ({ ...item }));
    }

    function unassignedPlanWorkItems(planValue, planningRecords) {
        const plan = normalizeRoutePlan(planValue);
        const byKey = planningByKey(planningRecords);
        return plan.workItems
            .filter((item) => !text(byKey.get(workItemKey(item.kind, item.workItemId))?.assignedDate))
            .map((item) => ({ ...item }));
    }

    function standaloneStopsForDate(planValue, routeDate) {
        const plan = normalizeRoutePlan(planValue);
        const date = normalizedCalendarDate(routeDate, "Route date");
        return plan.standaloneStops
            .filter((stop) => stop.assignedDate === date)
            .map((stop) => ({ ...stop }));
    }

    return Object.freeze({
        ROUTE_PLAN_SCHEMA_VERSION,
        migrateOneDayRouteHistory,
        normalizeRoutePlan,
        normalizeRoutePlanDay,
        normalizeRouteSnapshot,
        normalizeWorkItemRef,
        planWorkItemsForDate,
        standaloneStopsForDate,
        unassignedPlanWorkItems,
        workItemKey,
    });
});
