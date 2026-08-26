(function attachFreeMapRouterRouteOrder(root, factory) {
    const routeOrder = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = routeOrder;
    }

    if (root) {
        root.FMRRouteOrder = routeOrder;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteOrder() {
    "use strict";

    const ROUTE_ORDER_APP = "free-map-router";
    const ROUTE_ORDER_VERSION = 1;
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
        ROUTE_ORDER_APP,
        ROUTE_ORDER_TARGET,
        ROUTE_ORDER_VERSION,
        buildWorkbookRouteOrder,
        workbookOrderIdCount,
        manualGigIdCount,
    });
});
