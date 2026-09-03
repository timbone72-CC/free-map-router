(function attachWorkItemPlanning(root, factory) {
    const planning = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = planning;
    }

    if (root) {
        root.FMRWorkItemPlanning = planning;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildWorkItemPlanning() {
    "use strict";

    const PLANNING_SCHEMA_VERSION = 1;
    const PLANNING_STORAGE_KEY = "fmr_work_item_planning_v1";
    const WORK_ITEM_KINDS = new Set(["workbook", "gig"]);
    const DEFAULT_WORKBOOK_SERVICE_MINUTES = 5;
    const DEFAULT_INTERIOR_SERVICE_MINUTES = 20;

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function normalizeWorkItemKind(value) {
        const kind = text(value).toLowerCase();
        if (!WORK_ITEM_KINDS.has(kind)) {
            throw new Error("Work item kind must be workbook or gig.");
        }
        return kind;
    }

    function normalizeWorkItemId(value) {
        const workItemId = text(value);
        if (!workItemId) {
            throw new Error("Work item ID is required.");
        }
        return workItemId;
    }

    function workItemKey(kind, workItemId) {
        return `${normalizeWorkItemKind(kind)}:${normalizeWorkItemId(workItemId)}`;
    }

    function normalizeServiceMinutes(value) {
        if (value === null || value === undefined || text(value) === "") {
            return null;
        }
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes <= 0) {
            throw new Error("Service minutes must be a positive number.");
        }
        return minutes;
    }

    function normalizeCalendarDate(value) {
        if (value === null || value === undefined || text(value) === "") {
            return null;
        }

        const raw = text(value);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        if (!match) {
            throw new Error("Assigned date must be a valid local calendar date.");
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) {
            throw new Error("Assigned date must be a valid local calendar date.");
        }
        return raw;
    }

    function normalizeRevision(value) {
        const revision = Number(value);
        if (!Number.isInteger(revision) || revision < 1) {
            throw new Error("Planning revision must be a positive whole number.");
        }
        return revision;
    }

    function normalizeTimestamp(value) {
        const raw = text(value);
        if (!raw) {
            throw new Error("Planning updatedAt timestamp is required.");
        }
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            throw new Error("Planning updatedAt timestamp is invalid.");
        }
        return date.toISOString();
    }

    function nowIso(value = new Date()) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new Error("Planning update time is invalid.");
        }
        return date.toISOString();
    }

    function normalizePlanningRecord(raw, options = {}) {
        if (!raw || typeof raw !== "object") return null;

        try {
            if (
                raw.schemaVersion !== undefined &&
                Number(raw.schemaVersion) !== PLANNING_SCHEMA_VERSION
            ) {
                throw new Error("Planning schema version is unsupported.");
            }

            return {
                schemaVersion: PLANNING_SCHEMA_VERSION,
                kind: normalizeWorkItemKind(raw.kind),
                workItemId: normalizeWorkItemId(raw.workItemId),
                serviceMinutes: normalizeServiceMinutes(raw.serviceMinutes),
                assignedDate: normalizeCalendarDate(raw.assignedDate),
                lockedDay: Boolean(raw.lockedDay),
                revision: normalizeRevision(raw.revision),
                updatedAt: normalizeTimestamp(raw.updatedAt),
            };
        } catch (error) {
            if (options.skipInvalid) return null;
            throw error;
        }
    }

    function samePlanningValue(left, right) {
        return (
            left.kind === right.kind &&
            left.workItemId === right.workItemId &&
            left.serviceMinutes === right.serviceMinutes &&
            left.assignedDate === right.assignedDate &&
            left.lockedDay === right.lockedDay
        );
    }

    function mergePlanningRecord(existingRaw, incomingRaw) {
        const existing = normalizePlanningRecord(existingRaw);
        const incoming = normalizePlanningRecord(incomingRaw);
        if (!existing || !incoming) {
            throw new Error("Both planning records are required.");
        }
        if (
            workItemKey(existing.kind, existing.workItemId) !==
            workItemKey(incoming.kind, incoming.workItemId)
        ) {
            throw new Error("Planning records must have the same work-item identity.");
        }

        if (incoming.revision > existing.revision) return incoming;
        if (incoming.revision < existing.revision) return existing;

        if (!samePlanningValue(existing, incoming)) {
            throw new Error(
                "Planning records conflict at the same revision and cannot be merged safely.",
            );
        }

        return incoming.updatedAt > existing.updatedAt ? incoming : existing;
    }

    function normalizePlanningList(records) {
        const byKey = new Map();
        const conflicted = new Set();

        for (const raw of Array.isArray(records) ? records : []) {
            const record = normalizePlanningRecord(raw, { skipInvalid: true });
            if (!record) continue;
            const key = workItemKey(record.kind, record.workItemId);
            if (conflicted.has(key)) continue;

            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, record);
                continue;
            }

            try {
                byKey.set(key, mergePlanningRecord(existing, record));
            } catch {
                byKey.delete(key);
                conflicted.add(key);
            }
        }

        return Array.from(byKey.values());
    }

    function safeParse(raw) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function readPlanningRecords(storage) {
        const raw = storage?.getItem?.(PLANNING_STORAGE_KEY);
        return normalizePlanningList(raw ? safeParse(raw) : []);
    }

    function writePlanningRecords(storage, records) {
        const normalized = normalizePlanningList(records);
        storage?.setItem?.(PLANNING_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function createPlanningRecord(draft, options = {}) {
        const record = normalizePlanningRecord({
            ...draft,
            schemaVersion: PLANNING_SCHEMA_VERSION,
            revision: 1,
            updatedAt: nowIso(options.now),
        });
        if (!record) {
            throw new Error("A planning record requires an exact work-item identity.");
        }
        return record;
    }

    function findPlanningRecord(records, kind, workItemId) {
        const key = workItemKey(kind, workItemId);
        return (
            normalizePlanningList(records).find(
                (record) => workItemKey(record.kind, record.workItemId) === key,
            ) || null
        );
    }

    function applyPlanningEdit(records, kind, workItemId, draft, options = {}) {
        const normalized = normalizePlanningList(records);
        const key = workItemKey(kind, workItemId);
        const index = normalized.findIndex(
            (record) => workItemKey(record.kind, record.workItemId) === key,
        );
        if (index < 0) {
            throw new Error("The planning record being edited is no longer saved.");
        }

        const existing = normalized[index];
        const expectedRevision = Number(options.expectedRevision);
        if (
            !Number.isInteger(expectedRevision) ||
            expectedRevision !== existing.revision
        ) {
            throw new Error(
                "The planning record changed since it was loaded. Reload before editing it.",
            );
        }

        const edited = normalizePlanningRecord({
            ...existing,
            ...draft,
            schemaVersion: PLANNING_SCHEMA_VERSION,
            kind: existing.kind,
            workItemId: existing.workItemId,
            revision: existing.revision + 1,
            updatedAt: nowIso(options.now),
        });
        normalized[index] = edited;
        return normalized;
    }

    function resolveWorkItemServiceMinutes(kind, workItemId, records, options = {}) {
        const normalizedKind = normalizeWorkItemKind(kind);
        const normalizedId = normalizeWorkItemId(workItemId);
        const record = findPlanningRecord(records, normalizedKind, normalizedId);
        if (record?.serviceMinutes !== null && record?.serviceMinutes !== undefined) {
            return record.serviceMinutes;
        }

        if (normalizedKind === "workbook") {
            const verifiedInterior =
                typeof options.isVerifiedInteriorWorkbookItem === "function" &&
                options.isVerifiedInteriorWorkbookItem(normalizedId) === true;
            return verifiedInterior
                ? DEFAULT_INTERIOR_SERVICE_MINUTES
                : DEFAULT_WORKBOOK_SERVICE_MINUTES;
        }

        return null;
    }

    function uniqueIds(values) {
        const result = [];
        const seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const id = text(value);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            result.push(id);
        }
        return result;
    }

    function summarizeStopServiceMinutes(work, records, options = {}) {
        const workItems = [
            ...uniqueIds(work?.orderIds).map((workItemId) => ({
                kind: "workbook",
                workItemId,
            })),
            ...uniqueIds(work?.gigIds).map((workItemId) => ({
                kind: "gig",
                workItemId,
            })),
        ];

        let knownServiceMinutes = 0;
        let complete = true;
        const items = workItems.map((item) => {
            const serviceMinutes = resolveWorkItemServiceMinutes(
                item.kind,
                item.workItemId,
                records,
                options,
            );
            if (serviceMinutes === null) {
                complete = false;
            } else {
                knownServiceMinutes += serviceMinutes;
            }
            return { ...item, serviceMinutes };
        });

        return {
            workItemCount: items.length,
            serviceMinutes: complete ? knownServiceMinutes : null,
            knownServiceMinutes,
            complete,
            items,
        };
    }

    return Object.freeze({
        PLANNING_SCHEMA_VERSION,
        PLANNING_STORAGE_KEY,
        DEFAULT_WORKBOOK_SERVICE_MINUTES,
        DEFAULT_INTERIOR_SERVICE_MINUTES,
        normalizeWorkItemKind,
        normalizeWorkItemId,
        workItemKey,
        normalizeServiceMinutes,
        normalizeCalendarDate,
        normalizePlanningRecord,
        normalizePlanningList,
        mergePlanningRecord,
        readPlanningRecords,
        writePlanningRecords,
        createPlanningRecord,
        findPlanningRecord,
        applyPlanningEdit,
        resolveWorkItemServiceMinutes,
        summarizeStopServiceMinutes,
    });
});
