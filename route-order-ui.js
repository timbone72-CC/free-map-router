(function attachFreeMapRouterRouteOrderUI(root, factory) {
    const routeOrderUI = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = routeOrderUI;
    }

    if (root) {
        root.FMRRouteOrderUI = routeOrderUI;
        routeOrderUI.attachBrowser(root);
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteOrderUI() {
    "use strict";

    function plural(count, singular, pluralValue = `${singular}s`) {
        return Number(count) === 1 ? singular : pluralValue;
    }

    function createRouteOrderSendController({
        contractApi,
        routeHistoryApi,
        routeOrderApi,
        driveApi,
        storage,
        documentRef,
        now = () => new Date(),
    }) {
        if (typeof contractApi?.readStops !== "function") {
            throw new Error("Free Map Router saved stops are unavailable.");
        }
        if (typeof routeHistoryApi?.readRouteHistory !== "function") {
            throw new Error("Free Map Router Route History is unavailable.");
        }
        if (
            typeof routeOrderApi?.buildActiveDayWorkbookRouteOrder !== "function" ||
            typeof routeOrderApi?.workbookOrderIdCount !== "function" ||
            typeof routeOrderApi?.manualGigIdCount !== "function"
        ) {
            throw new Error("Free Map Router active-Day route return is unavailable.");
        }
        if (
            typeof driveApi?.requestDriveToken !== "function" ||
            typeof driveApi?.saveRouteOrderToDrive !== "function"
        ) {
            throw new Error("Free Map Router Google Drive route return is unavailable.");
        }
        if (!storage || !documentRef) {
            throw new Error("Free Map Router active-Day route return cannot access this app.");
        }

        const sendButton = documentRef.getElementById("sendRouteOrder");
        const status = documentRef.getElementById("workbookRouteOrderStatus");
        const routeChoice = documentRef.getElementById("routeChoice");
        let sendPromise = null;

        function setStatus(message) {
            if (status) status.textContent = String(message || "");
        }

        function savedStops() {
            const result = contractApi.readStops(storage);
            return Array.isArray(result?.stops) ? result.stops : [];
        }

        function displayedRouteStops(currentStops) {
            const byId = new Map(
                currentStops.map((stop) => [String(stop?.id || "").trim(), stop]),
            );
            return Array.from(
                documentRef.querySelectorAll("#routeList > li[data-stop-id]"),
            ).map((node) => {
                const stopId = String(node?.dataset?.stopId || "").trim();
                const saved = byId.get(stopId);
                return saved
                    ? { id: stopId, address: String(saved.address || "").trim() }
                    : { id: stopId, address: "" };
            });
        }

        function prepareRouteOrder() {
            const currentStops = savedStops();
            const validIds = new Set(
                currentStops
                    .map((stop) => String(stop?.id || "").trim())
                    .filter(Boolean),
            );
            const routeHistory = routeHistoryApi.readRouteHistory(
                storage,
                validIds,
            );
            const routeSlot = routeChoice?.value === "basic" ? "basic" : "google";
            return routeOrderApi.buildActiveDayWorkbookRouteOrder({
                routeSlot,
                routeHistory,
                routeStops: displayedRouteStops(currentStops),
                now: now(),
            });
        }

        function successMessage(routeOrder) {
            const inspectorAdeCount = routeOrderApi.workbookOrderIdCount(routeOrder);
            const gigCount = routeOrderApi.manualGigIdCount(routeOrder);
            const totalWorkItems = inspectorAdeCount + gigCount;
            const routeName =
                routeOrder.routeSlot === "basic" ? "Basic Route" : "Google Route";
            const dayNumber = routeOrder.routePlan?.dayNumber;
            const dayCount = routeOrder.routePlan?.dayCount;
            return (
                `${routeName} Day ${dayNumber} of ${dayCount} sent: ` +
                `${inspectorAdeCount} ${plural(inspectorAdeCount, "InspectorADE job")}, ` +
                `${gigCount} ${plural(gigCount, "manual gig")}, ` +
                `${totalWorkItems} total ${plural(totalWorkItems, "work item")}.`
            );
        }

        async function send() {
            if (sendPromise) return sendPromise;

            let routeOrder;
            try {
                routeOrder = prepareRouteOrder();
            } catch (error) {
                setStatus(error?.message || "The active Day route could not be prepared.");
                return null;
            }

            const routeName =
                routeOrder.routeSlot === "basic" ? "Basic Route" : "Google Route";
            setStatus(
                `Sending ${routeName} Day ${routeOrder.routePlan.dayNumber} of ${routeOrder.routePlan.dayCount} to the workbook…`,
            );
            if (sendButton) sendButton.disabled = true;

            sendPromise = (async () => {
                const token = await driveApi.requestDriveToken();
                await driveApi.saveRouteOrderToDrive(token, routeOrder);
                return routeOrder;
            })();

            try {
                await sendPromise;
                setStatus(successMessage(routeOrder));
                return routeOrder;
            } catch (error) {
                setStatus(error?.message || "The active Day route could not be sent.");
                return null;
            } finally {
                sendPromise = null;
                if (sendButton) {
                    sendButton.disabled = displayedRouteStops(savedStops()).length === 0;
                }
            }
        }

        function attach() {
            if (!sendButton || sendButton.dataset.fmrActiveDaySendBound === "true") {
                return false;
            }
            sendButton.dataset.fmrActiveDaySendBound = "true";
            sendButton.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    void send();
                },
                true,
            );
            return true;
        }

        function whenIdle() {
            return sendPromise || Promise.resolve();
        }

        return Object.freeze({
            attach,
            prepareRouteOrder,
            send,
            successMessage,
            whenIdle,
        });
    }

    function attachBrowser(root) {
        if (!root?.document || !root?.localStorage) return null;
        const controller = createRouteOrderSendController({
            contractApi: root.FMRContract,
            routeHistoryApi: root.FMRRouteHistory,
            routeOrderApi: root.FMRRouteOrder,
            driveApi: root.FMRGoogleDrive,
            storage: root.localStorage,
            documentRef: root.document,
        });
        controller.attach();
        return controller;
    }

    return Object.freeze({
        attachBrowser,
        createRouteOrderSendController,
    });
});
