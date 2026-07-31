(function attachGarminExportUi() {
    "use strict";

    function routeName() {
        const now = new Date();
        const date = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
        ].join("-");
        return `Free Map Router ${date}`;
    }

    function orderedRouteStops() {
        const readResult = globalThis.FMRContract.readStops(localStorage);
        const savedStops = Array.isArray(readResult?.stops)
            ? readResult.stops
            : [];
        const savedById = new Map(
            savedStops.map((stop) => [String(stop?.id || ""), stop]),
        );
        const routeItems = Array.from(
            document.querySelectorAll("#routeList li[data-stop-id]"),
        );

        return routeItems
            .map((item) => savedById.get(String(item.dataset.stopId || "")))
            .filter(Boolean);
    }

    function downloadText(filename, text) {
        const blob = new Blob([text], {
            type: "application/gpx+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function unresolvedMessage(unresolved) {
        const addresses = unresolved
            .map((item) => `• ${item.address || `Stop ${item.index}`}`)
            .join("\n");
        return [
            "These route addresses still need a confirmed map location:",
            "",
            addresses,
            "",
            "Open Addresses, edit each one, use Find Location, confirm the pin, and save it.",
        ].join("\n");
    }

    function exportGarminGpx() {
        const home = globalThis.FMRContract.readHome(localStorage);
        if (!home) {
            alert("Save your Home / Route Base first.");
            return;
        }

        const stops = orderedRouteStops();
        if (stops.length === 0) {
            alert("No addresses are currently listed in the route.");
            return;
        }

        const name = routeName();
        const points = [home, ...stops, home];

        try {
            const gpx = globalThis.FMRGarminGpx.buildGarminRouteGpx(
                name,
                points,
            );
            downloadText(globalThis.FMRGarminGpx.garminFilename(name), gpx);
        } catch (error) {
            if (
                error?.code === "UNRESOLVED_ROUTE_POINTS" &&
                Array.isArray(error.unresolved)
            ) {
                alert(unresolvedMessage(error.unresolved));
                return;
            }
            alert(error?.message || "The Garmin GPX file could not be created.");
        }
    }

    const button = document.getElementById("downloadGarminGpx");
    if (!button) return;
    button.addEventListener("click", exportGarminGpx);
})();
