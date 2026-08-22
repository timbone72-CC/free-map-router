(function attachFreeMapRouterRouteWorkControls(root) {
    "use strict";

    const clearContract = root?.FMRRouteWorkClear;
    const routeHistoryContract = root?.FMRRouteHistory;
    const gigContract = root?.FMRGigContract;

    if (!clearContract) {
        throw new Error("Free Map Router route work clear contract failed to load.");
    }
    if (!routeHistoryContract) {
        throw new Error("Free Map Router route history failed to load.");
    }
    if (!gigContract) {
        throw new Error("Free Map Router gig contract failed to load.");
    }

    const {
        clearInspectorAdeRouteWork,
        clearManualGigRouteWork,
    } = clearContract;
    const { writeRouteHistory } = routeHistoryContract;
    const { readGigs, writeGigs } = gigContract;

    const RETURN_PAGE_KEY = "fmr_route_work_clear_return_page";
    const STATUS_KEY = "fmr_route_work_clear_status";

    function currentStopIds() {
        return new Set(jobs.map((job) => job.id));
    }

    function refreshRouteUi(nextHistory) {
        routeHistory = writeRouteHistory(
            localStorage,
            nextHistory,
            currentStopIds(),
        );
        routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
        renderAll();
        if (els.workbookRouteOrderStatus) {
            els.workbookRouteOrderStatus.textContent = "";
        }
    }

    function clearInspectorAdeJobs() {
        const ok = confirm(
            "Clear InspectorADE jobs from both Google Route and Basic Route? " +
                "Manual gigs, saved addresses, pins, and the pending workbook route will be kept.",
        );
        if (!ok) return;

        const result = clearInspectorAdeRouteWork(
            routeHistory,
            currentStopIds(),
        );
        refreshRouteUi(result.history);

        if (els.routeStatus) {
            els.routeStatus.textContent = result.removedOrderIdCount
                ? `InspectorADE route work cleared from both saved routes. Removed ${result.removedOrderIdCount} workbook Order ID${result.removedOrderIdCount === 1 ? "" : "s"}; manual gigs were kept.`
                : "No InspectorADE workbook route work was attached to the saved routes.";
        }
    }

    function manualGigsWithRouteInclusionCleared() {
        const validIds = currentStopIds();
        const current = root.FMRManualGigs?.list?.() || readGigs(localStorage, validIds);
        const now = new Date().toISOString();
        let changedCount = 0;

        const next = current.map((gig) => {
            if (!gig.routeIncluded) return { ...gig };
            changedCount += 1;
            return {
                ...gig,
                routeIncluded: false,
                updatedAt: now,
            };
        });

        return { current, next, changedCount, validIds };
    }

    function clearManualGigWork() {
        const ok = confirm(
            "Clear manual gig work from both Google Route and Basic Route? " +
                "The gig records, pay, notes, work-order IDs, and saved addresses will be kept, but their Include in route setting will be turned off.",
        );
        if (!ok) return;

        const gigChange = manualGigsWithRouteInclusionCleared();
        const routeChange = clearManualGigRouteWork(
            routeHistory,
            gigChange.validIds,
        );
        const previousHistory = routeHistory;

        try {
            writeGigs(localStorage, gigChange.next, gigChange.validIds);
            refreshRouteUi(routeChange.history);
        } catch (error) {
            try {
                writeGigs(localStorage, gigChange.current, gigChange.validIds);
                routeHistory = writeRouteHistory(
                    localStorage,
                    previousHistory,
                    gigChange.validIds,
                );
                routeIds = routeHistory[activeRouteSlot]?.routeIds.slice() || [];
                renderAll();
            } catch {
                // Preserve the original error. Existing backup remains the recovery path.
            }
            alert(error?.message || "Manual gig route work could not be cleared.");
            return;
        }

        const clearedCount = gigChange.changedCount;
        const message = clearedCount
            ? `Manual gig route work cleared from both saved routes. ${clearedCount} gig${clearedCount === 1 ? "" : "s"} kept and marked Not included in route.`
            : "No manual gigs were marked Include in route. Route gig metadata was cleared.";

        // manual-gigs.js owns its in-memory list. Reload once so that its list and
        // edit form are rebuilt from the just-saved durable gig records.
        sessionStorage.setItem(RETURN_PAGE_KEY, "route");
        sessionStorage.setItem(STATUS_KEY, message);
        window.location.reload();
    }

    function initialize() {
        document
            .getElementById("clearInspectorAdeJobs")
            ?.addEventListener("click", clearInspectorAdeJobs);
        document
            .getElementById("clearManualGigWork")
            ?.addEventListener("click", clearManualGigWork);

        const returnPage = sessionStorage.getItem(RETURN_PAGE_KEY);
        const status = sessionStorage.getItem(STATUS_KEY);
        sessionStorage.removeItem(RETURN_PAGE_KEY);
        sessionStorage.removeItem(STATUS_KEY);

        if (returnPage === "route" && typeof showPage === "function") {
            showPage("route");
        }
        if (status && els?.routeStatus) {
            els.routeStatus.textContent = status;
        }
    }

    document.addEventListener("DOMContentLoaded", initialize, { once: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
