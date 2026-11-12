(function attachFreeMapRouterSettings(root, factory) {
    const settings = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = settings;
    }

    if (root) {
        root.FMRSettings = settings;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSettings() {
    "use strict";

    const GEOAPIFY_KEY = "fmr_geoapify_api_key";

    function readGeoapifyKey(storage) {
        return (storage?.getItem(GEOAPIFY_KEY) || "").trim();
    }

    function writeGeoapifyKey(storage, value) {
        const key = (value || "").trim();
        if (!key) {
            storage?.removeItem(GEOAPIFY_KEY);
            return "";
        }
        storage?.setItem(GEOAPIFY_KEY, key);
        return key;
    }

    function maskedKey(value) {
        const key = (value || "").trim();
        if (!key) return "No key saved.";
        const ending = key.slice(-4);
        return `Key saved in this browser ••••${ending}`;
    }

    function isFreeMapRouterCache(name) {
        const normalized = String(name || "").toLowerCase();
        return (
            normalized.startsWith("free-map-router") ||
            normalized.startsWith("fmr-")
        );
    }

    async function updateApp(options = {}) {
        const {
            online = true,
            serviceWorker,
            cacheStorage,
            location,
            now = Date.now,
        } = options;

        if (!online) {
            return { updated: false, reason: "offline" };
        }

        if (!location?.href || typeof location.replace !== "function") {
            throw new Error("App location is unavailable.");
        }

        const appBaseUrl = new URL("./", location.href).href;

        try {
            const registrations =
                (await serviceWorker?.getRegistrations?.()) || [];
            await Promise.allSettled(
                registrations
                    .filter((registration) =>
                        String(registration?.scope || "").startsWith(appBaseUrl),
                    )
                    .map((registration) => registration.unregister()),
            );

            const cacheNames = (await cacheStorage?.keys?.()) || [];
            await Promise.allSettled(
                cacheNames
                    .filter(isFreeMapRouterCache)
                    .map((name) => cacheStorage.delete(name)),
            );
        } finally {
            const updateUrl = new URL(location.href);
            updateUrl.searchParams.set("update", String(now()));
            location.replace(updateUrl.toString());
        }

        return { updated: true };
    }

    return {
        GEOAPIFY_KEY,
        isFreeMapRouterCache,
        maskedKey,
        readGeoapifyKey,
        updateApp,
        writeGeoapifyKey,
    };
});
