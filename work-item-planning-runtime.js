(function attachWorkItemPlanningRuntime(root) {
    "use strict";

    const planningContract = root?.FMRWorkItemPlanning;
    const backupContract = root?.FMRBackup;

    if (!planningContract) {
        throw new Error("Free Map Router work-item planning failed to load.");
    }
    if (!backupContract) {
        throw new Error("Free Map Router backup contract failed to load.");
    }

    const { readPlanningRecords, writePlanningRecords } = planningContract;
    let planningRecords = [];

    function persistPlanningRecords(records) {
        planningRecords = writePlanningRecords(localStorage, records);
        return planningRecords;
    }

    function installBackupRestoreHook() {
        if (typeof restoreRoutes !== "function") return;
        const originalRestoreRoutes = restoreRoutes;
        restoreRoutes = function workItemPlanningAwareRestoreRoutes(routes) {
            const result = originalRestoreRoutes(routes);
            const restoredPlanning = backupContract.takeParsedPlanningForRestore();
            if (Array.isArray(restoredPlanning)) {
                persistPlanningRecords(restoredPlanning);
            }
            return result;
        };
    }

    function initialize() {
        planningRecords = readPlanningRecords(localStorage);
        persistPlanningRecords(planningRecords);
        installBackupRestoreHook();
    }

    root.FMRWorkItemPlanningRuntime = Object.freeze({
        list() {
            return planningRecords.map((record) => ({ ...record }));
        },
        replace(records) {
            return persistPlanningRecords(records).map((record) => ({ ...record }));
        },
        projectRoute(routeSnapshot, options = {}) {
            const routePlanningContract = root?.FMRRouteWorkPlanning;
            if (!routePlanningContract) {
                throw new Error(
                    "Free Map Router route work planning is not loaded yet.",
                );
            }
            return routePlanningContract.buildRoutePlanningProjection(
                routeSnapshot,
                planningRecords,
                options,
            );
        },
    });

    document.addEventListener("DOMContentLoaded", initialize, { once: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
