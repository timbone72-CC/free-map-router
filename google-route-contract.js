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
    const MAX_ADDRESS_LENGTH = 500;
    const WHOLE_SECOND_RFC3339 =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

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

    function normalizeAddress(value, fieldName) {
        const address = String(value ?? "").trim();
        if (!address) fail("MISSING_ADDRESS", `${fieldName} is required.`);
        if (address.length > MAX_ADDRESS_LENGTH) {
            fail(
                "ADDRESS_TOO_LONG",
                `${fieldName} must be ${MAX_ADDRESS_LENGTH} characters or fewer.`,
            );
        }
        return address;
    }

    function hasCoordinateValue(value) {
        return value !== null && value !== undefined && value !== "";
    }

    function normalizeStopLocation(stop, fieldName) {
        const hasAddress = String(stop?.address ?? "").trim() !== "";
        const hasLatitude = hasCoordinateValue(stop?.latitude);
        const hasLongitude = hasCoordinateValue(stop?.longitude);

        if (hasAddress && (hasLatitude || hasLongitude)) {
            fail(
                "AMBIGUOUS_STOP_LOCATION",
                `${fieldName} must use either an address or coordinates, not both.`,
            );
        }

        if (hasAddress) {
            return { address: normalizeAddress(stop.address, `${fieldName}.address`) };
        }

        return normalizePoint(stop, fieldName);
    }

    function optionalWholeNonnegativeNumber(value, fieldName) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0) {
            fail(
                "INVALID_SERVICE_DURATION",
                `${fieldName} must be a nonnegative whole number of seconds.`,
            );
        }
        return number;
    }

    function normalizeStops(stops, locationNormalizer = normalizeStopLocation) {
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

            const serviceDurationSeconds = optionalWholeNonnegativeNumber(
                stop?.serviceDurationSeconds,
                `stops[${index}].serviceDurationSeconds`,
            );
            return {
                id,
                ...locationNormalizer(stop, `stops[${index}]`),
                ...(serviceDurationSeconds === null
                    ? {}
                    : { serviceDurationSeconds }),
            };
        });
    }

    function normalizeWholeSecondTimestamp(value, fieldName) {
        const raw = String(value ?? "").trim();
        if (!WHOLE_SECOND_RFC3339.test(raw)) {
            fail(
                "INVALID_ROUTE_TIME",
                `${fieldName} must be a whole-second RFC3339 timestamp.`,
            );
        }
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            fail("INVALID_ROUTE_TIME", `${fieldName} is not a valid timestamp.`);
        }
        return date.toISOString().replace(".000Z", "Z");
    }

    function normalizeTiming(value) {
        if (value === null || value === undefined) return null;
        if (typeof value !== "object") {
            fail("INVALID_TIMING", "timing must be an object.");
        }
        const departureTime = normalizeWholeSecondTimestamp(
            value.departureTime,
            "timing.departureTime",
        );
        const homeByTime = normalizeWholeSecondTimestamp(
            value.homeByTime,
            "timing.homeByTime",
        );
        if (new Date(departureTime).getTime() >= new Date(homeByTime).getTime()) {
            fail("INVALID_TIMING", "timing.homeByTime must be later than timing.departureTime.");
        }
        return { departureTime, homeByTime };
    }

    function requireTimedStopDurations(stops, timing) {
        if (!timing) return;
        for (let index = 0; index < stops.length; index += 1) {
            if (!Object.hasOwn(stops[index], "serviceDurationSeconds")) {
                fail(
                    "MISSING_SERVICE_DURATION",
                    `stops[${index}].serviceDurationSeconds is required for a time-aware request.`,
                );
            }
        }
    }

    function buildBackendRequest({ home, stops, requestId, timing }) {
        const normalizedRequestId = normalizeId(requestId, "requestId");
        const normalizedStops = normalizeStops(stops);
        const normalizedTiming = normalizeTiming(timing);
        requireTimedStopDurations(normalizedStops, normalizedTiming);
        return {
            requestId: normalizedRequestId,
            home: normalizePoint(home, "home"),
            stops: normalizedStops,
            ...(normalizedTiming ? { timing: normalizedTiming } : {}),
        };
    }

    function buildCoordinateRequest({ home, stops, requestId, timing }) {
        const normalizedRequestId = normalizeId(requestId, "requestId");
        const normalizedStops = normalizeStops(stops, normalizePoint);
        const normalizedTiming = normalizeTiming(timing);
        requireTimedStopDurations(normalizedStops, normalizedTiming);
        return {
            requestId: normalizedRequestId,
            home: normalizePoint(home, "home"),
            stops: normalizedStops,
            ...(normalizedTiming ? { timing: normalizedTiming } : {}),
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

    function requiredNonnegativeNumber(value, fieldName) {
        const number = optionalNonnegativeNumber(value, fieldName);
        if (number === null) {
            fail("MISSING_SCHEDULE_METRIC", `${fieldName} is required.`);
        }
        return number;
    }

    function expectedServiceDurationSeconds(request) {
        return request.stops.reduce(
            (total, stop) => total + Number(stop.serviceDurationSeconds || 0),
            0,
        );
    }

    function normalizeSchedule(request, orderedStopIds, value) {
        if (value === null || value === undefined) {
            if (request.timing) {
                fail("MISSING_SCHEDULE", "A time-aware optimization response must include schedule data.");
            }
            return null;
        }
        if (!value || typeof value !== "object") {
            fail("INVALID_SCHEDULE", "schedule must be an object.");
        }

        const vehicleStartTime = normalizeWholeSecondTimestamp(
            value.vehicleStartTime,
            "schedule.vehicleStartTime",
        );
        const vehicleEndTime = normalizeWholeSecondTimestamp(
            value.vehicleEndTime,
            "schedule.vehicleEndTime",
        );
        const visits = Array.isArray(value.visits) ? value.visits : [];
        if (visits.length !== orderedStopIds.length) {
            fail(
                "SCHEDULE_STOP_COUNT_MISMATCH",
                `Expected ${orderedStopIds.length} scheduled visits but received ${visits.length}.`,
            );
        }

        const normalizedVisits = visits.map((visit, index) => ({
            stopId: normalizeId(visit?.stopId, `schedule.visits[${index}].stopId`),
            startTime: normalizeWholeSecondTimestamp(
                visit?.startTime,
                `schedule.visits[${index}].startTime`,
            ),
        }));
        const scheduledIds = validateOrderedStopIds(
            orderedStopIds,
            normalizedVisits.map((visit) => visit.stopId),
        );
        for (let index = 0; index < orderedStopIds.length; index += 1) {
            if (scheduledIds[index] !== orderedStopIds[index]) {
                fail(
                    "SCHEDULE_ORDER_MISMATCH",
                    "Scheduled visits must follow the accepted route order.",
                );
            }
        }

        const travelDurationSeconds = requiredNonnegativeNumber(
            value.travelDurationSeconds,
            "schedule.travelDurationSeconds",
        );
        const totalServiceDurationSeconds = requiredNonnegativeNumber(
            value.totalServiceDurationSeconds,
            "schedule.totalServiceDurationSeconds",
        );
        const waitDurationSeconds = requiredNonnegativeNumber(
            value.waitDurationSeconds,
            "schedule.waitDurationSeconds",
        );
        const expectedService = expectedServiceDurationSeconds(request);
        if (totalServiceDurationSeconds !== expectedService) {
            fail(
                "SCHEDULE_SERVICE_MISMATCH",
                `Schedule service duration ${totalServiceDurationSeconds}s does not match requested service duration ${expectedService}s.`,
            );
        }

        if (request.timing) {
            if (vehicleStartTime !== request.timing.departureTime) {
                fail(
                    "SCHEDULE_START_MISMATCH",
                    "The Google schedule did not start at the selected departure time.",
                );
            }
            if (
                new Date(vehicleEndTime).getTime() >
                new Date(request.timing.homeByTime).getTime()
            ) {
                fail(
                    "HOME_BY_CONFLICT",
                    "The Google schedule returns Home after the selected Home By time.",
                );
            }
        }
        if (new Date(vehicleEndTime).getTime() < new Date(vehicleStartTime).getTime()) {
            fail("INVALID_SCHEDULE", "The Google schedule ends before it starts.");
        }

        return {
            vehicleStartTime,
            vehicleEndTime,
            travelDurationSeconds,
            totalServiceDurationSeconds,
            waitDurationSeconds,
            visits: normalizedVisits,
        };
    }

    function validateBackendResponse(request, response) {
        if (!request || typeof request !== "object") {
            fail("MISSING_REQUEST", "The original optimization request is required.");
        }
        if (!response || typeof response !== "object") {
            fail("MISSING_RESPONSE", "The optimization response is required.");
        }

        const normalizedRequest = request.timing
            ? buildBackendRequest(request)
            : buildBackendRequest(request);
        const requestId = normalizeId(response.requestId, "response.requestId");
        if (requestId !== normalizedRequest.requestId) {
            fail("REQUEST_ID_MISMATCH", "The optimization response does not match the request.");
        }

        const skippedStopIds = Array.isArray(response.skippedStopIds)
            ? response.skippedStopIds
                  .map((id, index) => normalizeId(id, `skippedStopIds[${index}]`))
            : [];
        if (skippedStopIds.length > 0) {
            fail(
                normalizedRequest.timing ? "HOME_BY_CONFLICT" : "SKIPPED_STOPS",
                normalizedRequest.timing
                    ? "The selected work does not fit before the Home By time."
                    : `The provider skipped ${skippedStopIds.length} selected stop(s).`,
            );
        }

        const expectedIds = normalizedRequest.stops.map((stop) => stop.id);
        const orderedStopIds = validateOrderedStopIds(
            expectedIds,
            response.orderedStopIds,
        );
        const schedule = normalizeSchedule(
            normalizedRequest,
            orderedStopIds,
            response.schedule,
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
            ...(schedule ? { schedule } : {}),
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
        MAX_ADDRESS_LENGTH,
        MAX_STOPS,
        RouteContractError,
        applyOrderedStopIds,
        buildBackendRequest,
        buildCoordinateRequest,
        normalizeTiming,
        normalizeWholeSecondTimestamp,
        validateBackendResponse,
        validateOrderedStopIds,
    };
});
