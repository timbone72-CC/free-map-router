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

    function nearestNeighborOrder(home, stops) {
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

    function roundTripMiles(home, stops) {
        if (!home || !Array.isArray(stops) || stops.length === 0) return 0;

        let total = distanceMiles(home, stops[0]);
        for (let index = 1; index < stops.length; index++) {
            total += distanceMiles(stops[index - 1], stops[index]);
        }
        total += distanceMiles(stops[stops.length - 1], home);
        return total;
    }

    function improveWithTwoOpt(home, stops) {
        let best = Array.isArray(stops) ? stops.slice() : [];
        let bestMiles = roundTripMiles(home, best);
        let improved = true;

        while (improved) {
            improved = false;

            for (let start = 0; start < best.length - 1; start++) {
                for (let end = start + 1; end < best.length; end++) {
                    const candidate = [
                        ...best.slice(0, start),
                        ...best.slice(start, end + 1).reverse(),
                        ...best.slice(end + 1),
                    ];
                    const candidateMiles = roundTripMiles(home, candidate);

                    if (candidateMiles + 0.000001 < bestMiles) {
                        best = candidate;
                        bestMiles = candidateMiles;
                        improved = true;
                    }
                }
            }
        }

        return best;
    }

    function optimizeRoundTripOrder(home, stops) {
        return improveWithTwoOpt(home, nearestNeighborOrder(home, stops));
    }

    return {
        distanceMiles,
        roundTripMiles,
        improveWithTwoOpt,
        optimizeRoundTripOrder,
    };
});
