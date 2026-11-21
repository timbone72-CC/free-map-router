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

    function isOnActiveDay(selection, history, savedStops) {
        const plan = history?.activePlan;
        const day = plan?.days?.find((item) => item.dayId === plan.activeDayId);
        if (!day || !selection || selection.version !== 1) return false;
        if (selection.planId !== plan.planId ||
            selection.dayId !== day.dayId ||
            selection.routeDate !== String(day.dayContext?.routeDate || "")) return false;
        const stopId = selection.stopId;
        return typeof stopId === "string" && stopId.length > 0 &&
            Array.isArray(savedStops) &&
            savedStops.some((stop) => stop?.id === stopId) &&
            ["google", "basic"].some(
                (slot) => day[slot]?.routeIds?.includes(stopId),
            );
    }

    function isCurrent(selection, history, routeSlot, savedStops) {
        const context = routeContext(history, routeSlot);
        return Boolean(context &&
            isOnActiveDay(selection, history, savedStops) &&
            selection.routeSlot === context.routeSlot &&
            context.routeIds.includes(selection.stopId));
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
            // This is a physical location for the active day, not a route-slot
            // preference. FMR can reopen on Google after the operator used Basic.
            return isOnActiveDay(parsed, history, savedStops) ? parsed : null;
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
