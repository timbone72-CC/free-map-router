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
    const AVOID_TOLLS_KEY = "fmr_avoid_tolls";

    function readAvoidTolls(storage) {
        return storage?.getItem?.(AVOID_TOLLS_KEY) !== "false";
    }

    function writeAvoidTolls(storage, value) {
        if (typeof value !== "boolean") {
            throw new TypeError("Avoid tolls must be ON or OFF.");
        }
        storage.setItem(AVOID_TOLLS_KEY, String(value));
        return value;
    }

    function bindAvoidTollsControl({ document, storage, onChange = () => {} }) {
        const toggle = document?.getElementById("routeAvoidTolls");
        const state = document?.getElementById("routeAvoidTollsState");
        if (!toggle || !state || !storage) return false;
        if (toggle.dataset.fmrAvoidTollsBound === "true") return true;
        toggle.dataset.fmrAvoidTollsBound = "true";
        function render() {
            toggle.checked = readAvoidTolls(storage);
            state.textContent = toggle.checked ? "ON" : "OFF";
        }
        render();
        toggle.addEventListener("change", () => {
            try {
                writeAvoidTolls(storage, toggle.checked === true);
            } catch {
                render();
                const feedback = document.getElementById("routeOptimizeFeedback");
                if (feedback) {
                    feedback.textContent = "The toll choice could not be saved. Try again.";
                }
                return;
            }
            render();
            onChange(toggle.checked);
        });
        return true;
    }

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
        AVOID_TOLLS_KEY,
        bindAvoidTollsControl,
        readAvoidTolls,
        writeAvoidTolls,
        GEOAPIFY_KEY,
        isFreeMapRouterCache,
        maskedKey,
        readGeoapifyKey,
        updateApp,
        writeGeoapifyKey,
    };
});
