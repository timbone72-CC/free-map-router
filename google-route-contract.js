(function attachGoogleRouteContract(root, factory) {
    const contract = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = contract;
    }

    if (root) {
        root.FMRGoogleRouteContract = contract;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContract() {
    "use strict";

    const MAX_STOPS = 100;

    class RouteContractError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "RouteContractError";
            this.code = code;
        }
    }

    function fail(code, message) {
        throw new RouteContractError(code, message);
    }

    function normalizeId(value, fieldName) {
        const id = String(value ?? "").trim();
        if (!id) fail("MISSING_ID", `${fieldName} is required.`);
        if (id.length > 63) {
            fail("ID_TOO_LONG", `${fieldName} must be 63 characters or fewer.`);
        }
        return id;
    }

    function normalizeCoordinate(value, fieldName) {
        if (value === null || value === undefined || value === "") {
            fail("MISSING_COORDINATE", `${fieldName} is required.`);
        }

        const number = Number(value);
        if (!Number.isFinite(number)) {
            fail("INVALID_COORDINATE", `${fieldName} must be a finite number.`);
        }
        return number;
    }

    function normalizePoint(location, fieldName) {
        if (!location || typeof location !== "object") {
            fail("MISSING_POINT", `${fieldName} is required.`);
        }

        const latitude = normalizeCoordinate(
            location.latitude,
            `${fieldName}.latitude`,
        );
        const longitude = normalizeCoordinate(
            location.longitude,
            `${fieldName}.longitude`,
        );

        if (latitude < -90 || latitude > 90) {
            fail("INVALID_LATITUDE", `${fieldName}.latitude is out of range.`);
        }
        if (longitude < -180 || longitude > 180) {
            fail("INVALID_LONGITUDE", `${fieldName}.longitude is out of range.`);
        }

        return { latitude, longitude };
    }

    function normalizeStops(stops) {
        if (!Array.isArray(stops) || stops.length === 0) {
            fail("NO_STOPS", "At least one selected stop is required.");
        }
        if (stops.length > MAX_STOPS) {
            fail(
                "TOO_MANY_STOPS",
                `No more than ${MAX_STOPS} selected stops are allowed.`,
            );
        }

        const seen = new Set();
        return stops.map((stop, index) => {
            const id = normalizeId(stop?.id, `stops[${index}].id`);
            if (seen.has(id)) {
                fail("DUPLICATE_STOP_ID", `Duplicate selected stop ID: ${id}`);
            }
            seen.add(id);

            return {
                id,
                ...normalizePoint(stop, `stops[${index}]`),
            };
        });
    }

    function buildBackendRequest({ home, stops, requestId }) {
        const normalizedRequestId = normalizeId(requestId, "requestId");
        return {
            requestId: normalizedRequestId,
            home: normalizePoint(home, "home"),
            stops: normalizeStops(stops),
        };
    }

    function validateOrderedStopIds(expectedStopIds, orderedStopIds) {
        const expected = Array.isArray(expectedStopIds)
            ? expectedStopIds.map((id, index) =>
                  normalizeId(id, `expectedStopIds[${index}]`),
              )
            : [];
        const ordered = Array.isArray(orderedStopIds)
            ? orderedStopIds.map((id, index) =>
                  normalizeId(id, `orderedStopIds[${index}]`),
              )
            : [];

        if (ordered.length !== expected.length) {
            fail(
                "STOP_COUNT_MISMATCH",
                `Expected ${expected.length} ordered stops but received ${ordered.length}.`,
            );
        }

        const expectedSet = new Set(expected);
        const seen = new Set();

        for (const id of ordered) {
            if (!expectedSet.has(id)) {
                fail("UNKNOWN_STOP_ID", `Unknown ordered stop ID: ${id}`);
            }
            if (seen.has(id)) {
                fail("DUPLICATE_ORDERED_STOP_ID", `Duplicate ordered stop ID: ${id}`);
            }
            seen.add(id);
        }

        for (const id of expected) {
            if (!seen.has(id)) {
                fail("MISSING_ORDERED_STOP_ID", `Missing ordered stop ID: ${id}`);
            }
        }

        return ordered;
    }

    function optionalNonnegativeNumber(value, fieldName) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
            fail("INVALID_METRIC", `${fieldName} must be a nonnegative number.`);
        }
        return number;
    }

    function validateBackendResponse(request, response) {
        if (!request || typeof request !== "object") {
            fail("MISSING_REQUEST", "The original optimization request is required.");
        }
        if (!response || typeof response !== "object") {
            fail("MISSING_RESPONSE", "The optimization response is required.");
        }

        const requestId = normalizeId(response.requestId, "response.requestId");
        if (requestId !== request.requestId) {
            fail("REQUEST_ID_MISMATCH", "The optimization response does not match the request.");
        }

        const skippedStopIds = Array.isArray(response.skippedStopIds)
            ? response.skippedStopIds
                  .map((id, index) => normalizeId(id, `skippedStopIds[${index}]`))
            : [];
        if (skippedStopIds.length > 0) {
            fail(
                "SKIPPED_STOPS",
                `The provider skipped ${skippedStopIds.length} selected stop(s).`,
            );
        }

        const expectedIds = request.stops.map((stop) => stop.id);
        const orderedStopIds = validateOrderedStopIds(
            expectedIds,
            response.orderedStopIds,
        );

        return {
            requestId,
            orderedStopIds,
            skippedStopIds: [],
            totalDistanceMeters: optionalNonnegativeNumber(
                response.totalDistanceMeters,
                "totalDistanceMeters",
            ),
            totalDurationSeconds: optionalNonnegativeNumber(
                response.totalDurationSeconds,
                "totalDurationSeconds",
            ),
        };
    }

    function applyOrderedStopIds(stops, orderedStopIds) {
        const selected = Array.isArray(stops) ? stops.slice() : [];
        const expectedIds = selected.map((stop, index) =>
            normalizeId(stop?.id, `stops[${index}].id`),
        );
        const ordered = validateOrderedStopIds(expectedIds, orderedStopIds);
        const byId = new Map(selected.map((stop) => [String(stop.id).trim(), stop]));
        return ordered.map((id) => byId.get(id));
    }

    return {
        MAX_STOPS,
        RouteContractError,
        applyOrderedStopIds,
        buildBackendRequest,
        validateBackendResponse,
        validateOrderedStopIds,
    };
});
