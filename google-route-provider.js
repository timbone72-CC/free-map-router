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

function buildTrafficWindow(now = new Date()) {
    const start = new Date(now);
    if (!Number.isFinite(start.getTime())) {
        throw new TypeError("A valid traffic departure time is required.");
    }

    const end = new Date(
        start.getTime() + TRAFFIC_WINDOW_HOURS * 60 * 60 * 1000,
    );
    return {
        globalStartTime: start.toISOString(),
        globalEndTime: end.toISOString(),
    };
}

function buildGoogleOptimizeToursRequest(backendRequest, { now } = {}) {
    const request = buildCoordinateRequest(backendRequest);
    const trafficWindow = buildTrafficWindow(now);

    return {
        timeout: "30s",
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
                        duration: "0s",
                    },
                ],
            })),
            vehicles: [
                {
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
                },
            ],
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

function interpretGoogleOptimizeToursResponse(backendRequest, googleResponse) {
    const request = buildBackendRequest(backendRequest);
    const routes = Array.isArray(googleResponse?.routes)
        ? googleResponse.routes
        : [];

    if (routes.length !== 1) {
        throw new Error(
            `Expected exactly one Google vehicle route but received ${routes.length}.`,
        );
    }

    const route = routes[0];
    const visits = Array.isArray(route?.visits) ? route.visits : [];
    const skippedShipments = Array.isArray(googleResponse?.skippedShipments)
        ? googleResponse.skippedShipments
        : [];

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
    };

    return validateBackendResponse(request, providerResponse);
}

module.exports = {
    buildGoogleOptimizeToursRequest,
    interpretGoogleOptimizeToursResponse,
};
