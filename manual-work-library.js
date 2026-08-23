(function attachManualWorkLibrary(root, factory) {
    const stopContract =
        typeof module === "object" && module.exports
            ? require("./contract.js")
            : root?.FMRContract;
    const gigContract =
        typeof module === "object" && module.exports
            ? require("./gig-contract.js")
            : root?.FMRGigContract;
    const library = factory(stopContract, gigContract);

    if (typeof module === "object" && module.exports) {
        module.exports = library;
    }

    if (root) root.FMRManualWorkLibrary = library;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildManualWorkLibrary(stopContract, gigContract) {
    "use strict";

    const MANUAL_WORK_APP = "free-map-router";
    const MANUAL_WORK_VERSION = 2;
    const LEGACY_MANUAL_WORK_VERSION = 1;
    const MANUAL_WORK_STORAGE_KEY = "fmr_v1_manual_work_library";
    const DEFAULT_ALERT_LEAD_DAYS = 4;
    const MAX_RECURRENCE_COUNT = 365;
    const VALID_RECURRENCE_UNITS = new Set(["days", "weeks", "months"]);
    const DAY_MS = 24 * 60 * 60 * 1000;

    if (!stopContract) {
        throw new Error("Free Map Router stop contract failed to load.");
    }
    if (!gigContract) {
        throw new Error("Free Map Router gig contract failed to load.");
    }

    const {
        addressKey,
        normalizeAddress,
        normalizeAddressAliases,
        normalizeCoordinates,
        normalizeStop,
        normalizeStopList,
    } = stopContract;
    const { normalizeExpectedPay, normalizeGigSource } = gigContract;

    function text(value) {
        return (value ?? "").toString().trim();
    }

    function timestamp(value, fallback = "") {
        const raw = text(value);
        if (!raw) return fallback;
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
    }

    function nowIso(now = new Date()) {
        return new Date(now).toISOString();
    }

    function makeId(prefix, idFactory) {
        if (typeof idFactory === "function") return text(idFactory());
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return `${prefix}_${crypto.randomUUID()}`;
        }
        return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    }

    function pinRank(value) {
        if (value === "manual") return 3;
        if (value === "geocoded") return 2;
        return 1;
    }

    function parseCalendarDate(value) {
        const raw = text(value);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) {
            return null;
        }
        return { raw, year, month, day };
    }

    function normalizeCalendarDate(value) {
        return parseCalendarDate(value)?.raw || "";
    }

    function localCalendarDate(now = new Date()) {
        const date = new Date(now);
        if (Number.isNaN(date.getTime())) return "";
        const year = String(date.getFullYear()).padStart(4, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function calendarOrdinal(value) {
        const parsed = parseCalendarDate(value);
        if (!parsed) return null;
        return Math.floor(
            Date.UTC(parsed.year, parsed.month - 1, parsed.day) / DAY_MS,
        );
    }

    function calendarDateFromOrdinal(ordinal) {
        const date = new Date(Number(ordinal) * DAY_MS);
        const year = String(date.getUTCFullYear()).padStart(4, "0");
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month, 0)).getUTCDate();
    }

    function addMonthsAnchored(value, count, anchorDay) {
        const parsed = parseCalendarDate(value);
        if (!parsed) return "";
        const zeroMonth = parsed.month - 1 + count;
        const year = parsed.year + Math.floor(zeroMonth / 12);
        const monthIndex = ((zeroMonth % 12) + 12) % 12;
        const month = monthIndex + 1;
        const day = Math.min(
            Math.max(1, Number(anchorDay) || parsed.day),
            daysInMonth(year, month),
        );
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    function normalizeProperty(raw, options = {}) {
        const address = normalizeAddress(raw?.address);
        const id = text(raw?.propertyId);
        if (!address || !id) return null;

        const coordinates = normalizeCoordinates(raw?.latitude, raw?.longitude);
        const pinStatus =
            coordinates.latitude === null
                ? "unverified"
                : raw?.pinStatus === "manual"
                  ? "manual"
                  : "geocoded";

        return {
            propertyId: id,
            address,
            addressKey: addressKey(address),
            addressAliases: normalizeAddressAliases(raw?.addressAliases, address),
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            placeId: text(raw?.placeId),
            pinStatus,
            archived: Boolean(raw?.archived),
            updatedAt: timestamp(raw?.updatedAt, options.defaultUpdatedAt || ""),
        };
    }

    function normalizeRecurrenceCount(value) {
        const count = Number(value);
        if (
            !Number.isInteger(count) ||
            count < 1 ||
            count > MAX_RECURRENCE_COUNT
        ) {
            throw new Error(
                `Repeat cadence must be a whole number from 1 through ${MAX_RECURRENCE_COUNT}.`,
            );
        }
        return count;
    }

    function normalizeRecurrenceUnit(value) {
        const unit = text(value).toLowerCase();
        if (!VALID_RECURRENCE_UNITS.has(unit)) {
            throw new Error("Repeat cadence must use days, weeks, or months.");
        }
        return unit;
    }

    function normalizeTemplate(raw, options = {}) {
        if (!raw || typeof raw !== "object") return null;
        const id = text(raw.templateId);
        const propertyId = text(raw.propertyId);
        if (!id || !propertyId) return null;

        let expectedPay;
        let recurrenceCount;
        let recurrenceUnit;
        try {
            expectedPay = normalizeExpectedPay(raw.expectedPay);
            recurrenceCount = normalizeRecurrenceCount(raw.recurrenceCount);
            recurrenceUnit = normalizeRecurrenceUnit(raw.recurrenceUnit);
        } catch (error) {
            if (options.skipInvalid) return null;
            throw error;
        }

        const nextDueDate = normalizeCalendarDate(raw.nextDueDate);
        if (!nextDueDate) {
            if (options.skipInvalid) return null;
            throw new Error("Next due date must be a valid calendar date.");
        }

        const parsedDue = parseCalendarDate(nextDueDate);
        const monthAnchorDay =
            recurrenceUnit === "months"
                ? Math.min(
                      31,
                      Math.max(
                          1,
                          Number.isInteger(Number(raw.monthAnchorDay))
                              ? Number(raw.monthAnchorDay)
                              : parsedDue.day,
                      ),
                  )
                : null;

        return {
            templateId: id,
            propertyId,
            source: normalizeGigSource(raw.source),
            expectedPay,
            notes: text(raw.notes),
            recurrenceCount,
            recurrenceUnit,
            nextDueDate,
            monthAnchorDay,
            alertLeadDays: DEFAULT_ALERT_LEAD_DAYS,
            active: raw.active !== false,
            updatedAt: timestamp(raw.updatedAt, options.defaultUpdatedAt || ""),
        };
    }

    function compareUpdated(left, right) {
        const leftTime = Date.parse(left?.updatedAt || "") || 0;
        const rightTime = Date.parse(right?.updatedAt || "") || 0;
        return leftTime - rightTime;
    }

    function mergePropertyDetails(preferred, other) {
        const stronger =
            pinRank(other?.pinStatus) > pinRank(preferred?.pinStatus)
                ? other
                : preferred;
        return normalizeProperty({
            ...preferred,
            addressAliases: [
                ...(preferred?.addressAliases || []),
                ...(other?.addressAliases || []),
                other?.address,
            ],
            latitude: stronger?.latitude,
            longitude: stronger?.longitude,
            placeId: stronger?.placeId || preferred?.placeId || other?.placeId,
            pinStatus: stronger?.pinStatus,
        });
    }

    function normalizeProperties(values) {
        const byId = new Map();
        for (const raw of Array.isArray(values) ? values : []) {
            const property = normalizeProperty(raw);
            if (!property) continue;
            const current = byId.get(property.propertyId);
            if (!current || compareUpdated(property, current) >= 0) {
                byId.set(property.propertyId, property);
            }
        }

        const byAddress = new Map();
        for (const property of byId.values()) {
            const current = byAddress.get(property.addressKey);
            if (!current) {
                byAddress.set(property.addressKey, property);
                continue;
            }
            const newer =
                compareUpdated(property, current) >= 0 ? property : current;
            const older = newer === property ? current : property;
            byAddress.set(
                property.addressKey,
                mergePropertyDetails(newer, older),
            );
        }

        return Array.from(byAddress.values()).sort((left, right) =>
            left.address.localeCompare(right.address),
        );
    }

    function normalizeTemplates(values, validPropertyIds) {
        const byId = new Map();
        for (const raw of Array.isArray(values) ? values : []) {
            const template = normalizeTemplate(raw, { skipInvalid: true });
            if (!template || !validPropertyIds.has(template.propertyId)) continue;
            const current = byId.get(template.templateId);
            if (!current || compareUpdated(template, current) >= 0) {
                byId.set(template.templateId, template);
            }
        }

        const byProperty = new Map();
        for (const template of byId.values()) {
            const current = byProperty.get(template.propertyId);
            if (!current || compareUpdated(template, current) >= 0) {
                byProperty.set(template.propertyId, template);
            }
        }

        return Array.from(byProperty.values()).sort((left, right) =>
            left.propertyId.localeCompare(right.propertyId),
        );
    }

    function normalizeLibrary(raw, options = {}) {
        const properties = normalizeProperties(raw?.properties);
        const validPropertyIds = new Set(
            properties.map((property) => property.propertyId),
        );
        return {
            app: MANUAL_WORK_APP,
            manualWorkVersion: MANUAL_WORK_VERSION,
            updatedAt: timestamp(raw?.updatedAt, options.defaultUpdatedAt || ""),
            properties,
            templates: normalizeTemplates(raw?.templates, validPropertyIds),
        };
    }

    function emptyLibrary(now = new Date(0)) {
        return normalizeLibrary({
            updatedAt: nowIso(now),
            properties: [],
            templates: [],
        });
    }

    function assertValidVersion2Templates(parsed) {
        const properties = normalizeProperties(parsed.properties);
        const validPropertyIds = new Set(
            properties.map((property) => property.propertyId),
        );

        for (const raw of parsed.templates) {
            let template;
            try {
                template = normalizeTemplate(raw);
            } catch {
                throw new Error(
                    "The permanent Manual Work Library repeat schedule data is damaged.",
                );
            }
            if (!template || !validPropertyIds.has(template.propertyId)) {
                throw new Error(
                    "The permanent Manual Work Library repeat schedule data is damaged.",
                );
            }
        }
    }

    function parseManualWorkRecord(rawText) {
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            throw new Error("The permanent Manual Work Library file is damaged.");
        }

        const supportedVersion =
            parsed?.manualWorkVersion === LEGACY_MANUAL_WORK_VERSION ||
            parsed?.manualWorkVersion === MANUAL_WORK_VERSION;
        if (
            !parsed ||
            parsed.app !== MANUAL_WORK_APP ||
            !supportedVersion ||
            !Array.isArray(parsed.properties) ||
            (parsed.manualWorkVersion === MANUAL_WORK_VERSION &&
                !Array.isArray(parsed.templates))
        ) {
            throw new Error(
                "The permanent Manual Work Library file has an unexpected structure.",
            );
        }

        if (parsed.manualWorkVersion === MANUAL_WORK_VERSION) {
            assertValidVersion2Templates(parsed);
        }

        return normalizeLibrary({
            ...parsed,
            templates: Array.isArray(parsed.templates) ? parsed.templates : [],
        });
    }

    function readManualWork(storage) {
        try {
            const raw = JSON.parse(
                storage.getItem(MANUAL_WORK_STORAGE_KEY) || "null",
            );
            return normalizeLibrary(raw || emptyLibrary(new Date(0)));
        } catch {
            return emptyLibrary(new Date(0));
        }
    }

    function writeManualWork(storage, library) {
        const normalized = normalizeLibrary(library);
        storage.setItem(MANUAL_WORK_STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function propertyKeys(property) {
        return new Set(
            [property?.address, ...(property?.addressAliases || [])]
                .map(addressKey)
                .filter(Boolean),
        );
    }

    function stopKeys(stop) {
        return new Set(
            [stop?.address, ...(stop?.addressAliases || [])]
                .map(addressKey)
                .filter(Boolean),
        );
    }

    function propertyMatchesStop(property, stop) {
        const propertySet = propertyKeys(property);
        for (const key of stopKeys(stop)) {
            if (propertySet.has(key)) return true;
        }
        return false;
    }

    function findPropertyForStop(library, stop) {
        return (
            normalizeLibrary(library).properties.find((property) =>
                propertyMatchesStop(property, stop),
            ) || null
        );
    }

    function templateForProperty(library, id) {
        const propertyId = text(id);
        return (
            normalizeLibrary(library).templates.find(
                (template) => template.propertyId === propertyId,
            ) || null
        );
    }

    function sameStopSnapshot(property, stop) {
        if (!property || !stop) return false;
        const aliases = normalizeAddressAliases(
            stop.addressAliases,
            stop.address,
        );
        return (
            property.addressKey === stop.addressKey &&
            JSON.stringify(property.addressAliases) === JSON.stringify(aliases) &&
            property.latitude === stop.latitude &&
            property.longitude === stop.longitude &&
            property.placeId === (stop.placeId || "") &&
            property.pinStatus === stop.pinStatus &&
            property.archived === false
        );
    }

    function upsertPropertyFromStop(library, rawStop, options = {}) {
        const stop = normalizeStop(rawStop);
        if (!stop) {
            throw new Error("A saved address is required for Manual Work Library.");
        }

        const normalized = normalizeLibrary(library);
        const existing = findPropertyForStop(normalized, stop);
        if (existing && options.touch === false && sameStopSnapshot(existing, stop)) {
            return normalized;
        }

        const updatedAt = nowIso(options.now || new Date());
        const next = normalizeProperty({
            propertyId:
                existing?.propertyId || makeId("property", options.idFactory),
            address: stop.address,
            addressAliases: [
                ...(existing?.addressAliases || []),
                ...(stop.addressAliases || []),
                ...(existing && existing.addressKey !== stop.addressKey
                    ? [existing.address]
                    : []),
            ],
            latitude: stop.latitude,
            longitude: stop.longitude,
            placeId: stop.placeId,
            pinStatus: stop.pinStatus,
            archived: options.touch === false ? existing?.archived || false : false,
            updatedAt,
        });

        const properties = existing
            ? normalized.properties.map((property) =>
                  property.propertyId === existing.propertyId ? next : property,
              )
            : [...normalized.properties, next];

        return normalizeLibrary({
            ...normalized,
            updatedAt,
            properties,
        });
    }

    function setPropertyArchived(library, id, archived, now = new Date()) {
        const normalized = normalizeLibrary(library);
        const updatedAt = nowIso(now);
        let found = false;
        const properties = normalized.properties.map((property) => {
            if (property.propertyId !== id) return property;
            found = true;
            return normalizeProperty({
                ...property,
                archived: Boolean(archived),
                updatedAt,
            });
        });
        if (!found) {
            throw new Error("That Manual Work Library property was not found.");
        }
        return normalizeLibrary({ ...normalized, updatedAt, properties });
    }

    function upsertRepeatTemplate(library, propertyIdValue, draft, options = {}) {
        const normalized = normalizeLibrary(library);
        const property = normalized.properties.find(
            (item) => item.propertyId === text(propertyIdValue),
        );
        if (!property) {
            throw new Error("That Manual Work Library property was not found.");
        }
        if (property.archived) {
            throw new Error("Restore the property before scheduling repeat work.");
        }

        const existing = templateForProperty(normalized, property.propertyId);
        const updatedAt = nowIso(options.now || new Date());
        const nextDueDate = normalizeCalendarDate(draft?.nextDueDate);
        const recurrenceUnit = normalizeRecurrenceUnit(draft?.recurrenceUnit);
        const parsedDue = parseCalendarDate(nextDueDate);
        if (!parsedDue) {
            throw new Error("Next due date must be a valid calendar date.");
        }

        const next = normalizeTemplate({
            templateId:
                existing?.templateId || makeId("template", options.idFactory),
            propertyId: property.propertyId,
            source: draft?.source,
            expectedPay: draft?.expectedPay,
            notes: draft?.notes,
            recurrenceCount: draft?.recurrenceCount,
            recurrenceUnit,
            nextDueDate,
            monthAnchorDay:
                recurrenceUnit === "months" ? parsedDue.day : null,
            alertLeadDays: DEFAULT_ALERT_LEAD_DAYS,
            active: true,
            updatedAt,
        });

        const templates = existing
            ? normalized.templates.map((template) =>
                  template.templateId === existing.templateId ? next : template,
              )
            : [...normalized.templates, next];

        return normalizeLibrary({
            ...normalized,
            updatedAt,
            templates,
        });
    }

    function mergeManualWorkLibraries(remote, local, now = new Date()) {
        const remoteNormalized = normalizeLibrary(remote);
        const localNormalized = normalizeLibrary(local);
        const byId = new Map(
            remoteNormalized.properties.map((property) => [
                property.propertyId,
                property,
            ]),
        );

        for (const property of localNormalized.properties) {
            const remoteProperty = byId.get(property.propertyId);
            if (!remoteProperty) {
                byId.set(property.propertyId, property);
                continue;
            }
            const newer =
                compareUpdated(property, remoteProperty) >= 0
                    ? property
                    : remoteProperty;
            const older = newer === property ? remoteProperty : property;
            byId.set(
                property.propertyId,
                mergePropertyDetails(newer, older),
            );
        }

        const templateById = new Map(
            remoteNormalized.templates.map((template) => [
                template.templateId,
                template,
            ]),
        );
        for (const template of localNormalized.templates) {
            const remoteTemplate = templateById.get(template.templateId);
            if (!remoteTemplate || compareUpdated(template, remoteTemplate) >= 0) {
                templateById.set(template.templateId, template);
            }
        }

        return normalizeLibrary({
            updatedAt: nowIso(now),
            properties: Array.from(byId.values()),
            templates: Array.from(templateById.values()),
        });
    }

    function dueState(template, today = new Date()) {
        const normalized = normalizeTemplate(template, { skipInvalid: true });
        if (!normalized || !normalized.active) return null;
        const todayDate =
            typeof today === "string"
                ? normalizeCalendarDate(today)
                : localCalendarDate(today);
        const todayOrdinal = calendarOrdinal(todayDate);
        const dueOrdinal = calendarOrdinal(normalized.nextDueDate);
        if (todayOrdinal === null || dueOrdinal === null) return null;
        const daysUntil = dueOrdinal - todayOrdinal;

        if (daysUntil < 0) {
            const lateDays = Math.abs(daysUntil);
            return {
                code: "overdue",
                label: `Overdue by ${lateDays} day${lateDays === 1 ? "" : "s"}`,
                daysUntil,
            };
        }
        if (daysUntil === 0) {
            return { code: "due-today", label: "Due Today", daysUntil };
        }
        if (daysUntil <= normalized.alertLeadDays) {
            return {
                code: "due-soon",
                label: `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
                daysUntil,
            };
        }
        return {
            code: "upcoming",
            label: `Upcoming — ${normalized.nextDueDate}`,
            daysUntil,
        };
    }

    function dueWork(library, today = new Date()) {
        const normalized = normalizeLibrary(library);
        const properties = new Map(
            normalized.properties.map((property) => [property.propertyId, property]),
        );
        return normalized.templates
            .map((template) => ({
                template,
                property: properties.get(template.propertyId) || null,
                state: dueState(template, today),
            }))
            .filter(
                (item) =>
                    item.property &&
                    !item.property.archived &&
                    item.template.active &&
                    item.state,
            )
            .sort((left, right) => {
                if (left.state.daysUntil !== right.state.daysUntil) {
                    return left.state.daysUntil - right.state.daysUntil;
                }
                return left.property.address.localeCompare(right.property.address);
            });
    }

    function dueCounts(library, today = new Date()) {
        const counts = {
            overdue: 0,
            dueToday: 0,
            dueSoon: 0,
            upcoming: 0,
        };
        for (const item of dueWork(library, today)) {
            if (item.state.code === "overdue") counts.overdue += 1;
            else if (item.state.code === "due-today") counts.dueToday += 1;
            else if (item.state.code === "due-soon") counts.dueSoon += 1;
            else counts.upcoming += 1;
        }
        return counts;
    }

    function advanceTemplateDue(library, templateIdValue, today = new Date()) {
        const normalized = normalizeLibrary(library);
        const id = text(templateIdValue);
        const current = normalized.templates.find(
            (template) => template.templateId === id,
        );
        if (!current) {
            throw new Error("That repeat schedule was not found.");
        }

        const todayDate =
            typeof today === "string"
                ? normalizeCalendarDate(today)
                : localCalendarDate(today);
        if (!todayDate) {
            throw new Error("The current calendar date is invalid.");
        }
        const todayOrdinal = calendarOrdinal(todayDate);
        let nextDueDate;

        if (current.recurrenceUnit === "days" || current.recurrenceUnit === "weeks") {
            const interval =
                current.recurrenceCount *
                (current.recurrenceUnit === "weeks" ? 7 : 1);
            const dueOrdinal = calendarOrdinal(current.nextDueDate);
            const increments = Math.max(
                1,
                Math.floor((todayOrdinal - dueOrdinal) / interval) + 1,
            );
            nextDueDate = calendarDateFromOrdinal(
                dueOrdinal + increments * interval,
            );
        } else {
            nextDueDate = addMonthsAnchored(
                current.nextDueDate,
                current.recurrenceCount,
                current.monthAnchorDay,
            );
            let guard = 0;
            while (
                calendarOrdinal(nextDueDate) <= todayOrdinal &&
                guard < 1200
            ) {
                nextDueDate = addMonthsAnchored(
                    nextDueDate,
                    current.recurrenceCount,
                    current.monthAnchorDay,
                );
                guard += 1;
            }
            if (calendarOrdinal(nextDueDate) <= todayOrdinal) {
                throw new Error(
                    "The next monthly due date could not be calculated safely.",
                );
            }
        }

        const updatedAt = nowIso(
            typeof today === "string" ? new Date() : today,
        );
        const templates = normalized.templates.map((template) =>
            template.templateId === id
                ? normalizeTemplate({
                      ...template,
                      nextDueDate,
                      updatedAt,
                  })
                : template,
        );
        return normalizeLibrary({
            ...normalized,
            updatedAt,
            templates,
        });
    }

    function propertyStop(property, options = {}) {
        return normalizeStop({
            id: text(options.id) || `manual_${property.propertyId}`,
            address: property.address,
            addressAliases: property.addressAliases,
            latitude: property.latitude,
            longitude: property.longitude,
            placeId: property.placeId,
            pinStatus: property.pinStatus,
            label: "",
            source: "",
            notes: "",
        });
    }

    function restoreLibraryPropertiesToStops(library, stops) {
        let next = normalizeStopList(stops);
        let restoredCount = 0;

        for (const property of normalizeLibrary(library).properties) {
            if (property.archived) continue;
            const existing = next.find((stop) =>
                propertyMatchesStop(property, stop),
            );
            if (existing) continue;
            const stop = propertyStop(property);
            if (!stop) continue;
            next = normalizeStopList([...next, stop]);
            restoredCount += 1;
        }

        return { stops: next, restoredCount };
    }

    return Object.freeze({
        DEFAULT_ALERT_LEAD_DAYS,
        LEGACY_MANUAL_WORK_VERSION,
        MANUAL_WORK_APP,
        MANUAL_WORK_STORAGE_KEY,
        MANUAL_WORK_VERSION,
        MAX_RECURRENCE_COUNT,
        advanceTemplateDue,
        dueCounts,
        dueState,
        dueWork,
        emptyLibrary,
        findPropertyForStop,
        localCalendarDate,
        mergeManualWorkLibraries,
        normalizeCalendarDate,
        normalizeLibrary,
        normalizeProperty,
        normalizeTemplate,
        parseManualWorkRecord,
        propertyMatchesStop,
        readManualWork,
        restoreLibraryPropertiesToStops,
        setPropertyArchived,
        templateForProperty,
        upsertPropertyFromStop,
        upsertRepeatTemplate,
        writeManualWork,
    });
});