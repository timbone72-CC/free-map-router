(function attachManualWorkLibrary(root, factory) {
    const stopContract =
        typeof module === "object" && module.exports
            ? require("./contract.js")
            : root?.FMRContract;
    const library = factory(stopContract);

    if (typeof module === "object" && module.exports) {
        module.exports = library;
    }

    if (root) {
        root.FMRManualWorkLibrary = library;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildManualWorkLibrary(stopContract) {
    "use strict";

    const MANUAL_WORK_APP = "free-map-router";
    const MANUAL_WORK_VERSION = 1;
    const MANUAL_WORK_STORAGE_KEY = "fmr_v1_manual_work_library";

    if (!stopContract) {
        throw new Error("Free Map Router stop contract failed to load.");
    }

    const {
        addressKey,
        normalizeAddress,
        normalizeAddressAliases,
        normalizeCoordinates,
        normalizeStop,
        normalizeStopList,
    } = stopContract;

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function timestamp(value, fallback = "") {
        const raw = text(value);
        if (!raw) return fallback;
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
    }

    function nowIso(now = new Date()) {
        return new Date(now).toISOString();
    }

    function propertyId(idFactory) {
        if (typeof idFactory === "function") return text(idFactory());
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return `property_${crypto.randomUUID()}`;
        }
        return `property_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    }

    function pinRank(value) {
        if (value === "manual") return 3;
        if (value === "geocoded") return 2;
        return 1;
    }

    function normalizeProperty(raw, options = {}) {
        const address = normalizeAddress(raw?.address);
        const id = text(raw?.propertyId);
        if (!address || !id) return null;

        const coordinates = normalizeCoordinates(
            raw?.latitude,
            raw?.longitude,
        );
        const pinStatus =
            coordinates.latitude === null
                ? "unverified"
                : raw?.pinStatus === "manual"
                  ? "manual"
                  : "geocoded";

        return {
            propertyId: id,
            address,
            addressKey: addressKey(address),
            addressAliases: normalizeAddressAliases(
                raw?.addressAliases,
                address,
            ),
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeId: text(raw?.placeId),
            pinStatus,
            archived: Boolean(raw?.archived),
            updatedAt: timestamp(raw?.updatedAt, options.defaultUpdatedAt || ""),
        };
    }

    function compareUpdated(left, right) {
        const leftTime = Date.parse(left?.updatedAt || "") || 0;
        const rightTime = Date.parse(right?.updatedAt || "") || 0;
        return leftTime - rightTime;
    }

    function mergePropertyDetails(preferred, other) {
        const stronger =
            pinRank(other?.pinStatus) > pinRank(preferred?.pinStatus)
                ? other
                : preferred;
        return normalizeProperty({
            ...preferred,
            addressAliases: [
                ...(preferred?.addressAliases || []),
                ...(other?.addressAliases || []),
                other?.address,
            ],
            latitude: stronger?.latitude,
            longitude: stronger?.longitude,
            placeId: stronger?.placeId || preferred?.placeId || other?.placeId,
            pinStatus: stronger?.pinStatus,
        });
    }

    function normalizeProperties(values) {
        const byId = new Map();
        for (const raw of Array.isArray(values) ? values : []) {
            const property = normalizeProperty(raw);
            if (!property) continue;
            const current = byId.get(property.propertyId);
            if (!current || compareUpdated(property, current) >= 0) {
                byId.set(property.propertyId, property);
            }
        }

        const byAddress = new Map();
        for (const property of byId.values()) {
            const current = byAddress.get(property.addressKey);
            if (!current) {
                byAddress.set(property.addressKey, property);
                continue;
            }
            const newer =
                compareUpdated(property, current) >= 0 ? property : current;
            const older = newer === property ? current : property;
            byAddress.set(
                property.addressKey,
                mergePropertyDetails(newer, older),
            );
        }

        return Array.from(byAddress.values()).sort((left, right) =>
            left.address.localeCompare(right.address),
        );
    }

    function normalizeLibrary(raw, options = {}) {
        return {
            app: MANUAL_WORK_APP,
            manualWorkVersion: MANUAL_WORK_VERSION,
            updatedAt: timestamp(raw?.updatedAt, options.defaultUpdatedAt || ""),
            properties: normalizeProperties(raw?.properties),
        };
    }

    function emptyLibrary(now = new Date(0)) {
        return normalizeLibrary({
            updatedAt: nowIso(now),
            properties: [],
        });
    }

    function parseManualWorkRecord(rawText) {
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            throw new Error("The permanent Manual Work Library file is damaged.");
        }
        if (
            !parsed ||
            parsed.app !== MANUAL_WORK_APP ||
            parsed.manualWorkVersion !== MANUAL_WORK_VERSION ||
            !Array.isArray(parsed.properties)
        ) {
            throw new Error(
                "The permanent Manual Work Library file has an unexpected structure.",
            );
        }
        return normalizeLibrary(parsed);
    }

    function readManualWork(storage) {
        try {
            const raw = JSON.parse(storage.getItem(MANUAL_WORK_STORAGE_KEY) || "null");
            return normalizeLibrary(raw || emptyLibrary(new Date(0)));
        } catch {
            return emptyLibrary(new Date(0));
        }
    }

    function writeManualWork(storage, library) {
        const normalized = normalizeLibrary(library);
        storage.setItem(MANUAL_WORK_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function propertyKeys(property) {
        return new Set(
            [property?.address, ...(property?.addressAliases || [])]
                .map(addressKey)
                .filter(Boolean),
        );
    }

    function stopKeys(stop) {
        return new Set(
            [stop?.address, ...(stop?.addressAliases || [])]
                .map(addressKey)
                .filter(Boolean),
        );
    }

    function propertyMatchesStop(property, stop) {
        const propertySet = propertyKeys(property);
        for (const key of stopKeys(stop)) {
            if (propertySet.has(key)) return true;
        }
        return false;
    }

    function findPropertyForStop(library, stop) {
        const normalized = normalizeLibrary(library);
        return (
            normalized.properties.find((property) =>
                propertyMatchesStop(property, stop),
            ) || null
        );
    }

    function sameStopSnapshot(property, stop) {
        if (!property || !stop) return false;
        const aliases = normalizeAddressAliases(
            stop.addressAliases,
            stop.address,
        );
        return (
            property.addressKey === stop.addressKey &&
            JSON.stringify(property.addressAliases) === JSON.stringify(aliases) &&
            property.latitude === stop.latitude &&
            property.longitude === stop.longitude &&
            property.placeId === (stop.placeId || "") &&
            property.pinStatus === stop.pinStatus &&
            property.archived === false
        );
    }

    function upsertPropertyFromStop(library, rawStop, options = {}) {
        const stop = normalizeStop(rawStop);
        if (!stop) throw new Error("A saved address is required for Manual Work Library.");

        const normalized = normalizeLibrary(library);
        const existing = findPropertyForStop(normalized, stop);
        if (existing && options.touch === false && sameStopSnapshot(existing, stop)) {
            return normalized;
        }

        const updatedAt = nowIso(options.now || new Date());
        const next = normalizeProperty({
            propertyId:
                existing?.propertyId || propertyId(options.idFactory),
            address: stop.address,
            addressAliases: [
                ...(existing?.addressAliases || []),
                ...(stop.addressAliases || []),
                ...(existing && existing.addressKey !== stop.addressKey
                    ? [existing.address]
                    : []),
            ],
            latitude: stop.latitude,
            longitude: stop.longitude,
            placeId: stop.placeId,
            pinStatus: stop.pinStatus,
            archived: options.touch === false ? existing?.archived || false : false,
            updatedAt,
        });

        const properties = existing
            ? normalized.properties.map((property) =>
                  property.propertyId === existing.propertyId ? next : property,
              )
            : [...normalized.properties, next];

        return normalizeLibrary({
            ...normalized,
            updatedAt,
            properties,
        });
    }

    function setPropertyArchived(library, id, archived, now = new Date()) {
        const normalized = normalizeLibrary(library);
        const updatedAt = nowIso(now);
        let found = false;
        const properties = normalized.properties.map((property) => {
            if (property.propertyId !== id) return property;
            found = true;
            return normalizeProperty({
                ...property,
                archived: Boolean(archived),
                updatedAt,
            });
        });
        if (!found) throw new Error("That Manual Work Library property was not found.");
        return normalizeLibrary({ ...normalized, updatedAt, properties });
    }

    function mergeManualWorkLibraries(remote, local, now = new Date()) {
        const remoteNormalized = normalizeLibrary(remote);
        const localNormalized = normalizeLibrary(local);
        const byId = new Map(
            remoteNormalized.properties.map((property) => [
                property.propertyId,
                property,
            ]),
        );

        for (const property of localNormalized.properties) {
            const remoteProperty = byId.get(property.propertyId);
            if (!remoteProperty) {
                byId.set(property.propertyId, property);
                continue;
            }
            const newer =
                compareUpdated(property, remoteProperty) >= 0
                    ? property
                    : remoteProperty;
            const older = newer === property ? remoteProperty : property;
            byId.set(
                property.propertyId,
                mergePropertyDetails(newer, older),
            );
        }

        return normalizeLibrary({
            updatedAt: nowIso(now),
            properties: Array.from(byId.values()),
        });
    }

    function propertyStop(property, options = {}) {
        return normalizeStop({
            id:
                text(options.id) ||
                `manual_${property.propertyId}`,
            address: property.address,
            addressAliases: property.addressAliases,
            latitude: property.latitude,
            longitude: property.longitude,
            placeId: property.placeId,
            pinStatus: property.pinStatus,
            label: "",
            source: "",
            notes: "",
        });
    }

    function restoreLibraryPropertiesToStops(library, stops) {
        let next = normalizeStopList(stops);
        let restoredCount = 0;

        for (const property of normalizeLibrary(library).properties) {
            if (property.archived) continue;
            const existing = next.find((stop) =>
                propertyMatchesStop(property, stop),
            );
            if (existing) continue;
            const stop = propertyStop(property);
            if (!stop) continue;
            next = normalizeStopList([...next, stop]);
            restoredCount += 1;
        }

        return { stops: next, restoredCount };
    }

    return Object.freeze({
        MANUAL_WORK_APP,
        MANUAL_WORK_STORAGE_KEY,
        MANUAL_WORK_VERSION,
        emptyLibrary,
        findPropertyForStop,
        mergeManualWorkLibraries,
        normalizeLibrary,
        normalizeProperty,
        parseManualWorkRecord,
        propertyMatchesStop,
        readManualWork,
        restoreLibraryPropertiesToStops,
        setPropertyArchived,
        upsertPropertyFromStop,
        writeManualWork,
    });
});