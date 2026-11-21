(function attachAssumedRouteLocation(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.FMRAssumedRouteLocation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildAssumedRouteLocation() {
    "use strict";

    // Separate device-local, operator-confirmed UI state. Never extend or rewrite
    // the Route Plan, saved stop, Drive, or workbook data schemas.
    const STORAGE_KEY = "fmr_assumed_route_location_v1";

    function routeContext(history, routeSlot) {
        const plan = history?.activePlan;
        if (!plan?.planId || !plan.activeDayId) return null;
        const slot = routeSlot === "basic" ? "basic" : "google";
        const day = plan.days?.find((item) => item.dayId === plan.activeDayId);
        const routeIds = day?.[slot]?.routeIds;
        if (!Array.isArray(routeIds) || routeIds.length === 0) return null;
        return {
            planId: plan.planId,
            dayId: day.dayId,
            routeDate: String(day.dayContext?.routeDate || ""),
            routeSlot: slot,
            routeIds,
        };
    }

    function isCurrent(selection, history, routeSlot, savedStops) {
        const context = routeContext(history, routeSlot);
        if (!context || !selection || selection.version !== 1) return false;
        if (selection.planId !== context.planId ||
            selection.dayId !== context.dayId ||
            selection.routeDate !== context.routeDate ||
            selection.routeSlot !== context.routeSlot) return false;
        const stopId = selection.stopId;
        return typeof stopId === "string" && stopId.length > 0 &&
            context.routeIds.includes(stopId) &&
            Array.isArray(savedStops) &&
            savedStops.some((stop) => stop?.id === stopId);
    }

    function prepare(history, routeSlot, stopId, savedStops) {
        const context = routeContext(history, routeSlot);
        const selection = context && {
            version: 1,
            planId: context.planId,
            dayId: context.dayId,
            routeDate: context.routeDate,
            routeSlot: context.routeSlot,
            stopId: String(stopId || ""),
        };
        if (!isCurrent(selection, history, routeSlot, savedStops)) {
            throw new Error("That address is no longer on the active route. Choose another stop.");
        }
        return selection;
    }

    function read(storage, history, routeSlot, savedStops) {
        try {
            const value = storage?.getItem?.(STORAGE_KEY);
            const parsed = value ? JSON.parse(value) : null;
            return isCurrent(parsed, history, routeSlot, savedStops) ? parsed : null;
        } catch {
            return null;
        }
    }

    function confirm(storage, selection, history, routeSlot, savedStops) {
        if (!isCurrent(selection, history, routeSlot, savedStops)) {
            throw new Error("The route changed. Choose Heading Here again.");
        }
        if (typeof storage?.setItem !== "function") {
            throw new Error("Your browser cannot save the assumed location.");
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(selection));
        return selection;
    }

    return Object.freeze({ STORAGE_KEY, prepare, read, confirm, isCurrent });
});
