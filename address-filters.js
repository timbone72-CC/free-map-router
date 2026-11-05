(function attachFreeMapRouterAddressFilters(root, factory) {
    const filters = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = filters;
    }
    if (root) root.FMRAddressFilters = filters;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFilters() {
    "use strict";

    const UNKNOWN_TOWN = "Unknown town";
    const UNKNOWN_COUNTY = "Unknown county";
    const UNASSIGNED = "Unassigned";
    const STATES = "(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|OKLAHOMA|TEXAS)";
    // Only a clearly comma-delimited town and state may be inferred.
    const CITY_SUFFIX = new RegExp(
        ",\\s*([^,]+?)\\s*,?\\s+" + STATES +
            "(?:\\s+\\d{5}(?:-\\d{4})?)?(?:\\s*,\\s*(?:USA|US))?\\s*$",
        "i",
    );

    function clean(value) {
        return String(value ?? "").trim().replace(/\s+/g, " ");
    }

    function townForStop(stop) {
        const address = clean(stop?.address);
        const match = CITY_SUFFIX.exec(address);
        return match ? clean(match[1]) : UNKNOWN_TOWN;
    }

    function countyForStop(stop) {
        // The current saved-stop schema does not contain a county field.
        // Use explicit metadata only if a future caller supplies it.
        return clean(stop?.county) || UNKNOWN_COUNTY;
    }

    function describeStops(stops, gigs = []) {
        const gigSourcesByStop = new Map();
        for (const gig of Array.isArray(gigs) ? gigs : []) {
            const stopId = clean(gig?.stopId);
            if (!stopId) continue;
            const source = clean(gig?.source) || "OTHER";
            if (!gigSourcesByStop.has(stopId)) gigSourcesByStop.set(stopId, new Set());
            gigSourcesByStop.get(stopId).add(source.toUpperCase());
        }
        return (Array.isArray(stops) ? stops : []).map((stop) => {
            const dedicatedSource = clean(stop?.source).toUpperCase();
            const gigSources = [...(gigSourcesByStop.get(clean(stop?.id)) || [])]
                .sort((a, b) => a.localeCompare(b));
            const sources = [];
            if (dedicatedSource === "GIS" || dedicatedSource === "DCFS") {
                sources.push(dedicatedSource);
            }
            for (const source of gigSources) {
                if (!sources.includes(source)) sources.push(source);
            }
            if (!sources.length) sources.push(UNASSIGNED);
            return {
                stop,
                sources,
                hasGig: gigSources.length > 0,
                town: townForStop(stop),
                county: countyForStop(stop),
            };
        });
    }

    function availableFilters(rows) {
        const all = Array.isArray(rows) ? rows : [];
        const sources = new Set();
        const towns = new Set();
        const counties = new Set();
        for (const row of all) {
            row.sources.forEach((source) => sources.add(source));
            if (row.hasGig) sources.add("Gigs");
            towns.add(row.town);
            counties.add(row.county);
        }
        const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
        return {
            sources: ["All", ...sorted(sources)],
            towns: sorted(towns),
            counties: sorted(counties),
        };
    }

    function filterRows(rows, { query = "", source = "All", town = "All", county = "All" } = {}) {
        const needle = clean(query).toLocaleLowerCase();
        const selectedSource = clean(source) || "All";
        return (Array.isArray(rows) ? rows : []).filter((row) => {
            if (
                selectedSource !== "All" &&
                !(selectedSource === "Gigs" ? row.hasGig : row.sources.includes(selectedSource))
            ) return false;
            if (town !== "All" && row.town !== town) return false;
            if (county !== "All" && row.county !== county) return false;
            if (!needle) return true;
            return [
                row.stop?.address, row.stop?.label, row.stop?.notes,
                row.town, row.county, ...row.sources,
            ].some((value) => clean(value).toLocaleLowerCase().includes(needle));
        });
    }

    return { describeStops, availableFilters, filterRows, townForStop, countyForStop };
});
