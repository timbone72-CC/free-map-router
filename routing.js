(function attachFreeRouting(root, factory) {
    const routing = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = routing;
    }

    if (root) {
        root.FMRRouting = routing;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouting() {
    "use strict";

    function toRad(degrees) {
        return (degrees * Math.PI) / 180;
    }

    function distanceMiles(from, to) {
        const radiusMiles = 3958.8;
        const lat1 = Number(from.latitude);
        const lon1 = Number(from.longitude);
        const lat2 = Number(to.latitude);
        const lon2 = Number(to.longitude);
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
        return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function optimizeRoundTripOrder(home, stops) {
        const remaining = Array.isArray(stops) ? stops.slice() : [];
        const ordered = [];
        let current = home;

        while (remaining.length) {
            let closestIndex = 0;
            let closestDistance = Infinity;

            for (let index = 0; index < remaining.length; index++) {
                const distance = distanceMiles(current, remaining[index]);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = index;
                }
            }

            current = remaining.splice(closestIndex, 1)[0];
            ordered.push(current);
        }

        return ordered;
    }

    return {
        distanceMiles,
        optimizeRoundTripOrder,
    };
});
