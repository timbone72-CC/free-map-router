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

    return {
        GEOAPIFY_KEY,
        maskedKey,
        readGeoapifyKey,
        writeGeoapifyKey,
    };
});
