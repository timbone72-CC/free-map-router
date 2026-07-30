(function attachFreeMapRouterBackup(root, factory) {
    const backup = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = backup;
    }

    if (root) {
        root.FMRBackup = backup;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBackup() {
    "use strict";

    const BACKUP_VERSION = 1;

    function createBackup({ home, stops, routeIds }) {
        return {
            app: "free-map-router",
            backupVersion: BACKUP_VERSION,
            createdAt: new Date().toISOString(),
            home: home || null,
            stops: Array.isArray(stops) ? stops : [],
            routeIds: Array.isArray(routeIds) ? routeIds : [],
        };
    }

    function parseBackup(text) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error("That file is not a valid Free Map Router backup.");
        }

        if (
            parsed?.app !== "free-map-router" ||
            parsed?.backupVersion !== BACKUP_VERSION ||
            !Array.isArray(parsed?.stops) ||
            !Array.isArray(parsed?.routeIds)
        ) {
            throw new Error("That file is not a valid Free Map Router backup.");
        }

        return {
            home: parsed.home || null,
            stops: parsed.stops,
            routeIds: parsed.routeIds.filter(
                (id) => typeof id === "string" && id.trim(),
            ),
        };
    }

    function backupFilename(date = new Date()) {
        return `free-map-router-backup-${date.toISOString().slice(0, 10)}.json`;
    }

    return {
        BACKUP_VERSION,
        backupFilename,
        createBackup,
        parseBackup,
    };
});
