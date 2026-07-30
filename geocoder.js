(function attachFreeGeocoder(root, factory) {
    const geocoder = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = geocoder;
    }

    if (root) {
        root.FMRGeocoder = geocoder;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGeocoder() {
    "use strict";

    const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/search";
    const CACHE_KEY = "fmr_geocode_cache_v1";
    const MIN_REQUEST_INTERVAL_MS = 1000;
    let lastRequestAt = 0;

    function addressKey(address) {
        return (address ?? "")
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }

    function readCache(storage) {
        try {
            return JSON.parse(storage?.getItem(CACHE_KEY) || "{}") || {};
        } catch {
            return {};
        }
    }

    function writeCache(storage, cache) {
        storage?.setItem(CACHE_KEY, JSON.stringify(cache));
    }

    function wait(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    async function findAddress(address, options = {}) {
        const key = addressKey(address);
        if (!key) throw new Error("Enter an address first.");

        const storage = options.storage;
        const cache = readCache(storage);
        if (cache[key]) {
            return { ...cache[key], cached: true };
        }

        const fetchFn = options.fetchFn || globalThis.fetch;
        if (typeof fetchFn !== "function") {
            throw new Error("Address lookup is unavailable in this browser.");
        }

        const now = Date.now();
        const remainingWait =
            MIN_REQUEST_INTERVAL_MS - (now - lastRequestAt);
        if (remainingWait > 0) {
            await (options.waitFn || wait)(remainingWait);
        }
        lastRequestAt = Date.now();

        const endpoint = options.endpoint || DEFAULT_ENDPOINT;
        const url = new URL(endpoint);
        url.searchParams.set("q", address.trim());
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", "us");

        const response = await fetchFn(url.toString(), {
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error("The free address service is unavailable.");
        }

        const results = await response.json();
        const first = Array.isArray(results) ? results[0] : null;
        const latitude = Number(first?.lat);
        const longitude = Number(first?.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new Error("No location was found for that address.");
        }

        const result = {
            latitude,
            longitude,
            displayName: (first.display_name || address).toString(),
        };
        cache[key] = result;
        writeCache(storage, cache);
        return { ...result, cached: false };
    }

    function mapUrl(latitude, longitude) {
        return (
            "https://www.openstreetmap.org/" +
            `?mlat=${encodeURIComponent(latitude)}` +
            `&mlon=${encodeURIComponent(longitude)}` +
            `#map=19/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`
        );
    }

    return {
        CACHE_KEY,
        MIN_REQUEST_INTERVAL_MS,
        findAddress,
        mapUrl,
    };
});
