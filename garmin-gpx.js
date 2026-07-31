(function attachFreeMapRouterGarminGpx(root, factory) {
    const garminGpx = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = garminGpx;
    }

    if (root) {
        root.FMRGarminGpx = garminGpx;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGarminGpx() {
    "use strict";

    function escapeXml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function routeSource(point) {
        const searchable = [point?.label, point?.notes]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();

        if (/\bDCFS\b/.test(searchable)) return "DCFS";
        if (/\bGIS\b/.test(searchable)) return "GIS";
        return "";
    }

    function routePointName(point, index, total) {
        if (index === 0) return "Start - Home";
        if (index === total - 1) return "Finish - Home";

        const stopNumber = String(index).padStart(2, "0");
        const source = routeSource(point);
        const address = String(point?.address || "").trim();
        const parts = [stopNumber, source, address].filter(Boolean);
        return parts.join(" - ") || `Stop ${stopNumber}`;
    }

    function resolvedCoordinates(point) {
        const latitude = Number(point?.latitude);
        const longitude = Number(point?.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
        }

        return { latitude, longitude };
    }

    function findUnresolvedPoints(points) {
        const routePoints = Array.isArray(points) ? points : [];

        return routePoints
            .map((point, index) => {
                if (resolvedCoordinates(point)) return null;

                return {
                    index,
                    address: String(point?.address || `Stop ${index}`).trim(),
                };
            })
            .filter(Boolean);
    }

    function buildGarminRouteGpx(routeName, points) {
        const routePoints = Array.isArray(points) ? points : [];
        if (routePoints.length < 3) {
            throw new Error(
                "A Garmin route needs Home, at least one stop, and Home again.",
            );
        }

        const unresolved = findUnresolvedPoints(routePoints);
        if (unresolved.length > 0) {
            const error = new Error(
                "Some route addresses still need a confirmed map location.",
            );
            error.code = "UNRESOLVED_ROUTE_POINTS";
            error.unresolved = unresolved;
            throw error;
        }

        const safeRouteName = escapeXml(
            String(routeName || "Free Map Router Route").trim(),
        );
        const total = routePoints.length;
        const rtepts = routePoints
            .map((point, index) => {
                const { latitude, longitude } = resolvedCoordinates(point);
                const name = escapeXml(routePointName(point, index, total));
                const address = escapeXml(String(point?.address || "").trim());
                const notes = escapeXml(String(point?.notes || "").trim());
                const description = [address, notes].filter(Boolean).join(" | ");

                return [
                    `    <rtept lat="${latitude}" lon="${longitude}">`,
                    `      <name>${name}</name>`,
                    description ? `      <desc>${description}</desc>` : "",
                    "    </rtept>",
                ]
                    .filter(Boolean)
                    .join("\n");
            })
            .join("\n");

        return [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<gpx version="1.1" creator="Free Map Router"',
            '  xmlns="http://www.topografix.com/GPX/1/1"',
            '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
            '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
            "  <metadata>",
            `    <name>${safeRouteName}</name>`,
            "  </metadata>",
            "  <rte>",
            `    <name>${safeRouteName}</name>`,
            rtepts,
            "  </rte>",
            "</gpx>",
            "",
        ].join("\n");
    }

    function garminFilename(routeName) {
        const base = String(routeName || "free-map-router-route")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return `${base || "free-map-router-route"}.gpx`;
    }

    return Object.freeze({
        buildGarminRouteGpx,
        escapeXml,
        findUnresolvedPoints,
        garminFilename,
        routePointName,
        routeSource,
    });
});
