(function attachFreeMapRouterAddressCorrections(root, factory) {
    const contract =
        typeof module === "object" && module.exports
            ? require("./contract.js")
            : root?.FMRContract;
    const corrections = factory(contract);

    if (typeof module === "object" && module.exports) {
        module.exports = corrections;
    }

    if (root) {
        root.FMRAddressCorrections = corrections;
    }
})(
    typeof globalThis !== "undefined" ? globalThis : this,
    function buildAddressCorrections(contract) {
        "use strict";

        const CORRECTIONS_APP = "free-map-router";
        const CORRECTIONS_VERSION = 1;

        if (!contract) {
            throw new Error("Free Map Router contract failed to load.");
        }

        const {
            addressKey,
            normalizeAddress,
            normalizeCoordinates,
            normalizeSource,
            normalizeStop,
        } = contract;

        function normalizeCorrection(raw) {
            const originalAddress = normalizeAddress(raw?.originalAddress);
            const correctedAddress = normalizeAddress(raw?.correctedAddress);
            if (!originalAddress || !correctedAddress) return null;

            const originalAddressKey = addressKey(originalAddress);
            const correctedAddressKey = addressKey(correctedAddress);
            if (!originalAddressKey || originalAddressKey === correctedAddressKey) {
                return null;
            }

            const coordinates = normalizeCoordinates(
                raw?.latitude,
                raw?.longitude,
            );
            const correctionStop = normalizeStop({
                address: correctedAddress,
                source: raw?.source,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                placeId: raw?.placeId,
                pinStatus: raw?.pinStatus,
            });

            return {
                originalAddress,
                originalAddressKey,
                correctedAddress,
                correctedAddressKey,
                source: normalizeSource(raw?.source),
                latitude: correctionStop.latitude,
                longitude: correctionStop.longitude,
                placeId: correctionStop.placeId,
                pinStatus: correctionStop.pinStatus,
            };
        }

        function normalizeCorrections(values) {
            const byOriginalKey = new Map();
            for (const raw of Array.isArray(values) ? values : []) {
                const correction = normalizeCorrection(raw);
                if (correction) {
                    byOriginalKey.set(correction.originalAddressKey, correction);
                }
            }
            return Array.from(byOriginalKey.values()).sort((left, right) =>
                left.originalAddressKey.localeCompare(right.originalAddressKey),
            );
        }

        function createCorrectionRecord(stops, now = new Date()) {
            const corrections = [];
            for (const rawStop of Array.isArray(stops) ? stops : []) {
                const stop = normalizeStop(rawStop);
                if (!stop) continue;
                for (const originalAddress of stop.addressAliases || []) {
                    corrections.push({
                        originalAddress,
                        correctedAddress: stop.address,
                        source: stop.source,
                        latitude: stop.latitude,
                        longitude: stop.longitude,
                        placeId: stop.placeId,
                        pinStatus: stop.pinStatus,
                    });
                }
            }

            return {
                app: CORRECTIONS_APP,
                correctionsVersion: CORRECTIONS_VERSION,
                updatedAt: new Date(now).toISOString(),
                corrections: normalizeCorrections(corrections),
            };
        }

        function parseCorrectionRecord(rawText) {
            let parsed;
            try {
                parsed = JSON.parse(rawText);
            } catch {
                throw new Error("The permanent address-corrections file is damaged.");
            }

            if (
                !parsed ||
                parsed.app !== CORRECTIONS_APP ||
                parsed.correctionsVersion !== CORRECTIONS_VERSION ||
                !Array.isArray(parsed.corrections)
            ) {
                throw new Error(
                    "The permanent address-corrections file has an unexpected structure.",
                );
            }

            return {
                app: CORRECTIONS_APP,
                correctionsVersion: CORRECTIONS_VERSION,
                updatedAt: String(parsed.updatedAt || "").trim(),
                corrections: normalizeCorrections(parsed.corrections),
            };
        }

        function mergeCorrectionRecords(remote, local, now = new Date()) {
            const mergedByOriginalKey = new Map(
                normalizeCorrections(remote?.corrections).map((correction) => [
                    correction.originalAddressKey,
                    correction,
                ]),
            );
            for (const correction of normalizeCorrections(
                local?.corrections,
            )) {
                const existing = mergedByOriginalKey.get(
                    correction.originalAddressKey,
                );
                mergedByOriginalKey.set(correction.originalAddressKey, {
                    ...correction,
                    source: correction.source || existing?.source || "",
                });
            }

            return {
                app: CORRECTIONS_APP,
                correctionsVersion: CORRECTIONS_VERSION,
                updatedAt: new Date(now).toISOString(),
                corrections: normalizeCorrections(
                    Array.from(mergedByOriginalKey.values()),
                ),
            };
        }

        function applyCorrectionsToInbox(inbox, record) {
            const byOriginalKey = new Map(
                (record?.corrections || []).map((correction) => [
                    correction.originalAddressKey,
                    correction,
                ]),
            );

            return {
                ...inbox,
                addresses: (inbox?.addresses || []).map((incoming) => {
                    const originalAddress = normalizeAddress(incoming?.address);
                    const correction = byOriginalKey.get(
                        addressKey(originalAddress),
                    );
                    if (!correction) return incoming;
                    const correctionHasManualPin =
                        correction.pinStatus === "manual" &&
                        correction.latitude !== null &&
                        correction.longitude !== null;

                    return {
                        ...incoming,
                        address: correction.correctedAddress,
                        originalAddresses: [
                            originalAddress,
                            ...(incoming?.originalAddresses || []),
                        ],
                        originalAddress: incoming?.originalAddress || originalAddress,
                        source: normalizeSource(incoming?.source) || correction.source,
                        latitude: correctionHasManualPin
                            ? correction.latitude
                            : incoming?.latitude ?? correction.latitude,
                        longitude: correctionHasManualPin
                            ? correction.longitude
                            : incoming?.longitude ?? correction.longitude,
                        placeId: incoming?.placeId || correction.placeId,
                        pinStatus: correctionHasManualPin
                            ? "manual"
                            : incoming?.pinStatus || correction.pinStatus,
                    };
                }),
            };
        }

        // Suggestions are a read-only view: never erase workbook match aliases.
        function savedAddressSuggestions(stops, query = "", maxResults = 8) {
            const entries = (Array.isArray(stops) ? stops : [])
                .map((stop) => {
                    const address = normalizeAddress(stop?.address);
                    return {
                        address,
                        key: addressKey(address),
                        aliases: Array.isArray(stop?.addressAliases)
                            ? stop.addressAliases.map(normalizeAddress).filter(Boolean)
                            : [],
                    };
                })
                .filter((entry) => entry.key);

            const superseded = new Set();
            for (const entry of entries) {
                for (const alias of entry.aliases) {
                    const aliasKey = addressKey(alias);
                    if (aliasKey && aliasKey !== entry.key) {
                        superseded.add(aliasKey);
                    }
                }
            }

            const search = normalizeAddress(query).toLowerCase();
            const seen = new Set();
            const results = [];
            const cap = Number.isInteger(maxResults) && maxResults > 0
                ? maxResults
                : 8;
            for (const entry of entries) {
                if (superseded.has(entry.key) || seen.has(entry.key)) continue;
                if (
                    search &&
                    ![entry.address, ...entry.aliases].some((value) =>
                        value.toLowerCase().includes(search),
                    )
                ) continue;
                seen.add(entry.key);
                results.push(entry.address);
                if (results.length >= cap) break;
            }
            return results;
        }

        return Object.freeze({
            CORRECTIONS_APP,
            CORRECTIONS_VERSION,
            applyCorrectionsToInbox,
            savedAddressSuggestions,
            createCorrectionRecord,
            mergeCorrectionRecords,
            parseCorrectionRecord,
        });
    },
);
