(function attachPlannerModel(root, factory) {
    const plannerModel = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = plannerModel;
    }

    if (root) {
        root.FMRPlannerModel = plannerModel;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildPlannerModelModule() {
    "use strict";

    const ROUTE_SLOTS = new Set(["google", "basic"]);

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function uniqueIds(values) {
        const result = [];
        const seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const id = text(value);
            if (!id || seen.has(id)) continue;
            seen.add(id);
            result.push(id);
        }
        return result;
    }

    function routeSlot(value) {
        const slot = text(value).toLowerCase();
        return ROUTE_SLOTS.has(slot) ? slot : "google";
    }

    function finiteNonnegative(value) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : null;
    }

    function validCoordinate(value, minimum, maximum) {
        if (value === null || value === undefined || text(value) === "") return null;
        const number = Number(value);
        return Number.isFinite(number) && number >= minimum && number <= maximum
            ? number
            : null;
    }

    function displayCoordinates(stop) {
        const latitude = validCoordinate(stop?.latitude, -90, 90);
        const longitude = validCoordinate(stop?.longitude, -180, 180);
        if (latitude === null || longitude === null) return null;
        return { latitude, longitude };
    }

    function approvedRouteSource(stop) {
        const source = text(stop?.source).toUpperCase();
        if (source === "DCFS" || source === "GIS") return source;

        const searchable = [stop?.label, stop?.notes]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();
        if (/\bDCFS\b/.test(searchable)) return "DCFS";
        if (/\bGIS\b/.test(searchable)) return "GIS";
        return "";
    }

    function workItemKey(kind, workItemId) {
        return `${text(kind).toLowerCase()}:${text(workItemId)}`;
    }

    function primitiveWorkItemDetail(value) {
        if (!value || typeof value !== "object") return {};
        const expectedPay = finiteNonnegative(value.expectedPay);
        return {
            source: text(value.source),
            workOrderId: text(value.workOrderId) || null,
            expectedPay,
            dueDate: text(value.dueDate) || null,
            completedDate: text(value.completedDate) || null,
            notes: text(value.notes),
        };
    }

    function normalizedProjectionStop(routeSnapshot, projectionByStopId, stopId) {
        const projected = projectionByStopId.get(stopId) || null;
        if (projected) {
            const items = (Array.isArray(projected.items) ? projected.items : [])
                .map((item) => ({
                    kind: text(item?.kind).toLowerCase(),
                    workItemId: text(item?.workItemId),
                    serviceMinutes:
                        item?.serviceMinutes === null
                            ? null
                            : finiteNonnegative(item?.serviceMinutes),
                    serviceMinutesOverride:
                        item?.serviceMinutesOverride === null ||
                        item?.serviceMinutesOverride === undefined
                            ? null
                            : finiteNonnegative(item?.serviceMinutesOverride),
                    assignedDate: text(item?.assignedDate) || null,
                    lockedDay: item?.lockedDay === true,
                    planningRevision:
                        Number.isInteger(Number(item?.planningRevision)) &&
                        Number(item?.planningRevision) > 0
                            ? Number(item.planningRevision)
                            : null,
                    planningUpdatedAt: text(item?.planningUpdatedAt) || null,
                }))
                .filter(
                    (item) =>
                        (item.kind === "workbook" || item.kind === "gig") &&
                        Boolean(item.workItemId),
                );

            let knownServiceMinutes = 0;
            let complete = projected.complete === true;
            for (const item of items) {
                if (item.serviceMinutes === null) {
                    complete = false;
                } else {
                    knownServiceMinutes += item.serviceMinutes;
                }
            }

            return {
                items,
                knownServiceMinutes,
                serviceMinutes: complete ? knownServiceMinutes : null,
                complete,
            };
        }

        const workbookIds = uniqueIds(routeSnapshot?.orderIdsByStopId?.[stopId]);
        const gigIds = uniqueIds(routeSnapshot?.gigIdsByStopId?.[stopId]);
        const items = [
            ...workbookIds.map((workItemId) => ({
                kind: "workbook",
                workItemId,
                serviceMinutes: null,
                serviceMinutesOverride: null,
                assignedDate: null,
                lockedDay: false,
                planningRevision: null,
                planningUpdatedAt: null,
            })),
            ...gigIds.map((workItemId) => ({
                kind: "gig",
                workItemId,
                serviceMinutes: null,
                serviceMinutesOverride: null,
                assignedDate: null,
                lockedDay: false,
                planningRevision: null,
                planningUpdatedAt: null,
            })),
        ];

        return {
            items,
            knownServiceMinutes: 0,
            serviceMinutes: items.length === 0 ? 0 : null,
            complete: items.length === 0,
        };
    }

    function exactRouteIdsMatch(visits, routeIds) {
        if (!Array.isArray(visits) || visits.length !== routeIds.length) return false;
        return visits.every(
            (visit, index) => text(visit?.stopId) === routeIds[index],
        );
    }

    function validTimestamp(value) {
        const raw = text(value);
        if (!raw) return null;
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? null : raw;
    }

    function copiedCurrentSchedule(routeSlotValue, routeSnapshot, currentBasisKey) {
        const slot = routeSlot(routeSlotValue);
        if (slot !== "google") return null;
        if (text(routeSnapshot?.optimizationStatus) !== "google_optimized") return null;

        const schedule = routeSnapshot?.schedule;
        const basisKey = text(currentBasisKey);
        if (
            !schedule ||
            typeof schedule !== "object" ||
            !basisKey ||
            text(schedule.basisKey) !== basisKey
        ) {
            return null;
        }

        const routeIds = uniqueIds(routeSnapshot?.routeIds);
        const visits = Array.isArray(schedule.visits) ? schedule.visits : [];
        const vehicleStartTime = validTimestamp(schedule.vehicleStartTime);
        const vehicleEndTime = validTimestamp(schedule.vehicleEndTime);
        const travelDurationSeconds = finiteNonnegative(
            schedule.travelDurationSeconds,
        );
        const totalServiceDurationSeconds = finiteNonnegative(
            schedule.totalServiceDurationSeconds,
        );
        const waitDurationSeconds = finiteNonnegative(schedule.waitDurationSeconds);

        if (
            !vehicleStartTime ||
            !vehicleEndTime ||
            travelDurationSeconds === null ||
            totalServiceDurationSeconds === null ||
            waitDurationSeconds === null ||
            !exactRouteIdsMatch(visits, routeIds) ||
            visits.some((visit) => !validTimestamp(visit?.startTime))
        ) {
            return null;
        }

        return {
            basisKey,
            vehicleStartTime,
            vehicleEndTime,
            travelDurationSeconds,
            totalServiceDurationSeconds,
            waitDurationSeconds,
            visits: visits.map((visit) => ({
                stopId: text(visit.stopId),
                startTime: text(visit.startTime),
            })),
        };
    }

    function parseLocalTimeMinutes(value) {
        const match = /^(\d{2}):(\d{2})$/.exec(text(value));
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return hour * 60 + minute;
    }

    function routeDateEpoch(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const epoch = Date.UTC(year, month - 1, day);
        const check = new Date(epoch);
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) {
            return null;
        }
        return epoch;
    }

    function localRouteMinutes(instant, dayContext) {
        const timestamp = validTimestamp(instant);
        const routeEpoch = routeDateEpoch(dayContext?.routeDate);
        const timeZone = text(dayContext?.timeZone);
        if (!timestamp || routeEpoch === null || !timeZone) return null;

        let formatter;
        try {
            formatter = new Intl.DateTimeFormat("en-US", {
                timeZone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
            });
        } catch {
            return null;
        }

        const parts = {};
        for (const part of formatter.formatToParts(new Date(timestamp))) {
            if (part.type !== "literal") parts[part.type] = Number(part.value);
        }
        const localEpoch = Date.UTC(parts.year, parts.month - 1, parts.day);
        const dayDelta = Math.round((localEpoch - routeEpoch) / 86400000);
        return (
            dayDelta * 1440 +
            parts.hour * 60 +
            parts.minute +
            parts.second / 60
        );
    }

    function finishInstant(startTime, serviceMinutes) {
        const start = validTimestamp(startTime);
        const minutes = finiteNonnegative(serviceMinutes);
        if (!start || minutes === null) return null;
        const end = new Date(new Date(start).getTime() + minutes * 60000);
        return Number.isNaN(end.getTime()) ? null : end.toISOString();
    }

    function timingStatus(actualInstant, targetTime, dayContext) {
        const actualMinutes = localRouteMinutes(actualInstant, dayContext);
        const targetMinutes = parseLocalTimeMinutes(targetTime);
        if (actualMinutes === null || targetMinutes === null) {
            return { status: "unavailable", overrunMinutes: null };
        }
        const difference = actualMinutes - targetMinutes;
        return difference > 0
            ? { status: "overrun", overrunMinutes: Math.ceil(difference) }
            : { status: "met", overrunMinutes: 0 };
    }

    function normalizedPaySummary(paySummary, representedWorkCount) {
        const hasInput = paySummary && typeof paySummary === "object";
        const totalKnownExpectedPay = finiteNonnegative(
            paySummary?.totalKnownExpectedPay,
        );
        const hasRepresentedWork = representedWorkCount > 0;
        let payIncomplete = hasInput
            ? paySummary.payIncomplete === true
            : hasRepresentedWork;

        if (hasRepresentedWork && paySummary?.hasRepresentedWork !== true) {
            payIncomplete = true;
        }
        if (hasRepresentedWork && totalKnownExpectedPay === null) {
            payIncomplete = true;
        }

        return {
            totalKnownExpectedPay: totalKnownExpectedPay ?? 0,
            payComplete: !payIncomplete,
            payIncomplete,
            hasRepresentedWork,
        };
    }

    function buildPlannerModel(input = {}) {
        const slot = routeSlot(input.routeSlot);
        const routeSnapshot =
            input.routeSnapshot && typeof input.routeSnapshot === "object"
                ? input.routeSnapshot
                : {};
        const routeIds = uniqueIds(routeSnapshot.routeIds);
        const stopsById = new Map(
            (Array.isArray(input.savedStops) ? input.savedStops : [])
                .map((stop) => [text(stop?.id), stop])
                .filter(([id]) => Boolean(id)),
        );
        const projectionByStopId = new Map(
            (Array.isArray(input.routePlanningProjection?.stops)
                ? input.routePlanningProjection.stops
                : []
            )
                .map((stop) => [text(stop?.stopId), stop])
                .filter(([stopId]) => Boolean(stopId)),
        );
        const workItemDetails =
            input.workItemDetails && typeof input.workItemDetails === "object"
                ? input.workItemDetails
                : {};

        let schedule = copiedCurrentSchedule(
            slot,
            routeSnapshot,
            input.currentScheduleBasisKey,
        );

        const stopCards = routeIds.map((stopId, index) => {
            const stop = stopsById.get(stopId) || null;
            const projection = normalizedProjectionStop(
                routeSnapshot,
                projectionByStopId,
                stopId,
            );
            const coordinates = displayCoordinates(stop);
            const workItems = projection.items.map((item) => ({
                ...item,
                ...primitiveWorkItemDetail(
                    workItemDetails[workItemKey(item.kind, item.workItemId)],
                ),
            }));

            return {
                routeNumber: index + 1,
                stopId,
                address: text(stop?.address),
                source: approvedRouteSource(stop),
                mapPlottable: Boolean(coordinates),
                coordinates,
                etaTime: schedule?.visits?.[index]?.startTime || null,
                workItemCount: workItems.length,
                serviceMinutes: projection.serviceMinutes,
                knownServiceMinutes: projection.knownServiceMinutes,
                serviceComplete: projection.complete,
                workItems,
            };
        });

        const workItemCount = stopCards.reduce(
            (sum, card) => sum + card.workItemCount,
            0,
        );
        const knownServiceMinutes = stopCards.reduce(
            (sum, card) => sum + card.knownServiceMinutes,
            0,
        );
        const serviceComplete = stopCards.every((card) => card.serviceComplete);
        const totalServiceSeconds = Math.round(knownServiceMinutes * 60);
        if (
            schedule &&
            (!serviceComplete ||
                Math.abs(
                    Number(schedule.totalServiceDurationSeconds) - totalServiceSeconds,
                ) > 1e-9)
        ) {
            schedule = null;
            for (const card of stopCards) card.etaTime = null;
        }

        const pay = normalizedPaySummary(input.paySummary, workItemCount);
        const unplottableStopIds = stopCards
            .filter((card) => !card.mapPlottable)
            .map((card) => card.stopId);
        const mapPlottableStopIds = stopCards
            .filter((card) => card.mapPlottable)
            .map((card) => card.stopId);

        let fieldWorkFinishTime = null;
        if (schedule) {
            for (let index = stopCards.length - 1; index >= 0; index -= 1) {
                const card = stopCards[index];
                if (card.workItemCount === 0) continue;
                if (!card.serviceComplete) break;
                fieldWorkFinishTime = finishInstant(
                    card.etaTime,
                    card.serviceMinutes,
                );
                break;
            }
        }

        const dayContext =
            input.dayContext && typeof input.dayContext === "object"
                ? {
                      routeDate: text(input.dayContext.routeDate) || null,
                      departureTime: text(input.dayContext.departureTime) || null,
                      preferredFinishTime:
                          text(input.dayContext.preferredFinishTime) || null,
                      homeByTime: text(input.dayContext.homeByTime) || null,
                      timeZone: text(input.dayContext.timeZone) || null,
                  }
                : null;

        const preferredFinish = schedule
            ? timingStatus(
                  fieldWorkFinishTime,
                  dayContext?.preferredFinishTime,
                  dayContext,
              )
            : { status: "unavailable", overrunMinutes: null };
        const homeBy = schedule
            ? timingStatus(
                  schedule.vehicleEndTime,
                  dayContext?.homeByTime,
                  dayContext,
              )
            : { status: "unavailable", overrunMinutes: null };

        const timingConfidence = schedule
            ? {
                  status: "google_current",
                  scheduleCurrent: true,
                  trafficAware: true,
                  reason: "",
              }
            : slot === "basic"
              ? {
                    status: "basic_unavailable",
                    scheduleCurrent: false,
                    trafficAware: false,
                    reason: "Basic Route has no traffic-aware Google schedule.",
                }
              : {
                    status: "google_unavailable",
                    scheduleCurrent: false,
                    trafficAware: false,
                    reason: routeSnapshot?.schedule
                        ? "The saved Google schedule is stale or does not match the current planning basis."
                        : "No current Google schedule is available.",
                };

        return {
            daySummary: {
                routeSlot: slot,
                optimizationStatus:
                    text(routeSnapshot.optimizationStatus) || "not_optimized",
                routeDate: dayContext?.routeDate || null,
                departureTime: dayContext?.departureTime || null,
                workItemCount,
                physicalStopCount: stopCards.length,
                expectedPayKnown: pay.totalKnownExpectedPay,
                payComplete: pay.payComplete,
                payIncomplete: pay.payIncomplete,
                hasRepresentedWork: pay.hasRepresentedWork,
                knownServiceMinutes,
                serviceMinutes: serviceComplete ? knownServiceMinutes : null,
                serviceComplete,
                travelDurationSeconds: schedule?.travelDurationSeconds ?? null,
                fieldWorkFinishTime,
                homeTime: schedule?.vehicleEndTime ?? null,
                preferredFinishStatus: preferredFinish.status,
                preferredFinishOverrunMinutes: preferredFinish.overrunMinutes,
                homeByStatus:
                    homeBy.status === "overrun" ? "conflict" : homeBy.status,
                homeByConflictMinutes: homeBy.overrunMinutes,
                unplottableStopCount: unplottableStopIds.length,
                timingConfidence,
            },
            stopCards,
            mapPlottableStopIds,
            unplottableStopIds,
            timingConfidence,
        };
    }

    return Object.freeze({
        approvedRouteSource,
        buildPlannerModel,
        copiedCurrentSchedule,
        displayCoordinates,
        workItemKey,
    });
});
