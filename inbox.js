(function attachFreeMapRouterInbox(root, factory) {
    const contract =
        typeof module === "object" && module.exports
            ? require("./contract.js")
            : root?.FMRContract;
    const inbox = factory(contract);

    if (typeof module === "object" && module.exports) {
        module.exports = inbox;
    }

    if (root) {
        root.FMRInbox = inbox;
    }
})(
    typeof globalThis !== "undefined" ? globalThis : this,
    function buildInbox(contract) {
        "use strict";

        const INBOX_APP = "free-map-router";
        const INBOX_VERSION = 1;
        const INBOX_SOURCE = "InspectorADE Repeat Job Predictor - LIVE";

        if (!contract) {
            throw new Error("Free Map Router contract failed to load.");
        }

        const {
            addressKey,
            normalizeAddress,
            normalizeStop,
            normalizeStopList,
        } = contract;

        function addUnique(values, value) {
            if (value && !values.includes(value)) values.push(value);
        }

        function originalAliases(raw) {
            const addresses = [];
            const keys = [];
            const candidates = [
                ...(Array.isArray(raw?.originalAddresses)
                    ? raw.originalAddresses
                    : []),
                raw?.originalAddress,
            ];

            for (const candidate of candidates) {
                const address = normalizeAddress(candidate);
                if (!address) continue;
                addUnique(addresses, address);
                addUnique(keys, addressKey(address));
            }

            return { addresses, keys };
        }

        function normalizeInboxAddresses(entries) {
            const result = [];
            const indexByAddress = new Map();

            for (const raw of Array.isArray(entries) ? entries : []) {
                const stop = normalizeStop(raw);
                if (!stop) continue;

                const aliases = originalAliases(raw);
                const index = indexByAddress.get(stop.addressKey);

                if (index === undefined) {
                    indexByAddress.set(stop.addressKey, result.length);
                    result.push({
                        ...stop,
                        originalAddresses: aliases.addresses,
                        originalAddressKeys: aliases.keys,
                    });
                    continue;
                }

                const merged = normalizeStopList([result[index], stop])[0];
                const originalAddresses = [
                    ...(result[index].originalAddresses || []),
                ];
                const originalAddressKeys = [
                    ...(result[index].originalAddressKeys || []),
                ];

                for (const address of aliases.addresses) {
                    addUnique(originalAddresses, address);
                }
                for (const key of aliases.keys) {
                    addUnique(originalAddressKeys, key);
                }

                result[index] = {
                    ...merged,
                    originalAddresses,
                    originalAddressKeys,
                };
            }

            return result;
        }

        function parseAddressInbox(rawText) {
            let parsed;
            try {
                parsed = JSON.parse(rawText);
            } catch {
                throw new Error("The workbook address inbox contains damaged JSON.");
            }

            if (
                !parsed ||
                parsed.app !== INBOX_APP ||
                parsed.inboxVersion !== INBOX_VERSION ||
                parsed.source !== INBOX_SOURCE ||
                !Array.isArray(parsed.addresses)
            ) {
                throw new Error(
                    "The workbook address inbox has an unexpected structure.",
                );
            }

            const updatedAt = parsed.updatedAt
                ? new Date(parsed.updatedAt)
                : null;
            if (
                (updatedAt && Number.isNaN(updatedAt.getTime())) ||
                (parsed.addresses.length > 0 && !updatedAt)
            ) {
                throw new Error(
                    "The workbook address inbox is missing a valid export time.",
                );
            }

            return {
                ...parsed,
                updatedAt: updatedAt ? updatedAt.toISOString() : null,
                addresses: normalizeInboxAddresses(parsed.addresses),
            };
        }

        function formatInboxImportStatus(
            inbox,
            importedCount,
            formatDate = (date) => date.toLocaleString(),
        ) {
            const jobCount = Array.isArray(inbox?.addresses)
                ? inbox.addresses.length
                : 0;
            const source = inbox?.source || "Unknown source";
            const updated = inbox?.updatedAt
                ? formatDate(new Date(inbox.updatedAt))
                : "not yet exported";

            if (jobCount === 0) {
                return (
                    `Inbox ready — 0 jobs. Source: ${source}. ` +
                    `Updated: ${updated}. Import status: no jobs to import.`
                );
            }

            return (
                `Import successful — ${importedCount} of ${jobCount} job${jobCount === 1 ? "" : "s"}. ` +
                `Source: ${source}. Updated: ${updated}.`
            );
        }

        function applyAddressInbox(existingStops, inbox) {
            const savedStops = normalizeStopList(existingStops);
            const incomingStops = normalizeInboxAddresses(inbox?.addresses);
            const migrationByOriginalKey = new Map();

            for (const incoming of incomingStops) {
                for (const originalAddressKey of
                    incoming.originalAddressKeys || []) {
                    if (
                        originalAddressKey &&
                        originalAddressKey !== incoming.addressKey
                    ) {
                        migrationByOriginalKey.set(
                            originalAddressKey,
                            incoming,
                        );
                    }
                }
            }

            const migratedSavedStops = savedStops.map((stop) => {
                const incoming = migrationByOriginalKey.get(stop.addressKey);
                if (!incoming) return stop;

                return normalizeStop({
                    ...stop,
                    address: incoming.address,
                    source: incoming.source || stop.source,
                });
            });
            const stops = normalizeStopList([
                ...migratedSavedStops,
                ...incomingStops,
            ]);
            const idByAddress = new Map(
                stops.map((stop) => [stop.addressKey, stop.id]),
            );
            const routeIds = [];
            const selected = new Set();

            for (const stop of incomingStops) {
                const id = idByAddress.get(addressKey(stop.address));
                if (!id || selected.has(id)) continue;
                selected.add(id);
                routeIds.push(id);
            }

            return {
                stops,
                routeIds,
                importedCount: routeIds.length,
            };
        }

        return Object.freeze({
            INBOX_APP,
            INBOX_SOURCE,
            INBOX_VERSION,
            applyAddressInbox,
            formatInboxImportStatus,
            parseAddressInbox,
        });
    },
);
