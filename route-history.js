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
    const ROUTE_HISTORY_VERSION = 5;
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
        ROUTE_HISTORY_VERSION,
        STORAGE_KEY,
        normalizeRouteHistory,
        normalizeRouteSnapshot,
        readRouteHistory,
        remapRouteStopIds,
        replaceRoute,
        setGigRouteMembership,
        setRouteOptimizationStatus,
        stageWorkbookRoute,
        startPendingRoute,
        summarizeRouteExpectedPay,
        workbookRouteRelation,
        writeRouteHistory,
    };
});