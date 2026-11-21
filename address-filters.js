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
        ",\\s*([^,]+?)\\s*,?\\s+(" + STATES + ")" +
            "(?:\\s+\\d{5}(?:-\\d{4})?)?(?:\\s*,\\s*(?:USA|US))?\\s*$",
        "i",
    );

    // Verified single-county Oklahoma towns. A location is shown only if it
    // actually occurs in the operator's saved addresses, never as a statewide
    // dropdown. Do not infer counties for multi-county towns or other states.
    // Source: U.S. District Court Oklahoma city/county jurisdiction directory.
    // https://oknd.uscourts.gov/ok-city-jurisdictions
    const OK_CITIES_BY_COUNTY = {
        Beckham: "Carter|Delhi|Elk City|Erick|Mayfield|Sayre|Texola",
        Blaine: "Canton|Greenfield|Hitchcock|Homestead|Longdale|Okeene|Southard|Watonga",
        Caddo: "Anadarko|Apache|Binger|Carnegie|Cement|Cyril|Eakly|Fort Cobb|Gracemont|Hinton|Hydro|Lookeba",
        Canadian: "Calumet|El Reno|Mustang|Union City|Yukon",
        Comanche: "Cache|Chattanooga|Elgin|Faxon|Fletcher|Fort Sill|Geronimo|Indiahoma|Lawton|Medicine Park|Meers",
        Cotton: "Devol|Randlett|Temple|Walters",
        Custer: "Arapaho|Butler|Clinton|Custer City|Moorewood|Thomas|Weatherford",
        Dewey: "Camargo|Fay|Leedey|Oakwood|Putnam|Taloga|Vici",
        Ellis: "Arnett|Fargo|Gage",
        Garfield: "Covington|Enid|Garber|Hillsdale",
        Grady: "Chickasha|Minco|Ninnekah|Rush Springs|Tuttle|Verden",
        Greer: "Granite|Mangum|Willow",
        Harmon: "Hollis|Vinson",
        Jackson: "Altus|Blair|Duke|Eldorado|Elmer|Headrick|Martha|Olustee",
        Jefferson: "Ryan|Waurika",
        Kingfisher: "Dover|Hennessey|Kingfisher|Loyal",
        Kiowa: "Cooperton|Gotebo|Hobart|Lone Wolf|Mountain Park|Mountain View|Snyder",
        Logan: "Guthrie|Langston|Marshall",
        Major: "Fairview|Meno",
        RogerMills: "Crawford|Durham|Grimes|Hammon|Reydon|Strong City|Sweetwater",
        Stephens: "Comanche|Duncan|Loco|Marlow",
        Tillman: "Davidson|Frederick|Grandfield|Hollister|Loveland|Manitou|Tipton",
        Washita: "Bessie|Burns Flat|Canute|Cloud Chief|Colony|Cordell|Corn|Dill City|Foss|Rocky",
        Woods: "Dacoma|Freedom|Waynoka",
        Woodward: "Fort Supply|Mooreland|Mutual|Woodward",
    };
    const OKLAHOMA_COUNTIES_BY_CITY = new Map();
    for (const [countyKey, cities] of Object.entries(OK_CITIES_BY_COUNTY)) {
        const county = countyKey === "RogerMills" ? "Roger Mills" : countyKey;
        for (const city of cities.split("|")) {
            const key = city.toLocaleLowerCase("en-US");
            if (OKLAHOMA_COUNTIES_BY_CITY.has(key)) {
                // No county guess for cities listed in more than one county.
                OKLAHOMA_COUNTIES_BY_CITY.set(key, null);
            } else {
                OKLAHOMA_COUNTIES_BY_CITY.set(key, county);
            }
        }
    }

    function clean(value) {
        return String(value ?? "").trim().replace(/\s+/g, " ");
    }

    function townForStop(stop) {
        const address = clean(stop?.address);
        const match = CITY_SUFFIX.exec(address);
        return match ? clean(match[1]) : UNKNOWN_TOWN;
    }

    function countyForStop(stop) {
        const explicit = clean(stop?.county);
        if (explicit) return explicit;
        const match = CITY_SUFFIX.exec(clean(stop?.address));
        if (!match || !/^(OK|OKLAHOMA)$/i.test(match[2])) return UNKNOWN_COUNTY;
        return OKLAHOMA_COUNTIES_BY_CITY.get(
            clean(match[1]).toLocaleLowerCase("en-US"),
        ) || UNKNOWN_COUNTY;
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
