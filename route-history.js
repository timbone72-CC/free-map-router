(function attachFreeMapRouterRouteHistory(root, factory) {
    const routeHistory = factory(root);

    if (typeof module === "object" && module.exports) {
        module.exports = routeHistory;
    }

    if (root) {
        root.FMRRouteHistory = routeHistory;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteHistory(root) {
    "use strict";

    const STORAGE_KEY = "fmr_route_history_v1";
    const ROUTE_HISTORY_VERSION = 6;
    const ROUTE_HISTORY_CHANGED_EVENT = "fmr:route-history-changed";
    const DAY_CONTEXT_REPLACE = Symbol("fmr-day-context-replace");
    const OPTIMIZATION_STATUSES = new Set([
        "not_optimized",
        "basic_optimized",
        "google_optimized",
        "manually_changed",
    ]);

    function roundedMoney(value) {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    function normalizedOptimizationStatus(value) {
        return OPTIMIZATION_STATUSES.has(value) ? value : "not_optimized";
    }

    function normalizedTimestamp(value) {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    function wholeSecondTimestamp(value) {
        const text = String(value ?? "").trim();
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text)) return null;
        const date = new Date(text);
        return Number.isNaN(date.getTime()) ? null : text;
    }

    function nonnegativeNumber(value) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : null;
    }

    function sameIds(left, right) {
        const a = Array.isArray(left) ? left : [];
        const b = Array.isArray(right) ? right : [];
        return a.length === b.length && a.every((id, index) => id === b[index]);
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

    function normalizedLocalDate(value) {
        const text = String(value ?? "").trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            return null;
        }
        return text;
    }

    function normalizedLocalTime(value) {
        const text = String(value ?? "").trim();
        const match = /^(\d{2}):(\d{2})$/.exec(text);
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return text;
    }

    function timeMinutes(value) {
        const normalized = normalizedLocalTime(value);
        if (!normalized) return null;
        const [hour, minute] = normalized.split(":").map(Number);
        return hour * 60 + minute;
    }

    function validTimeZone(value) {
        const timeZone = String(value ?? "").trim();
        if (!timeZone) return null;
        try {
            new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
            return timeZone;
        } catch {
            return null;
        }
    }

    function localPartsAt(epochMs, timeZone) {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        });
        const parts = {};
        for (const part of formatter.formatToParts(new Date(epochMs))) {
            if (part.type !== "literal") parts[part.type] = Number(part.value);
        }
        return {
            year: parts.year,
            month: parts.month,
            day: parts.day,
            hour: parts.hour,
            minute: parts.minute,
            second: parts.second,
        };
    }

    function offsetMinutesAt(epochMs, timeZone) {
        const wholeSecondEpoch = Math.floor(epochMs / 1000) * 1000;
        const parts = localPartsAt(wholeSecondEpoch, timeZone);
        const representedUtc = Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second,
        );
        return Math.round((representedUtc - wholeSecondEpoch) / 60000);
    }

    function localDateTimeExists(routeDate, localTime, timeZone) {
        const date = normalizedLocalDate(routeDate);
        const time = normalizedLocalTime(localTime);
        const zone = validTimeZone(timeZone);
        if (!date || !time || !zone) return false;

        const [year, month, day] = date.split("-").map(Number);
        const [hour, minute] = time.split(":").map(Number);
        const nominalUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
        const offsets = new Set();

        for (const delta of [-172800000, -86400000, 0, 86400000, 172800000]) {
            offsets.add(offsetMinutesAt(nominalUtc + delta, zone));
        }

        for (const offsetMinutes of offsets) {
            const candidate = nominalUtc - offsetMinutes * 60000;
            const parts = localPartsAt(candidate, zone);
            if (
                parts.year === year &&
                parts.month === month &&
                parts.day === day &&
                parts.hour === hour &&
                parts.minute === minute
            ) {
                return true;
            }
        }

        return false;
    }

    function validateDayContext(value) {
        if (!value || typeof value !== "object") {
            return { ok: false, error: "Route timing is incomplete.", dayContext: null };
        }

        const routeDate = normalizedLocalDate(value.routeDate);
        const departureTime = normalizedLocalTime(value.departureTime);
        const preferredFinishTime = normalizedLocalTime(value.preferredFinishTime);
        const homeByTime = normalizedLocalTime(value.homeByTime);
        const timeZone = validTimeZone(value.timeZone);

        if (!routeDate) {
            return { ok: false, error: "Route date must be a valid calendar date.", dayContext: null };
        }
        if (!departureTime) {
            return { ok: false, error: "Departure must be a valid local time.", dayContext: null };
        }
        if (!preferredFinishTime) {
            return { ok: false, error: "Preferred finish must be a valid local time.", dayContext: null };
        }
        if (!homeByTime) {
            return { ok: false, error: "Home by must be a valid local time.", dayContext: null };
        }
        if (!timeZone) {
            return { ok: false, error: "The route time zone is invalid.", dayContext: null };
        }
        if (timeMinutes(homeByTime) <= timeMinutes(departureTime)) {
            return { ok: false, error: "Home by must be later than Departure on the route date.", dayContext: null };
        }

        for (const [label, localTime] of [
            ["Departure", departureTime],
            ["Preferred finish", preferredFinishTime],
            ["Home by", homeByTime],
        ]) {
            if (!localDateTimeExists(routeDate, localTime, timeZone)) {
                return {
                    ok: false,
                    error: `${label} does not exist on ${routeDate} in ${timeZone}.`,
                    dayContext: null,
                };
            }
        }

        return {
            ok: true,
            error: "",
            dayContext: {
                routeDate,
                departureTime,
                preferredFinishTime,
                homeByTime,
                timeZone,
            },
        };
    }

    function normalizeDayContext(value) {
        if (value === null || value === undefined) return null;
        const validation = validateDayContext(value);
        return validation.ok ? validation.dayContext : null;
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

    function normalizedStringIds(values) {
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

    function normalizedOrderIds(values) {
        return normalizedStringIds(values);
    }

    function normalizedOrderIdsByStopId(value, routeIds) {
        const result = {};
        const source = value && typeof value === "object" ? value : {};

        for (const stopId of routeIds) {
            const orderIds = normalizedOrderIds(source[stopId]);
            if (orderIds.length > 0) result[stopId] = orderIds;
        }

        return result;
    }

    function normalizedGigIdsByStopId(value, routeIds) {
        const result = {};
        const source = value && typeof value === "object" ? value : {};

        for (const stopId of routeIds) {
            const gigIds = normalizedStringIds(source[stopId]);
            if (gigIds.length > 0) result[stopId] = gigIds;
        }

        return result;
    }

    function normalizedGigManagedStopIds(values, routeIds) {
        const validRouteIds = new Set(routeIds);
        return normalizedStringIds(values).filter((id) => validRouteIds.has(id));
    }

    function normalizedWorkbookPayEntry(value) {
        if (!value || typeof value !== "object") return null;
        const expectedPay = Number(value.expectedPay);
        if (!Number.isFinite(expectedPay) || expectedPay < 0) return null;
        return {
            expectedPay: roundedMoney(expectedPay),
            expectedPayComplete: value.expectedPayComplete === true,
        };
    }

    function normalizedWorkbookPayByStopId(value, routeIds) {
        const result = {};
        const source = value && typeof value === "object" ? value : {};
        for (const stopId of routeIds) {
            const entry = normalizedWorkbookPayEntry(source[stopId]);
            if (entry) result[stopId] = entry;
        }
        return result;
    }

    function normalizeRouteSnapshot(
        value,
        validIds = null,
        allowGoogleSchedule = false,
    ) {
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
            orderIdsByStopId: normalizedOrderIdsByStopId(
                value.orderIdsByStopId,
                routeIds,
            ),
            workbookPayByStopId: normalizedWorkbookPayByStopId(
                value.workbookPayByStopId,
                routeIds,
            ),
            gigIdsByStopId: normalizedGigIdsByStopId(
                value.gigIdsByStopId,
                routeIds,
            ),
            gigManagedStopIds: normalizedGigManagedStopIds(
                value.gigManagedStopIds,
                routeIds,
            ),
            schedule: allowGoogleSchedule
                ? normalizeStoredGoogleSchedule(value.schedule, routeIds)
                : null,
        };
    }

    function copiedSnapshot(snapshot, optimizationStatus = null) {
        if (!snapshot) return null;
        return {
            routeIds: snapshot.routeIds.slice(),
            sourceUpdatedAt: snapshot.sourceUpdatedAt,
            optimizationStatus:
                optimizationStatus || snapshot.optimizationStatus,
            orderIdsByStopId: normalizedOrderIdsByStopId(
                snapshot.orderIdsByStopId,
                snapshot.routeIds,
            ),
            workbookPayByStopId: normalizedWorkbookPayByStopId(
                snapshot.workbookPayByStopId,
                snapshot.routeIds,
            ),
            gigIdsByStopId: normalizedGigIdsByStopId(
                snapshot.gigIdsByStopId,
                snapshot.routeIds,
            ),
            gigManagedStopIds: normalizedGigManagedStopIds(
                snapshot.gigManagedStopIds,
                snapshot.routeIds,
            ),
            schedule: null,
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
            dayContext: null,
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
            dayContext: normalizeDayContext(value?.dayContext),
            google: normalizeRouteSnapshot(value?.google, validIds, true),
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

    function scheduleSnapshotBasis(snapshot) {
        if (!snapshot) return "";
        return JSON.stringify({
            routeIds: snapshot.routeIds,
            sourceUpdatedAt: snapshot.sourceUpdatedAt,
            optimizationStatus: snapshot.optimizationStatus,
            orderIdsByStopId: snapshot.orderIdsByStopId,
            workbookPayByStopId: snapshot.workbookPayByStopId,
            gigIdsByStopId: snapshot.gigIdsByStopId,
            gigManagedStopIds: snapshot.gigManagedStopIds,
        });
    }

    function scheduleDayBasis(dayContext) {
        if (!dayContext) return "";
        return JSON.stringify({
            routeDate: dayContext.routeDate,
            departureTime: dayContext.departureTime,
            homeByTime: dayContext.homeByTime,
            timeZone: dayContext.timeZone,
        });
    }

    function canPreserveStoredGoogleSchedule(nextHistory, storedHistory) {
        if (!storedHistory?.google?.schedule || !nextHistory?.google) return false;
        const nextDayBasis = scheduleDayBasis(nextHistory.dayContext);
        const storedDayBasis = scheduleDayBasis(storedHistory.dayContext);
        if (!nextDayBasis || nextDayBasis !== storedDayBasis) return false;
        return (
            scheduleSnapshotBasis(nextHistory.google) ===
            scheduleSnapshotBasis(storedHistory.google)
        );
    }

    function markDayContextReplacement(history) {
        if (history && typeof history === "object") {
            Object.defineProperty(history, DAY_CONTEXT_REPLACE, {
                value: true,
                configurable: true,
                enumerable: false,
            });
        }
        return history;
    }

    function replaceDayContext(history, dayContext, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        if (dayContext === null || dayContext === undefined) {
            normalized.dayContext = null;
            if (normalized.google) normalized.google.schedule = null;
            return markDayContextReplacement(normalized);
        }

        const validation = validateDayContext(dayContext);
        if (!validation.ok) {
            throw new Error(validation.error);
        }

        const previousScheduleBasis = scheduleDayBasis(normalized.dayContext);
        normalized.dayContext = validation.dayContext;
        if (
            normalized.google?.schedule &&
            previousScheduleBasis !== scheduleDayBasis(normalized.dayContext)
        ) {
            normalized.google.schedule = null;
        }
        return markDayContextReplacement(normalized);
    }

    function emitRouteHistoryChanged(history) {
        if (
            !root ||
            typeof root.dispatchEvent !== "function" ||
            typeof root.CustomEvent !== "function"
        ) {
            return;
        }
        root.dispatchEvent(
            new root.CustomEvent(ROUTE_HISTORY_CHANGED_EVENT, {
                detail: { history },
            }),
        );
    }

    function writeRouteHistory(storage, history, validIds = null) {
        const replaceStoredDayContext = Boolean(history?.[DAY_CONTEXT_REPLACE]);
        const normalized = normalizeRouteHistory(history, validIds);
        let stored = null;

        try {
            const raw = storage?.getItem?.(STORAGE_KEY);
            if (raw) {
                stored = normalizeRouteHistory(JSON.parse(raw), validIds);
            }
        } catch {
            stored = null;
        }

        if (!replaceStoredDayContext && stored?.dayContext) {
            normalized.dayContext = stored.dayContext;
        }

        if (
            !normalized.google?.schedule &&
            canPreserveStoredGoogleSchedule(normalized, stored)
        ) {
            normalized.google.schedule = stored.google.schedule;
        }

        storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalized));
        emitRouteHistoryChanged(normalized);
        return normalized;
    }

    function writeDayContext(storage, dayContext, validIds = null) {
        const current = readRouteHistory(storage, validIds);
        return writeRouteHistory(
            storage,
            replaceDayContext(current, dayContext, validIds),
            validIds,
        );
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
                orderIdsByStopId: existing?.orderIdsByStopId,
                workbookPayByStopId: existing?.workbookPayByStopId,
                gigIdsByStopId: existing?.gigIdsByStopId,
                gigManagedStopIds: existing?.gigManagedStopIds,
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
            key === "google",
        );
        return normalized;
    }

    function combineWorkbookPay(left, right) {
        if (!left && !right) return null;
        if (!left) return { ...right };
        if (!right) return { ...left };
        return {
            expectedPay: roundedMoney(
                left.expectedPay + right.expectedPay,
            ),
            expectedPayComplete: Boolean(
                left.expectedPayComplete && right.expectedPayComplete,
            ),
        };
    }

    function remapRouteStopIds(
        history,
        idRemap = {},
        validIds = null,
    ) {
        const normalized = normalizeRouteHistory(history);
        const replacements =
            idRemap && typeof idRemap === "object" ? idRemap : {};

        function remapSnapshot(snapshot) {
            if (!snapshot) return null;

            const routeIds = [];
            const seenRouteIds = new Set();
            const orderIdsByStopId = {};
            const workbookPayByStopId = {};
            const gigIdsByStopId = {};
            const managedState = {};
            const originalManaged = new Set(snapshot.gigManagedStopIds || []);

            for (const oldId of snapshot.routeIds) {
                const replacement = replacements[oldId];
                const stopId =
                    typeof replacement === "string" && replacement.trim()
                        ? replacement.trim()
                        : oldId;
                if (validIds && !validIds.has(stopId)) continue;

                if (!seenRouteIds.has(stopId)) {
                    seenRouteIds.add(stopId);
                    routeIds.push(stopId);
                    managedState[stopId] = originalManaged.has(oldId);
                } else if (!originalManaged.has(oldId)) {
                    managedState[stopId] = false;
                }

                const combinedOrderIds = orderIdsByStopId[stopId] || [];
                for (const orderId of normalizedOrderIds(
                    snapshot.orderIdsByStopId?.[oldId],
                )) {
                    if (!combinedOrderIds.includes(orderId)) {
                        combinedOrderIds.push(orderId);
                    }
                }
                if (combinedOrderIds.length > 0) {
                    orderIdsByStopId[stopId] = combinedOrderIds;
                }

                const oldPay = normalizedWorkbookPayEntry(
                    snapshot.workbookPayByStopId?.[oldId],
                );
                if (oldPay) {
                    workbookPayByStopId[stopId] = combineWorkbookPay(
                        workbookPayByStopId[stopId] || null,
                        oldPay,
                    );
                }

                const combinedGigIds = gigIdsByStopId[stopId] || [];
                for (const gigId of normalizedStringIds(
                    snapshot.gigIdsByStopId?.[oldId],
                )) {
                    if (!combinedGigIds.includes(gigId)) {
                        combinedGigIds.push(gigId);
                    }
                }
                if (combinedGigIds.length > 0) {
                    gigIdsByStopId[stopId] = combinedGigIds;
                }
            }

            const gigManagedStopIds = routeIds.filter(
                (stopId) => managedState[stopId] === true,
            );

            return normalizeRouteSnapshot(
                {
                    ...snapshot,
                    routeIds,
                    orderIdsByStopId,
                    workbookPayByStopId,
                    gigIdsByStopId,
                    gigManagedStopIds,
                },
                validIds,
            );
        }

        return normalizeRouteHistory(
            {
                version: ROUTE_HISTORY_VERSION,
                dayContext: normalized.dayContext,
                google: remapSnapshot(normalized.google),
                basic: remapSnapshot(normalized.basic),
                pending: remapSnapshot(normalized.pending),
            },
            validIds,
        );
    }

    function setGigRouteMembership(history, gig, included, validIds = null) {
        const normalized = normalizeRouteHistory(history, validIds);
        const gigId = String(gig?.id || "").trim();
        const stopId = String(gig?.stopId || "").trim();
        if (!gigId || !stopId || (validIds && !validIds.has(stopId))) {
            return normalized;
        }

        for (const key of ["google", "basic"]) {
            const existing = normalized[key];

            if (included) {
                const routeIds = existing?.routeIds.slice() || [];
                const alreadyPresent = routeIds.includes(stopId);
                if (!alreadyPresent) routeIds.push(stopId);

                const gigIdsByStopId = {
                    ...(existing?.gigIdsByStopId || {}),
                };
                const gigIds = normalizedStringIds(gigIdsByStopId[stopId]);
                if (!gigIds.includes(gigId)) gigIds.push(gigId);
                gigIdsByStopId[stopId] = gigIds;

                const managed = new Set(existing?.gigManagedStopIds || []);
                if (!alreadyPresent) managed.add(stopId);

                let optimizationStatus =
                    existing?.optimizationStatus || "not_optimized";
                if (
                    !alreadyPresent &&
                    existing &&
                    optimizationStatus !== "not_optimized"
                ) {
                    optimizationStatus = "manually_changed";
                }

                normalized[key] = normalizeRouteSnapshot(
                    {
                        routeIds,
                        sourceUpdatedAt: existing?.sourceUpdatedAt || null,
                        optimizationStatus,
                        orderIdsByStopId: existing?.orderIdsByStopId || {},
                        workbookPayByStopId:
                            existing?.workbookPayByStopId || {},
                        gigIdsByStopId,
                        gigManagedStopIds: Array.from(managed),
                    },
                    validIds,
                );
                continue;
            }

            if (!existing) continue;

            const gigIdsByStopId = {
                ...(existing.gigIdsByStopId || {}),
            };
            const remainingGigIds = normalizedStringIds(
                gigIdsByStopId[stopId],
            ).filter((id) => id !== gigId);
            if (remainingGigIds.length > 0) {
                gigIdsByStopId[stopId] = remainingGigIds;
            } else {
                delete gigIdsByStopId[stopId];
            }

            const managed = new Set(existing.gigManagedStopIds || []);
            let routeIds = existing.routeIds.slice();
            let routeChanged = false;
            const hasWorkbookIds =
                normalizedOrderIds(existing.orderIdsByStopId?.[stopId]).length >
                0;

            if (
                remainingGigIds.length === 0 &&
                managed.has(stopId) &&
                !hasWorkbookIds
            ) {
                routeIds = routeIds.filter((id) => id !== stopId);
                routeChanged = true;
            }
            if (remainingGigIds.length === 0) managed.delete(stopId);

            let optimizationStatus = existing.optimizationStatus;
            if (routeChanged && routeIds.length > 0) {
                optimizationStatus =
                    optimizationStatus === "not_optimized"
                        ? "not_optimized"
                        : "manually_changed";
            }

            normalized[key] = normalizeRouteSnapshot(
                {
                    ...existing,
                    routeIds,
                    optimizationStatus,
                    gigIdsByStopId,
                    gigManagedStopIds: Array.from(managed),
                },
                validIds,
            );
        }

        return normalizeRouteHistory(normalized, validIds);
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
        orderIdsByStopId = null,
        workbookPayByStopId = null,
    ) {
        const normalized = normalizeRouteHistory(history, validIds);
        const result = workbookRouteRelation(normalized, sourceUpdatedAt);
        if (result !== "newer") return { history: normalized, result };

        normalized.pending = normalizeRouteSnapshot(
            {
                routeIds,
                sourceUpdatedAt,
                optimizationStatus: "not_optimized",
                orderIdsByStopId,
                workbookPayByStopId,
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
        const freshHistory = {
            version: ROUTE_HISTORY_VERSION,
            dayContext: null,
            google: copiedSnapshot(freshRoute),
            basic: copiedSnapshot(freshRoute),
            pending: null,
        };
        return {
            history: markDayContextReplacement(freshHistory),
            result: "started",
        };
    }

    function summarizeRouteExpectedPay(snapshot, gigs = []) {
        const normalized = normalizeRouteSnapshot(snapshot);
        if (!normalized) {
            return {
                inspectorAdeExpectedPay: 0,
                manualGigExpectedPay: 0,
                totalKnownExpectedPay: 0,
                payIncomplete: false,
                hasRepresentedWork: false,
            };
        }

        let inspectorAdeExpectedPay = 0;
        let manualGigExpectedPay = 0;
        let payIncomplete = false;
        let hasRepresentedWork = false;

        for (const stopId of normalized.routeIds) {
            const orderIds = normalizedOrderIds(
                normalized.orderIdsByStopId?.[stopId],
            );
            const pay = normalizedWorkbookPayEntry(
                normalized.workbookPayByStopId?.[stopId],
            );
            if (orderIds.length > 0 || pay) {
                hasRepresentedWork = true;
                if (pay) {
                    inspectorAdeExpectedPay += pay.expectedPay;
                    if (!pay.expectedPayComplete) payIncomplete = true;
                } else if (orderIds.length > 0) {
                    payIncomplete = true;
                }
            }
        }

        const gigById = new Map();
        for (const gig of Array.isArray(gigs) ? gigs : []) {
            const gigId = String(gig?.id || "").trim();
            if (gigId && !gigById.has(gigId)) gigById.set(gigId, gig);
        }

        const countedGigIds = new Set();
        for (const stopId of normalized.routeIds) {
            for (const gigId of normalizedStringIds(
                normalized.gigIdsByStopId?.[stopId],
            )) {
                if (countedGigIds.has(gigId)) continue;
                countedGigIds.add(gigId);
                hasRepresentedWork = true;
                const gig = gigById.get(gigId);
                const expectedPay = gig?.expectedPay;
                if (
                    expectedPay === null ||
                    expectedPay === undefined ||
                    expectedPay === ""
                ) {
                    payIncomplete = true;
                    continue;
                }
                const amount = Number(expectedPay);
                if (!Number.isFinite(amount) || amount < 0) {
                    payIncomplete = true;
                    continue;
                }
                manualGigExpectedPay += amount;
            }
        }

        inspectorAdeExpectedPay = roundedMoney(inspectorAdeExpectedPay);
        manualGigExpectedPay = roundedMoney(manualGigExpectedPay);
        return {
            inspectorAdeExpectedPay,
            manualGigExpectedPay,
            totalKnownExpectedPay: roundedMoney(
                inspectorAdeExpectedPay + manualGigExpectedPay,
            ),
            payIncomplete,
            hasRepresentedWork,
        };
    }

    return {
        ROUTE_HISTORY_CHANGED_EVENT,
        ROUTE_HISTORY_VERSION,
        STORAGE_KEY,
        localDateTimeExists,
        normalizeDayContext,
        normalizeRouteHistory,
        normalizeRouteSnapshot,
        readRouteHistory,
        remapRouteStopIds,
        replaceDayContext,
        replaceRoute,
        setGigRouteMembership,
        setRouteOptimizationStatus,
        stageWorkbookRoute,
        startPendingRoute,
        summarizeRouteExpectedPay,
        validateDayContext,
        workbookRouteRelation,
        writeDayContext,
        writeRouteHistory,
    };
});