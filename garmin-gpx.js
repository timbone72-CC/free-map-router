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
        return (value ?? "")
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function routePointName(point, index, total) {
        if (index === 0) return "Start - Home";
        if (index === total - 1) return "Finish - Home";

        const label = (point?.label || "").toString().trim();
        const address = (point?.address || "").toString().trim();
        return label ? `${label} - ${address}` : address || `Stop ${index}`;
    }

    function validatePoint(point, index) {
        const latitude = Number(point?.latitude);
        const longitude = Number(point?.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            const address = (point?.address || `Stop ${index}`).toString().trim();
            throw new Error(`Missing verified coordinates for: ${address}`);
        }

        return { latitude, longitude };
    }

    function buildGarminRouteGpx(routeName, points) {
        const routePoints = Array.isArray(points) ? points : [];
        if (routePoints.length < 3) {
            throw new Error("A Garmin route needs Home, at least one stop, and Home again.");
        }

        const safeRouteName = escapeXml(
            (routeName || "Free Map Router Route").toString().trim(),
        );
        const total = routePoints.length;
        const rtepts = routePoints
            .map((point, index) => {
                const { latitude, longitude } = validatePoint(point, index);
                const name = escapeXml(routePointName(point, index, total));
                const address = escapeXml((point?.address || "").toString().trim());

                return [
                    `    <rtept lat="${latitude}" lon="${longitude}">`,
                    `      <name>${name}</name>`,
                    address ? `      <desc>${address}</desc>` : "",
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
        const base = (routeName || "free-map-router-route")
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        return `${base || "free-map-router-route"}.gpx`;
    }

    return Object.freeze({
        buildGarminRouteGpx,
        escapeXml,
        garminFilename,
    });
});
