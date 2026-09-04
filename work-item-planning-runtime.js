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

    const {
        applyPlanningEdit,
        createPlanningRecord,
        findPlanningRecord,
        normalizeCalendarDate,
        normalizeServiceMinutes,
        readPlanningRecords,
        writePlanningRecords,
    } = planningContract;
    let planningRecords = [];

    function copyRecord(record) {
        return record ? { ...record } : null;
    }

    function refreshPlanningRecords() {
        planningRecords = readPlanningRecords(localStorage);
        return planningRecords;
    }

    function persistPlanningRecords(records) {
        planningRecords = writePlanningRecords(localStorage, records);
        return planningRecords;
    }

    function normalizeExpectedRevision(value) {
        const revision = Number(value);
        if (!Number.isInteger(revision) || revision < 0) {
            throw new Error(
                "Expected planning revision must be zero for create or the current saved revision for edit.",
            );
        }
        return revision;
    }

    function planningPatch(draft) {
        if (!draft || typeof draft !== "object") {
            throw new Error(
                "Planning update must include service minutes, assigned date, or locked day.",
            );
        }

        const patch = {};
        if (Object.hasOwn(draft, "serviceMinutes")) {
            patch.serviceMinutes = normalizeServiceMinutes(draft.serviceMinutes);
        }
        if (Object.hasOwn(draft, "assignedDate")) {
            patch.assignedDate = normalizeCalendarDate(draft.assignedDate);
        }
        if (Object.hasOwn(draft, "lockedDay")) {
            if (typeof draft.lockedDay !== "boolean") {
                throw new Error("Locked day must be true or false.");
            }
            patch.lockedDay = draft.lockedDay;
        }

        if (Object.keys(patch).length === 0) {
            throw new Error(
                "Planning update must include service minutes, assigned date, or locked day.",
            );
        }
        return patch;
    }

    function samePlanningPatch(existing, patch) {
        return Object.entries(patch).every(
            ([field, value]) => existing?.[field] === value,
        );
    }

    function stalePlanningError() {
        return new Error(
            "The planning record changed since it was loaded. Reload before editing it.",
        );
    }

    function effectivePlanningValue(existing, patch, field, fallback) {
        return Object.hasOwn(patch, field)
            ? patch[field]
            : existing?.[field] ?? fallback;
    }

    function validatePlanningState(existing, patch) {
        const assignedDate = effectivePlanningValue(
            existing,
            patch,
            "assignedDate",
            null,
        );
        const lockedDay = effectivePlanningValue(
            existing,
            patch,
            "lockedDay",
            false,
        );
        if (lockedDay && !assignedDate) {
            throw new Error(
                "Choose an assigned day before locking this work item to a day.",
            );
        }

        if (!existing) {
            const serviceMinutes = effectivePlanningValue(
                null,
                patch,
                "serviceMinutes",
                null,
            );
            if (serviceMinutes === null && assignedDate === null && !lockedDay) {
                throw new Error("There are no planning values to save for this work item.");
            }
        }
    }

    function saveWorkItem(kind, workItemId, draft, options = {}) {
        const patch = planningPatch(draft);
        const expectedRevision = normalizeExpectedRevision(
            options.expectedRevision,
        );

        // Re-read durable storage before every mutation so a stale in-memory tab
        // cannot overwrite a newer revision written elsewhere.
        refreshPlanningRecords();
        const existing = findPlanningRecord(planningRecords, kind, workItemId);

        if (!existing) {
            if (expectedRevision !== 0) throw stalePlanningError();
            validatePlanningState(null, patch);
            const created = createPlanningRecord(
                {
                    kind,
                    workItemId,
                    ...patch,
                },
                { now: options.now },
            );
            persistPlanningRecords([...planningRecords, created]);
            return copyRecord(
                findPlanningRecord(planningRecords, kind, workItemId),
            );
        }

        if (expectedRevision !== existing.revision) {
            throw stalePlanningError();
        }

        validatePlanningState(existing, patch);

        if (samePlanningPatch(existing, patch)) {
            return copyRecord(existing);
        }

        persistPlanningRecords(
            applyPlanningEdit(
                planningRecords,
                kind,
                workItemId,
                patch,
                {
                    expectedRevision,
                    now: options.now,
                },
            ),
        );
        return copyRecord(
            findPlanningRecord(planningRecords, kind, workItemId),
        );
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
        refreshPlanningRecords();
        persistPlanningRecords(planningRecords);
        installBackupRestoreHook();
    }

    root.FMRWorkItemPlanningRuntime = Object.freeze({
        list() {
            refreshPlanningRecords();
            return planningRecords.map((record) => ({ ...record }));
        },
        get(kind, workItemId) {
            refreshPlanningRecords();
            return copyRecord(
                findPlanningRecord(planningRecords, kind, workItemId),
            );
        },
        save(kind, workItemId, draft, options = {}) {
            return saveWorkItem(kind, workItemId, draft, options);
        },
        projectRoute(routeSnapshot, options = {}) {
            refreshPlanningRecords();
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
