(function attachFreeMapRouterContract(root, factory) {
    const contract = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = contract;
    }

    if (root) {
        root.FMRContract = contract;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContract() {
    "use strict";

    const SCHEMA_VERSION = 3;
    const STOPS_STORAGE_KEY = "fmr_v2_stops";
    const HOME_STORAGE_KEY = "fmr_v2_home";
    const LEGACY_JOBS_STORAGE_KEY = "fmr_v1_jobs";
    const MIGRATION_MARKER_KEY = "fmr_v2_migration_complete";
    const PIN_STATUSES = new Set(["unverified", "geocoded", "manual"]);
    const ROUTE_SOURCES = new Set(["GIS", "DCFS"]);

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function normalizeSource(value) {
        const source = text(value).toUpperCase();
        return ROUTE_SOURCES.has(source) ? source : "";
    }

    function normalizeAddress(address) {
        return text(address).replace(/\s+/g, " ");
    }

    function addressKey(address) {
        return normalizeAddress(address)
            .toLowerCase()
            .replace(/\s*,\s*/g, ",")
            .replace(/\s+/g, " ");
    }

    function normalizeAddressAliases(values, currentAddress = "") {
        const aliases = [];
        const seen = new Set();
        const currentKey = addressKey(currentAddress);

        for (const value of Array.isArray(values) ? values : []) {
            const address = normalizeAddress(value);
            const key = addressKey(address);
            if (!address || !key || key === currentKey || seen.has(key)) {
                continue;
            }
            seen.add(key);
            aliases.push(address);
        }

        return aliases;
    }

    function finiteCoordinate(value, min, max) {
        if (value === null || value === undefined || text(value) === "") {
            return null;
        }

        const number = Number(value);
        return Number.isFinite(number) && number >= min && number <= max
            ? number
            : null;
    }

    function normalizeCoordinates(latitude, longitude) {
        const lat = finiteCoordinate(latitude, -90, 90);
        const lng = finiteCoordinate(longitude, -180, 180);

        if (lat === null || lng === null) {
            return { latitude: null, longitude: null };
        }

        return { latitude: lat, longitude: lng };
    }

    function createId() {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return `stop_${crypto.randomUUID()}`;
        }

        return `stop_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    }

    function normalizeStop(raw, options = {}) {
        const address = normalizeAddress(raw?.address);
        if (!address) return null;

        const coordinates = normalizeCoordinates(
            raw?.latitude,
            raw?.longitude,
        );
        const requestedStatus = text(raw?.pinStatus).toLowerCase();
        let pinStatus = PIN_STATUSES.has(requestedStatus)
            ? requestedStatus
            : coordinates.latitude === null
              ? "unverified"
              : "geocoded";

        if (coordinates.latitude === null) {
            pinStatus = "unverified";
        }

        return {
            schemaVersion: SCHEMA_VERSION,
            id: text(raw?.id) || options.idFactory?.() || createId(),
            address,
            addressKey: addressKey(address),
            addressAliases: normalizeAddressAliases(
                raw?.addressAliases,
                address,
            ),
            label: text(raw?.label || raw?.company),
            source: normalizeSource(raw?.source),
            notes: text(raw?.notes),
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeId: text(raw?.placeId),
            pinStatus,
        };
    }

    function normalizeHome(raw) {
        const normalized = normalizeStop(
            {
                ...raw,
                id: "home",
                label: "Home",
            },
            { idFactory: () => "home" },
        );

        return normalized
            ? {
                  ...normalized,
                  id: "home",
                  label: "Home",
                  role: "home",
              }
            : null;
    }

    function mergeStops(existing, incoming) {
        const existingHasPin =
            existing.latitude !== null && existing.longitude !== null;
        const incomingHasPin =
            incoming.latitude !== null && incoming.longitude !== null;
        const incomingWins =
            incoming.pinStatus === "manual" ||
            (!existingHasPin && incomingHasPin) ||
            (existing.pinStatus !== "manual" &&
                incoming.pinStatus === "geocoded");

        return {
            ...existing,
            addressAliases: normalizeAddressAliases(
                [
                    ...(existing.addressAliases || []),
                    ...(incoming.addressAliases || []),
                ],
                existing.address,
            ),
            label: existing.label || incoming.label,
            source: incoming.source || existing.source,
            notes: existing.notes || incoming.notes,
            latitude: incomingWins ? incoming.latitude : existing.latitude,
            longitude: incomingWins ? incoming.longitude : existing.longitude,
            placeId: incomingWins
                ? incoming.placeId || existing.placeId
                : existing.placeId || incoming.placeId,
            pinStatus: incomingWins ? incoming.pinStatus : existing.pinStatus,
        };
    }

    function applyStopEdit(records, stopId, draft) {
        const stops = normalizeStopList(records);
        const editedIndex = stops.findIndex((stop) => stop.id === stopId);
        if (editedIndex < 0) {
            throw new Error("The address being edited is no longer saved.");
        }

        const existing = stops[editedIndex];
        const nextAddress = normalizeAddress(draft?.address);
        if (!nextAddress) {
            throw new Error("Address is required.");
        }

        const draftCoordinates = normalizeCoordinates(
            draft?.latitude,
            draft?.longitude,
        );
        const draftHasCoordinates = draftCoordinates.latitude !== null;
        const changedAddress =
            addressKey(nextAddress) !== existing.addressKey;
        const addressAliases = normalizeAddressAliases(
            [
                ...(existing.addressAliases || []),
                ...(changedAddress ? [existing.address] : []),
            ],
            nextAddress,
        );

        let edited = normalizeStop({
            ...existing,
            ...draft,
            id: existing.id,
            address: nextAddress,
            addressAliases,
            source: existing.source,
            latitude: draftHasCoordinates
                ? draftCoordinates.latitude
                : existing.latitude,
            longitude: draftHasCoordinates
                ? draftCoordinates.longitude
                : existing.longitude,
            placeId: text(draft?.placeId) || existing.placeId,
            pinStatus: draftHasCoordinates
                ? draft?.pinStatus
                : existing.pinStatus,
        });

        const duplicateIndexes = [];
        const idRemap = {};
        for (let index = 0; index < stops.length; index += 1) {
            if (
                index === editedIndex ||
                stops[index].addressKey !== edited.addressKey
            ) {
                continue;
            }
            duplicateIndexes.push(index);
            idRemap[stops[index].id] = existing.id;
            const retainedSource = edited.source || stops[index].source;
            edited = {
                ...mergeStops(edited, stops[index]),
                source: retainedSource,
            };
        }

        const involvedIndexes = new Set([editedIndex, ...duplicateIndexes]);
        const outputIndex = Math.min(...involvedIndexes);
        const result = [];
        for (let index = 0; index < stops.length; index += 1) {
            if (index === outputIndex) result.push(edited);
            if (!involvedIndexes.has(index)) result.push(stops[index]);
        }

        return {
            stops: normalizeStopList(result),
            retainedId: existing.id,
            idRemap,
        };
    }

    function normalizeStopList(records, options = {}) {
        const result = [];
        const byAddress = new Map();

        for (const record of Array.isArray(records) ? records : []) {
            const stop = normalizeStop(record, options);
            if (!stop) continue;

            const index = byAddress.get(stop.addressKey);
            if (index === undefined) {
                byAddress.set(stop.addressKey, result.length);
                result.push(stop);
            } else {
                result[index] = mergeStops(result[index], stop);
            }
        }

        return result;
    }

    function safeParse(raw, fallback) {
        try {
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
        } catch {
            return fallback;
        }
    }

    function readStops(storage, options = {}) {
        const current = safeParse(storage.getItem(STOPS_STORAGE_KEY), null);
        if (Array.isArray(current)) {
            return {
                stops: normalizeStopList(current, options),
                migrated: false,
            };
        }

        const legacyRaw = safeParse(
            storage.getItem(LEGACY_JOBS_STORAGE_KEY),
            [],
        );
        const stops = normalizeStopList(legacyRaw, options);

        storage.setItem(STOPS_STORAGE_KEY, JSON.stringify(stops));
        storage.setItem(MIGRATION_MARKER_KEY, new Date().toISOString());

        return { stops, migrated: Array.isArray(legacyRaw) && legacyRaw.length > 0 };
    }

    function writeStops(storage, stops, options = {}) {
        const normalized = normalizeStopList(stops, options);
        storage.setItem(STOPS_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function readHome(storage) {
        const raw = safeParse(storage.getItem(HOME_STORAGE_KEY), null);
        return normalizeHome(raw);
    }

    function writeHome(storage, home) {
        const normalized = normalizeHome(home);

        if (!normalized) {
            throw new Error("Home address is required.");
        }

        storage.setItem(HOME_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function buildRoundTrip(home, stops) {
        const normalizedHome = normalizeHome(home);
        if (!normalizedHome) return [];

        const normalizedStops = normalizeStopList(stops).filter(
            (stop) => stop.addressKey !== normalizedHome.addressKey,
        );

        return [
            { ...normalizedHome, routeRole: "start" },
            ...normalizedStops.map((stop) => ({
                ...stop,
                routeRole: "stop",
            })),
            { ...normalizedHome, routeRole: "finish" },
        ];
    }

    return Object.freeze({
        SCHEMA_VERSION,
        STOPS_STORAGE_KEY,
        HOME_STORAGE_KEY,
        LEGACY_JOBS_STORAGE_KEY,
        MIGRATION_MARKER_KEY,
        applyStopEdit,
        normalizeAddress,
        normalizeAddressAliases,
        normalizeSource,
        addressKey,
        normalizeCoordinates,
        normalizeStop,
        normalizeHome,
        normalizeStopList,
        readStops,
        writeStops,
        readHome,
        writeHome,
        buildRoundTrip,
    });
});
