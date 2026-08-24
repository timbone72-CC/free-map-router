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

        function normalizeOrderIds(values) {
            const result = [];
            for (const value of Array.isArray(values) ? values : []) {
                addUnique(result, String(value ?? "").trim());
            }
            return result;
        }

        function normalizedExpectedPay(raw) {
            const hasPay = Object.hasOwn(raw || {}, "expectedPay");
            const hasComplete = Object.hasOwn(
                raw || {},
                "expectedPayComplete",
            );
            if (!hasPay && !hasComplete) return null;
            if (!hasPay || !hasComplete) {
                throw new Error(
                    "The workbook address inbox has incomplete expected-pay metadata.",
                );
            }

            const expectedPay = Number(raw.expectedPay);
            if (!Number.isFinite(expectedPay) || expectedPay < 0) {
                throw new Error(
                    "The workbook address inbox has invalid expected-pay metadata.",
                );
            }
            if (typeof raw.expectedPayComplete !== "boolean") {
                throw new Error(
                    "The workbook address inbox has invalid expected-pay completeness metadata.",
                );
            }

            return {
                expectedPay:
                    Math.round((expectedPay + Number.EPSILON) * 100) / 100,
                expectedPayComplete: raw.expectedPayComplete,
            };
        }

        function mergeExpectedPay(left, right) {
            if (!left && !right) return null;
            if (!left) return { ...right };
            if (!right) return { ...left };
            return {
                expectedPay:
                    Math.round(
                        (((left.expectedPay || 0) +
                            (right.expectedPay || 0) +
                            Number.EPSILON) *
                            100),
                    ) / 100,
                expectedPayComplete: Boolean(
                    left.expectedPayComplete && right.expectedPayComplete,
                ),
            };
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
                const normalizedStop = normalizeStop(raw);
                if (!normalizedStop) continue;
                const pay = normalizedExpectedPay(raw);
                const stop = {
                    ...normalizedStop,
                    orderIds: normalizeOrderIds(raw?.orderIds),
                    ...(pay || {}),
                };

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

                const existing = result[index];
                const merged = normalizeStopList([existing, stop])[0];
                const orderIds = [...(existing.orderIds || [])];
                const originalAddresses = [
                    ...(existing.originalAddresses || []),
                ];
                const originalAddressKeys = [
                    ...(existing.originalAddressKeys || []),
                ];

                for (const address of aliases.addresses) {
                    addUnique(originalAddresses, address);
                }
                for (const key of aliases.keys) {
                    addUnique(originalAddressKeys, key);
                }
                for (const orderId of stop.orderIds) {
                    addUnique(orderIds, orderId);
                }

                const combinedPay = mergeExpectedPay(
                    normalizedExpectedPay(existing),
                    pay,
                );
                result[index] = {
                    ...merged,
                    orderIds,
                    originalAddresses,
                    originalAddressKeys,
                    ...(combinedPay || {}),
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

        function isAddressInboxExportedToday(inbox, now = new Date()) {
            const updatedAt = inbox?.updatedAt
                ? new Date(inbox.updatedAt)
                : null;
            const currentDate = now instanceof Date ? now : new Date(now);

            if (
                !updatedAt ||
                Number.isNaN(updatedAt.getTime()) ||
                Number.isNaN(currentDate.getTime())
            ) {
                return false;
            }

            return (
                updatedAt.getFullYear() === currentDate.getFullYear() &&
                updatedAt.getMonth() === currentDate.getMonth() &&
                updatedAt.getDate() === currentDate.getDate()
            );
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
                    addressAliases: [
                        ...(stop.addressAliases || []),
                        stop.address,
                    ],
                    source: incoming.source || stop.source,
                });
            });

            const savedAliasOwnerByKey = new Map();
            const ambiguousSavedAliases = new Set();
            for (const stop of migratedSavedStops) {
                for (const alias of stop.addressAliases || []) {
                    const aliasKey = addressKey(alias);
                    const currentOwner = savedAliasOwnerByKey.get(aliasKey);
                    if (currentOwner && currentOwner.id !== stop.id) {
                        ambiguousSavedAliases.add(aliasKey);
                        savedAliasOwnerByKey.delete(aliasKey);
                    } else if (!ambiguousSavedAliases.has(aliasKey)) {
                        savedAliasOwnerByKey.set(aliasKey, stop);
                    }
                }
            }

            const resolvedIncomingStops = incomingStops.map((incoming) => {
                const aliasOwner = savedAliasOwnerByKey.get(
                    incoming.addressKey,
                );
                if (!aliasOwner) return incoming;

                const pay = normalizedExpectedPay(incoming);
                return {
                    ...aliasOwner,
                    source: incoming.source || aliasOwner.source,
                    orderIds: incoming.orderIds.slice(),
                    originalAddresses: [
                        ...(incoming.originalAddresses || []),
                    ],
                    originalAddressKeys: [
                        ...(incoming.originalAddressKeys || []),
                    ],
                    ...(pay || {}),
                };
            });
            const stops = normalizeStopList([
                ...migratedSavedStops,
                ...resolvedIncomingStops,
            ]);
            const idByAddress = new Map(
                stops.map((stop) => [stop.addressKey, stop.id]),
            );
            const routeIds = [];
            const orderIdsByStopId = {};
            const workbookPayByStopId = {};
            const selected = new Set();

            for (const stop of resolvedIncomingStops) {
                const id = idByAddress.get(addressKey(stop.address));
                if (!id) continue;
                if (!selected.has(id)) {
                    selected.add(id);
                    routeIds.push(id);
                }
                if (stop.orderIds.length > 0) {
                    const combinedOrderIds = orderIdsByStopId[id] || [];
                    for (const orderId of stop.orderIds) {
                        addUnique(combinedOrderIds, orderId);
                    }
                    orderIdsByStopId[id] = combinedOrderIds;
                }

                const pay = normalizedExpectedPay(stop);
                if (pay) {
                    workbookPayByStopId[id] = mergeExpectedPay(
                        workbookPayByStopId[id] || null,
                        pay,
                    );
                }
            }

            return {
                stops,
                routeIds,
                orderIdsByStopId,
                workbookPayByStopId,
                importedCount: routeIds.length,
            };
        }

        return Object.freeze({
            INBOX_APP,
            INBOX_SOURCE,
            INBOX_VERSION,
            applyAddressInbox,
            formatInboxImportStatus,
            isAddressInboxExportedToday,
            normalizeInboxAddresses,
            parseAddressInbox,
        });
    },
);
