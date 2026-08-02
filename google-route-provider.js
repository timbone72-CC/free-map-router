"use strict";

const {
    buildBackendRequest,
    validateBackendResponse,
} = require("./google-route-contract.js");

function durationSeconds(value) {
    if (typeof value !== "string" || !value.endsWith("s")) return null;
    const seconds = Number(value.slice(0, -1));
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function buildGoogleOptimizeToursRequest(backendRequest) {
    const request = buildBackendRequest(backendRequest);

    return {
        timeout: "30s",
        model: {
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
        considerRoadTraffic: false,
        populatePolylines: false,
        populateTransitionPolylines: false,
    };
}

function visitStopId(request, visit) {
    const label = String(visit?.shipmentLabel ?? "").trim();
    if (label) return label;

    const shipmentIndex = Number(visit?.shipmentIndex);
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
