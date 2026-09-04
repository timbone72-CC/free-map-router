"use strict";

const {
    buildBackendRequest,
    buildCoordinateRequest,
    validateBackendResponse,
} = require("./google-route-contract.js");

function durationSeconds(value) {
    if (typeof value !== "string" || !value.endsWith("s")) return null;
    const seconds = Number(value.slice(0, -1));
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

const TRAFFIC_WINDOW_HOURS = 24;
const LARGE_ROUTE_MIN_STOPS = 33;
const STANDARD_SOLVER_TIMEOUT = "30s";
const LARGE_ROUTE_SOLVER_TIMEOUT = "60s";

class GoogleRouteProviderError extends Error {
    constructor(code, message, statusCode = 422) {
        super(message);
        this.name = "GoogleRouteProviderError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

function solverTimeoutForStopCount(stopCount) {
    const count = Number(stopCount);
    return Number.isFinite(count) && count >= LARGE_ROUTE_MIN_STOPS
        ? LARGE_ROUTE_SOLVER_TIMEOUT
        : STANDARD_SOLVER_TIMEOUT;
}

function buildTrafficWindow(now = new Date()) {
    const start = new Date(now);
    if (!Number.isFinite(start.getTime())) {
        throw new TypeError("A valid traffic departure time is required.");
    }

    // Route Optimization requires globalEndTime to omit protobuf nanos.
    start.setUTCMilliseconds(0);

    const end = new Date(
        start.getTime() + TRAFFIC_WINDOW_HOURS * 60 * 60 * 1000,
    );
    return {
        globalStartTime: start.toISOString().replace(".000Z", "Z"),
        globalEndTime: end.toISOString().replace(".000Z", "Z"),
    };
}

function timeWindowForRequest(request, { now } = {}) {
    return request.timing
        ? {
              globalStartTime: request.timing.departureTime,
              globalEndTime: request.timing.homeByTime,
          }
        : buildTrafficWindow(now);
}

function stopServiceDurationSeconds(stop) {
    const value = stop?.serviceDurationSeconds;
    return Number.isInteger(value) && value >= 0 ? value : 0;
}

function buildGoogleOptimizeToursRequest(backendRequest, { now } = {}) {
    const request = buildCoordinateRequest(backendRequest);
    const trafficWindow = timeWindowForRequest(request, { now });
    const vehicle = {
        label: "field-vehicle",
        startLocation: {
            latitude: request.home.latitude,
            longitude: request.home.longitude,
        },
        endLocation: {
            latitude: request.home.latitude,
            longitude: request.home.longitude,
        },
        costPerTraveledHour: 1,
    };

    if (request.timing) {
        vehicle.startTimeWindows = [
            {
                startTime: request.timing.departureTime,
                endTime: request.timing.departureTime,
            },
        ];
        vehicle.endTimeWindows = [
            {
                startTime: request.timing.departureTime,
                endTime: request.timing.homeByTime,
            },
        ];
    }

    return {
        timeout: solverTimeoutForStopCount(request.stops.length),
        searchMode: "CONSUME_ALL_AVAILABLE_TIME",
        model: {
            ...trafficWindow,
            shipments: request.stops.map((stop) => ({
                label: stop.id,
                deliveries: [
                    {
                        label: stop.id,
                        arrivalLocation: {
                            latitude: stop.latitude,
                            longitude: stop.longitude,
                        },
                        duration: `${stopServiceDurationSeconds(stop)}s`,
                    },
                ],
            })),
            vehicles: [vehicle],
        },
        considerRoadTraffic: true,
        populatePolylines: false,
        populateTransitionPolylines: false,
    };
}

function visitStopId(request, visit) {
    const label = String(visit?.shipmentLabel ?? "").trim();
    if (label) return label;

    // Protocol Buffer JSON omits integer fields when their value is zero.
    // For the first shipment, an absent shipmentIndex therefore means index 0.
    const shipmentIndex =
        visit?.shipmentIndex === undefined
            ? 0
            : Number(visit.shipmentIndex);
    if (
        Number.isInteger(shipmentIndex) &&
        shipmentIndex >= 0 &&
        shipmentIndex < request.stops.length
    ) {
        return request.stops[shipmentIndex].id;
    }

    return "";
}

function skippedStopId(request, skipped) {
    const label = String(skipped?.label ?? "").trim();
    if (label) return label;

    const index = Number(skipped?.index);
    if (Number.isInteger(index) && index >= 0 && index < request.stops.length) {
        return request.stops[index].id;
    }

    return "unknown-skipped-stop";
}

function expectedServiceDurationSeconds(request) {
    return request.stops.reduce(
        (total, stop) => total + stopServiceDurationSeconds(stop),
        0,
    );
}

function timedSchedule(request, route, visits) {
    if (!request.timing) return null;

    const vehicleStartTime = String(route?.vehicleStartTime ?? "").trim();
    const vehicleEndTime = String(route?.vehicleEndTime ?? "").trim();
    const travelDurationSeconds =
        durationSeconds(route?.metrics?.travelDuration) ??
        durationSeconds(route?.metrics?.totalDuration);
    const waitDurationSeconds = durationSeconds(route?.metrics?.waitDuration) ?? 0;

    return {
        vehicleStartTime,
        vehicleEndTime,
        travelDurationSeconds,
        totalServiceDurationSeconds: expectedServiceDurationSeconds(request),
        waitDurationSeconds,
        visits: visits.map((visit) => ({
            stopId: visitStopId(request, visit),
            startTime: String(visit?.startTime ?? "").trim(),
        })),
    };
}

function interpretGoogleOptimizeToursResponse(backendRequest, googleResponse) {
    const request = buildBackendRequest(backendRequest);
    const routes = Array.isArray(googleResponse?.routes)
        ? googleResponse.routes
        : [];
    const skippedShipments = Array.isArray(googleResponse?.skippedShipments)
        ? googleResponse.skippedShipments
        : [];

    if (request.timing && skippedShipments.length > 0) {
        throw new GoogleRouteProviderError(
            "HOME_BY_CONFLICT",
            "Home By conflict: the selected work does not fit before the selected Home By time. No route was changed.",
            422,
        );
    }

    if (routes.length !== 1) {
        if (request.timing) {
            throw new GoogleRouteProviderError(
                "HOME_BY_CONFLICT",
                "Home By conflict: Google could not produce one complete route within the selected workday. No route was changed.",
                422,
            );
        }
        throw new Error(
            `Expected exactly one Google vehicle route but received ${routes.length}.`,
        );
    }

    const route = routes[0];
    const visits = Array.isArray(route?.visits) ? route.visits : [];
    const schedule = timedSchedule(request, route, visits);

    const providerResponse = {
        requestId: request.requestId,
        orderedStopIds: visits.map((visit) => visitStopId(request, visit)),
        skippedStopIds: skippedShipments.map((skipped) =>
            skippedStopId(request, skipped),
        ),
        totalDistanceMeters:
            route?.metrics?.travelDistanceMeters ??
            googleResponse?.metrics?.travelDistanceMeters ??
            null,
        totalDurationSeconds:
            durationSeconds(route?.metrics?.travelDuration) ??
            durationSeconds(route?.metrics?.totalDuration) ??
            durationSeconds(googleResponse?.metrics?.travelDuration) ??
            durationSeconds(googleResponse?.metrics?.totalDuration),
        ...(schedule ? { schedule } : {}),
    };

    try {
        return validateBackendResponse(request, providerResponse);
    } catch (error) {
        if (request.timing && error?.code === "HOME_BY_CONFLICT") {
            throw new GoogleRouteProviderError(
                "HOME_BY_CONFLICT",
                `Home By conflict: ${error.message} No route was changed.`,
                422,
            );
        }
        throw error;
    }
}

module.exports = {
    GoogleRouteProviderError,
    LARGE_ROUTE_MIN_STOPS,
    LARGE_ROUTE_SOLVER_TIMEOUT,
    STANDARD_SOLVER_TIMEOUT,
    buildGoogleOptimizeToursRequest,
    buildTrafficWindow,
    durationSeconds,
    interpretGoogleOptimizeToursResponse,
    solverTimeoutForStopCount,
};
