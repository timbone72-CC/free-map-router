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
            normalizeStopList,
        } = contract;

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

            return {
                ...parsed,
                addresses: normalizeStopList(parsed.addresses),
            };
        }

        function applyAddressInbox(existingStops, inbox) {
            const savedStops = normalizeStopList(existingStops);
            const incomingStops = normalizeStopList(inbox?.addresses);
            const stops = normalizeStopList([
                ...savedStops,
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
            parseAddressInbox,
        });
    },
);
