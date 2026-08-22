(function attachFreeMapRouterGigContract(root, factory) {
    const gigContract = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = gigContract;
    }

    if (root) {
        root.FMRGigContract = gigContract;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGigContract() {
    "use strict";

    const GIG_SCHEMA_VERSION = 1;
    const GIGS_STORAGE_KEY = "fmr_v1_gigs";

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function createGigId() {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return `gig_${crypto.randomUUID()}`;
        }

        return `gig_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    }

    function normalizeGigSource(value) {
        const source = text(value).toUpperCase();
        return source || "OTHER";
    }

    function normalizeExpectedPay(value) {
        if (value === null || value === undefined || text(value) === "") {
            return null;
        }

        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
            throw new Error("Expected pay must be a nonnegative number.");
        }
        return Math.round((number + Number.EPSILON) * 100) / 100;
    }

    function normalizeTimestamp(value, fallback = null) {
        const raw = text(value);
        if (!raw) return fallback;
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
    }

    function normalizeGig(raw, options = {}) {
        if (!raw || typeof raw !== "object") return null;

        const stopId = text(raw.stopId);
        if (!stopId) return null;
        if (options.validStopIds && !options.validStopIds.has(stopId)) return null;

        const id =
            text(raw.id) ||
            (options.allowCreateId
                ? options.idFactory?.() || createGigId()
                : "");
        if (!id) return null;

        const now =
            normalizeTimestamp(options.now) || new Date().toISOString();
        const createdAt = normalizeTimestamp(raw.createdAt, now);
        const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);

        let expectedPay;
        try {
            expectedPay = normalizeExpectedPay(raw.expectedPay);
        } catch (error) {
            if (options.skipInvalid) return null;
            throw error;
        }

        return {
            schemaVersion: GIG_SCHEMA_VERSION,
            id,
            stopId,
            source: normalizeGigSource(raw.source),
            workOrderId: text(raw.workOrderId),
            expectedPay,
            notes: text(raw.notes),
            routeIncluded: Boolean(raw.routeIncluded),
            createdAt,
            updatedAt,
        };
    }

    function normalizeGigList(records, options = {}) {
        const result = [];
        const seenIds = new Set();

        for (const record of Array.isArray(records) ? records : []) {
            const gig = normalizeGig(record, {
                ...options,
                allowCreateId: false,
                skipInvalid: true,
            });
            if (!gig || seenIds.has(gig.id)) continue;
            seenIds.add(gig.id);
            result.push(gig);
        }

        return result;
    }

    function safeParse(raw) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function readGigs(storage, validStopIds = null) {
        const raw = storage?.getItem?.(GIGS_STORAGE_KEY);
        return normalizeGigList(raw ? safeParse(raw) : [], { validStopIds });
    }

    function writeGigs(storage, records, validStopIds = null) {
        const normalized = normalizeGigList(records, { validStopIds });
        storage?.setItem?.(GIGS_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function createGig(draft, options = {}) {
        const now = normalizeTimestamp(options.now) || new Date().toISOString();
        const gig = normalizeGig(
            {
                ...draft,
                createdAt: now,
                updatedAt: now,
            },
            {
                ...options,
                now,
                allowCreateId: true,
                skipInvalid: false,
            },
        );
        if (!gig) {
            throw new Error("A manual gig must be attached to a saved address.");
        }
        return gig;
    }

    function applyGigEdit(records, gigId, draft, options = {}) {
        const normalized = normalizeGigList(records, {
            validStopIds: options.validStopIds,
        });
        const index = normalized.findIndex((gig) => gig.id === gigId);
        if (index < 0) {
            throw new Error("The manual gig being edited is no longer saved.");
        }

        const existing = normalized[index];
        const now = normalizeTimestamp(options.now) || new Date().toISOString();
        const edited = normalizeGig(
            {
                ...existing,
                ...draft,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: now,
            },
            {
                validStopIds: options.validStopIds,
                now,
                skipInvalid: false,
            },
        );
        if (!edited) {
            throw new Error("The manual gig must stay attached to a saved address.");
        }

        normalized[index] = edited;
        return normalized;
    }

    function deleteGig(records, gigId, validStopIds = null) {
        return normalizeGigList(records, { validStopIds }).filter(
            (gig) => gig.id !== gigId,
        );
    }

    function remapGigStopIds(records, idRemap = {}, validStopIds = null) {
        const replacements =
            idRemap && typeof idRemap === "object" ? idRemap : {};
        const remapped = [];

        for (const gig of normalizeGigList(records)) {
            const replacement = replacements[gig.stopId];
            const stopId =
                typeof replacement === "string" && replacement.trim()
                    ? replacement.trim()
                    : gig.stopId;
            remapped.push({ ...gig, stopId });
        }

        return normalizeGigList(remapped, { validStopIds });
    }

    function gigsForStop(records, stopId) {
        const id = text(stopId);
        return normalizeGigList(records).filter((gig) => gig.stopId === id);
    }

    return Object.freeze({
        GIG_SCHEMA_VERSION,
        GIGS_STORAGE_KEY,
        normalizeGigSource,
        normalizeExpectedPay,
        normalizeGig,
        normalizeGigList,
        readGigs,
        writeGigs,
        createGig,
        applyGigEdit,
        deleteGig,
        remapGigStopIds,
        gigsForStop,
    });
});