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
        const STREET_CORRECTIONS_VERSION = 2;

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


        // Street rules are deliberately narrower than geocoding: only an
        // explicitly approved correction for the same street, town and state
        // may change the written street of another house number.
        function streetParts(value) {
            const address = normalizeAddress(value);
            const found = /^(\d+)\s*([^,]+)(,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:,\s*(?:USA|US))?\s*)$/i.exec(address);
            if (!found) return null;
            return {
                house: found[1].toUpperCase(),
                street: normalizeAddress(found[2]),
                suffix: found[3],
                town: normalizeAddress(found[4]),
                state: found[5].toUpperCase(),
                postalCode: found[6],
            };
        }

        function streetRuleKey(raw) {
            return [
                addressKey(raw?.town),
                String(raw?.state || "").trim().toUpperCase(),
                addressKey(raw?.originalStreet),
            ].join("|");
        }

        function proposeStreetCorrection(before, after) {
            const oldParts = streetParts(before);
            const nextParts = streetParts(after);
            if (!oldParts || !nextParts) return null;
            if (
                oldParts.house !== nextParts.house ||
                oldParts.postalCode !== nextParts.postalCode ||
                oldParts.state !== nextParts.state ||
                addressKey(oldParts.town) !== addressKey(nextParts.town) ||
                addressKey(oldParts.street) === addressKey(nextParts.street)
            ) return null;
            return {
                town: nextParts.town,
                state: nextParts.state,
                originalStreet: oldParts.street,
                correctedStreet: nextParts.street,
            };
        }

        function normalizeStreetRule(raw) {
            const id = String(raw?.id || "").trim();
            const town = normalizeAddress(raw?.town);
            const state = String(raw?.state || "").trim().toUpperCase();
            const originalStreet = normalizeAddress(raw?.originalStreet);
            const correctedStreet = normalizeAddress(raw?.correctedStreet);
            if (
                !/^[a-z0-9_-]{6,100}$/i.test(id) ||
                !town || !/^[A-Z]{2}$/.test(state) ||
                !originalStreet || !correctedStreet ||
                addressKey(originalStreet) === addressKey(correctedStreet)
            ) return null;
            return { id, town, state, originalStreet, correctedStreet };
        }

        function normalizedStreetState(record) {
            const removed = new Set(
                (Array.isArray(record?.removedStreetRuleIds)
                    ? record.removedStreetRuleIds : [])
                    .filter((id) => /^[a-z0-9_-]{6,100}$/i.test(String(id)))
                    .map(String),
            );
            const byId = new Map();
            for (const value of Array.isArray(record?.streetRules) ? record.streetRules : []) {
                const rule = normalizeStreetRule(value);
                if (rule && !removed.has(rule.id)) byId.set(rule.id, rule);
            }
            return {
                streetRules: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
                removedStreetRuleIds: [...removed].sort(),
            };
        }

        function recordWithStreetState(base, state) {
            const normalized = normalizedStreetState(state);
            const upgraded = Boolean(
                base?.correctionsVersion === STREET_CORRECTIONS_VERSION ||
                normalized.streetRules.length ||
                normalized.removedStreetRuleIds.length
            );
            return {
                ...base,
                correctionsVersion: upgraded ? STREET_CORRECTIONS_VERSION : CORRECTIONS_VERSION,
                ...(upgraded ? normalized : {}),
            };
        }

        function addStreetCorrectionRule(record, candidate, id) {
            const validated = normalizeStreetRule({
                ...candidate,
                id: id || (
                    "street_" + Date.now().toString(36) + "_" +
                    Math.random().toString(36).slice(2, 10)
                ),
            });
            if (!validated) return record;
            const current = normalizedStreetState(record);
            const exists = current.streetRules.some((rule) =>
                streetRuleKey(rule) === streetRuleKey(validated) &&
                addressKey(rule.correctedStreet) === addressKey(validated.correctedStreet)
            );
            return recordWithStreetState(record, {
                ...current,
                streetRules: exists
                    ? current.streetRules
                    : [...current.streetRules, validated],
            });
        }

        function removeStreetCorrectionRules(record, ids) {
            const current = normalizedStreetState(record);
            const removed = new Set(current.removedStreetRuleIds);
            for (const id of ids) {
                if (current.streetRules.some((rule) => rule.id === id)) removed.add(id);
            }
            return recordWithStreetState(record, {
                streetRules: current.streetRules,
                removedStreetRuleIds: [...removed],
            });
        }

        function streetDecisionForAddress(address, record) {
            const parts = streetParts(address);
            if (!parts) return null;
            const matching = normalizedStreetState(record).streetRules.filter((rule) =>
                streetRuleKey(rule) === streetRuleKey({
                    town: parts.town, state: parts.state, originalStreet: parts.street,
                }),
            );
            if (!matching.length) return null;
            const targets = new Map();
            for (const rule of matching) {
                const key = addressKey(rule.correctedStreet);
                if (!targets.has(key)) {
                    targets.set(key, { street: rule.correctedStreet, ruleIds: [] });
                }
                targets.get(key).ruleIds.push(rule.id);
            }
            const choices = [...targets.values()];
            if (choices.length > 1) {
                return {
                    status: "conflict",
                    address,
                    town: parts.town,
                    state: parts.state,
                    originalStreet: parts.street,
                    choices,
                };
            }
            return {
                status: "corrected",
                address: parts.house + " " + choices[0].street + parts.suffix,
                originalAddress: address,
                town: parts.town,
                state: parts.state,
                originalStreet: parts.street,
                choices,
            };
        }

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
                ![CORRECTIONS_VERSION, STREET_CORRECTIONS_VERSION].includes(parsed.correctionsVersion) ||
                !Array.isArray(parsed.corrections)
            ) {
                throw new Error(
                    "The permanent address-corrections file has an unexpected structure.",
                );
            }

            return recordWithStreetState({
                app: CORRECTIONS_APP,
                correctionsVersion: parsed.correctionsVersion,
                updatedAt: String(parsed.updatedAt || "").trim(),
                corrections: normalizeCorrections(parsed.corrections),
            }, parsed.correctionsVersion === STREET_CORRECTIONS_VERSION ? parsed : {});
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

            const left = normalizedStreetState(remote);
            const right = normalizedStreetState(local);
            const removed = [...new Set([
                ...left.removedStreetRuleIds, ...right.removedStreetRuleIds,
            ])];
            const ruleById = new Map(
                [...left.streetRules, ...right.streetRules].map((rule) => [rule.id, rule]),
            );
            return recordWithStreetState({
                app: CORRECTIONS_APP,
                correctionsVersion:
                    remote?.correctionsVersion === STREET_CORRECTIONS_VERSION ||
                    local?.correctionsVersion === STREET_CORRECTIONS_VERSION
                        ? STREET_CORRECTIONS_VERSION : CORRECTIONS_VERSION,
                updatedAt: new Date(now).toISOString(),
                corrections: normalizeCorrections(
                    Array.from(mergedByOriginalKey.values()),
                ),
            }, {
                streetRules: [...ruleById.values()],
                removedStreetRuleIds: removed,
            });
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
                    if (!correction) {
                        const street = streetDecisionForAddress(originalAddress, record);
                        if (!street) return incoming;
                        if (street.status === "conflict") {
                            return { ...incoming, streetCorrectionConflict: street };
                        }
                        // Never copy a different property's coordinates or metadata.
                        return {
                            ...incoming,
                            address: street.address,
                            originalAddresses: [
                                originalAddress, ...(incoming?.originalAddresses || []),
                            ],
                            originalAddress: incoming?.originalAddress || originalAddress,
                        };
                    }
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
            STREET_CORRECTIONS_VERSION,
            addStreetCorrectionRule,
            removeStreetCorrectionRules,
            proposeStreetCorrection,
            streetDecisionForAddress,
            applyCorrectionsToInbox,
            savedAddressSuggestions,
            createCorrectionRecord,
            mergeCorrectionRecords,
            parseCorrectionRecord,
        });
    },
);
