(function attachFreeMapRouterRouteOrder(root, factory) {
    const routePlan =
        typeof module === "object" && module.exports
            ? require("./route-plan.js")
            : root?.FMRRoutePlan;
    const routeOrder = factory(routePlan);

    if (typeof module === "object" && module.exports) {
        module.exports = routeOrder;
    }

    if (root) {
        root.FMRRouteOrder = routeOrder;
    }
})(
    typeof globalThis !== "undefined" ? globalThis : this,
    function buildRouteOrder(routePlan) {
        "use strict";

        if (!routePlan) {
            throw new Error("Free Map Router Route Plan failed to load.");
        }

        const { normalizeRoutePlan } = routePlan;
        const ROUTE_ORDER_APP = "free-map-router";
        const ROUTE_ORDER_VERSION = 1;
        const ACTIVE_DAY_ROUTE_ORDER_VERSION = 2;
        const ACTIVE_DAY_ROUTE_SCOPE = "active_day";
        const ROUTE_ORDER_TARGET = "InspectorADE Repeat Job Predictor - LIVE";
        const OPTIMIZATION_STATUSES = new Set([
            "not_optimized",
            "basic_optimized",
            "google_optimized",
            "manually_changed",
        ]);

        function text(value) {
            return String(value ?? "").trim();
        }

        function normalizedIds(values) {
            const result = [];
            const seen = new Set();

            for (const value of Array.isArray(values) ? values : []) {
                const id = text(value);
                if (!id || seen.has(id)) continue;
                seen.add(id);
                result.push(id);
            }

            return result;
        }

        function normalizedOrderIds(values) {
            return normalizedIds(values);
        }

        function normalizedGigIds(values) {
            return normalizedIds(values);
        }

        function validTimestamp(value) {
            if (!value) return null;
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date.toISOString();
        }

        function buildWorkbookRouteOrder({
            routeSlot,
            routeSnapshot,
            routeStops,
            now = new Date(),
        }) {
            const slot = routeSlot === "basic" ? "basic" : "google";
            const snapshot = routeSnapshot && typeof routeSnapshot === "object"
                ? routeSnapshot
                : {};
            const orderIdsByStopId =
                snapshot.orderIdsByStopId &&
                typeof snapshot.orderIdsByStopId === "object"
                    ? snapshot.orderIdsByStopId
                    : {};
            const gigIdsByStopId =
                snapshot.gigIdsByStopId &&
                typeof snapshot.gigIdsByStopId === "object"
                    ? snapshot.gigIdsByStopId
                    : {};
            const stops = [];
            const usedOrderIds = new Set();
            const usedGigIds = new Set();

            for (const [index, stop] of (Array.isArray(routeStops)
                ? routeStops
                : []).entries()) {
                const stopId = text(stop?.id);
                const orderIds = normalizedOrderIds(orderIdsByStopId[stopId]);
                const gigIds = normalizedGigIds(gigIdsByStopId[stopId]);
                if (orderIds.length === 0 && gigIds.length === 0) continue;

                for (const orderId of orderIds) {
                    if (usedOrderIds.has(orderId)) {
                        throw new Error(
                            `Workbook Order ID ${orderId} belongs to more than one route stop.`,
                        );
                    }
                    usedOrderIds.add(orderId);
                }

                for (const gigId of gigIds) {
                    if (usedGigIds.has(gigId)) {
                        throw new Error(
                            `Manual Gig ID ${gigId} belongs to more than one route stop.`,
                        );
                    }
                    usedGigIds.add(gigId);
                }

                const returnedStop = {
                    stopNumber: index + 1,
                    address: text(stop?.address),
                    orderIds,
                };
                if (gigIds.length > 0) returnedStop.gigIds = gigIds;
                stops.push(returnedStop);
            }

            if (stops.length === 0) {
                throw new Error(
                    "This route has no workbook jobs or manual gigs to send.",
                );
            }

            const updatedAt = validTimestamp(now);
            if (!updatedAt) throw new Error("The route order time is invalid.");

            const requestedStatus = text(snapshot.optimizationStatus);
            return {
                app: ROUTE_ORDER_APP,
                routeOrderVersion: ROUTE_ORDER_VERSION,
                target: ROUTE_ORDER_TARGET,
                updatedAt,
                routeSlot: slot,
                optimizationStatus: OPTIMIZATION_STATUSES.has(requestedStatus)
                    ? requestedStatus
                    : "not_optimized",
                sourceUpdatedAt: validTimestamp(snapshot.sourceUpdatedAt),
                stops,
            };
        }

        function activeDayContext(routeHistory, routeSlot, routeStops) {
            if (!routeHistory?.activePlan) {
                throw new Error(
                    "The active Route Plan is unavailable. Refresh Build Route and try again.",
                );
            }

            const plan = normalizeRoutePlan(routeHistory.activePlan);
            const dayIndex = plan.days.findIndex(
                (day) => day.dayId === plan.activeDayId,
            );
            if (dayIndex < 0) {
                throw new Error(
                    "The active Route Plan Day is unavailable. Refresh Build Route and try again.",
                );
            }

            const day = plan.days[dayIndex];
            const slot = routeSlot === "basic" ? "basic" : "google";
            const snapshot = day[slot];
            const routeName = slot === "basic" ? "Basic Route" : "Google Route";
            if (!snapshot?.routeIds?.length) {
                throw new Error(
                    `The active Route Plan Day has no ${routeName} to send.`,
                );
            }

            const displayedStops = Array.isArray(routeStops) ? routeStops : [];
            const displayedRouteIds = displayedStops.map((stop) => text(stop?.id));
            const expectedRouteIds = snapshot.routeIds;
            const exactDisplayMatch =
                displayedRouteIds.length === expectedRouteIds.length &&
                displayedRouteIds.every(
                    (stopId, index) => stopId === expectedRouteIds[index],
                );
            if (!exactDisplayMatch) {
                throw new Error(
                    "The displayed route no longer matches the active Route Plan Day. Refresh Build Route and try again.",
                );
            }

            return {
                plan,
                day,
                dayIndex,
                slot,
                snapshot,
                displayedStops,
            };
        }

        function buildActiveDayStops(snapshot, routeStops) {
            const stops = [];
            const usedOrderIds = new Set();
            const usedGigIds = new Set();

            routeStops.forEach((stop, index) => {
                const stopId = text(stop?.id);
                const orderIds = Array.isArray(snapshot.orderIdsByStopId?.[stopId])
                    ? snapshot.orderIdsByStopId[stopId].slice()
                    : [];
                const gigIds = Array.isArray(snapshot.gigIdsByStopId?.[stopId])
                    ? snapshot.gigIdsByStopId[stopId].slice()
                    : [];
                if (orderIds.length === 0 && gigIds.length === 0) return;

                for (const orderId of orderIds) {
                    if (usedOrderIds.has(orderId)) {
                        throw new Error(
                            `Workbook Order ID ${orderId} belongs to more than one active-Day route stop.`,
                        );
                    }
                    usedOrderIds.add(orderId);
                }
                for (const gigId of gigIds) {
                    if (usedGigIds.has(gigId)) {
                        throw new Error(
                            `Manual Gig ID ${gigId} belongs to more than one active-Day route stop.`,
                        );
                    }
                    usedGigIds.add(gigId);
                }

                const returnedStop = {
                    stopNumber: index + 1,
                    address: text(stop?.address),
                    orderIds,
                };
                if (gigIds.length > 0) returnedStop.gigIds = gigIds;
                stops.push(returnedStop);
            });

            if (stops.length === 0) {
                throw new Error(
                    "This active Day has no workbook jobs or manual gigs to send.",
                );
            }
            return stops;
        }

        function buildActiveDayWorkbookRouteOrder({
            routeSlot,
            routeHistory,
            routeStops,
            now = new Date(),
        }) {
            const context = activeDayContext(
                routeHistory,
                routeSlot,
                routeStops,
            );
            const { plan, day, dayIndex, slot, snapshot, displayedStops } =
                context;
            const stops = buildActiveDayStops(snapshot, displayedStops);
            const updatedAt = validTimestamp(now);
            if (!updatedAt) throw new Error("The route order time is invalid.");

            const sourceUpdatedAt = snapshot.sourceUpdatedAt || null;
            const inspectorAdeCount = stops.reduce(
                (count, stop) => count + stop.orderIds.length,
                0,
            );
            if (inspectorAdeCount > 0 && !sourceUpdatedAt) {
                throw new Error(
                    "The active Day contains InspectorADE work but has no current workbook source time. Check the workbook route before sending.",
                );
            }
            if (
                sourceUpdatedAt &&
                new Date(updatedAt).getTime() <
                    new Date(sourceUpdatedAt).getTime()
            ) {
                throw new Error(
                    "The route order time cannot predate the active Day's workbook source snapshot.",
                );
            }

            const requestedStatus = text(snapshot.optimizationStatus);
            return {
                app: ROUTE_ORDER_APP,
                routeOrderVersion: ACTIVE_DAY_ROUTE_ORDER_VERSION,
                routeScope: ACTIVE_DAY_ROUTE_SCOPE,
                target: ROUTE_ORDER_TARGET,
                updatedAt,
                routeSlot: slot,
                optimizationStatus: OPTIMIZATION_STATUSES.has(requestedStatus)
                    ? requestedStatus
                    : "not_optimized",
                sourceUpdatedAt,
                routePlan: {
                    planId: plan.planId,
                    planRevision: plan.revision,
                    dayId: day.dayId,
                    dayRevision: day.revision,
                    dayNumber: dayIndex + 1,
                    dayCount: plan.days.length,
                    routeDate: day.dayContext?.routeDate || null,
                },
                stops,
            };
        }

        function workbookOrderIdCount(routeOrder) {
            return (Array.isArray(routeOrder?.stops) ? routeOrder.stops : [])
                .reduce(
                    (count, stop) =>
                        count + normalizedOrderIds(stop?.orderIds).length,
                    0,
                );
        }

        function manualGigIdCount(routeOrder) {
            return (Array.isArray(routeOrder?.stops) ? routeOrder.stops : [])
                .reduce(
                    (count, stop) =>
                        count + normalizedGigIds(stop?.gigIds).length,
                    0,
                );
        }

        return Object.freeze({
            ACTIVE_DAY_ROUTE_ORDER_VERSION,
            ACTIVE_DAY_ROUTE_SCOPE,
            ROUTE_ORDER_APP,
            ROUTE_ORDER_TARGET,
            ROUTE_ORDER_VERSION,
            buildActiveDayWorkbookRouteOrder,
            buildWorkbookRouteOrder,
            workbookOrderIdCount,
            manualGigIdCount,
        });
    },
);
