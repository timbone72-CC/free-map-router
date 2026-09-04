(function attachGoogleRouteBrowser(root, factory) {
    const contract =
        typeof module === "object" && module.exports
            ? require("./google-route-contract.js")
            : root?.FMRGoogleRouteContract;
    const browser = factory(contract, root);

    if (typeof module === "object" && module.exports) {
        module.exports = browser;
    }

    if (root) {
        root.FMRGoogleRouteBrowser = browser;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBrowser(contract, root) {
    "use strict";

    if (!contract) {
        throw new Error("Google route contract failed to load.");
    }

    const CLIENT_ID =
        "170117881136-v1k2p78ukleac3ep22b9rc3mpnsut4i8.apps.googleusercontent.com";
    const BACKEND_URL =
        "https://fmr-route-optimizer-nigrg27taq-uc.a.run.app";
    const WORKBOOK_INBOX_TIMEOUT_MS = 15000;

    class GoogleRouteBrowserError extends Error {
        constructor(code, message, statusCode = null) {
            super(message);
            this.name = "GoogleRouteBrowserError";
            this.code = code;
            this.statusCode = statusCode;
        }
    }

    function requestId(now = new Date()) {
        const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
        const random = Math.random().toString(16).slice(2, 10);
        return `browser-${stamp}-${random}`;
    }

    function coordinateKey(stop) {
        if (
            stop?.latitude === null ||
            stop?.latitude === undefined ||
            stop?.latitude === "" ||
            stop?.longitude === null ||
            stop?.longitude === undefined ||
            stop?.longitude === ""
        ) {
            return "";
        }
        const latitude = Number(stop?.latitude);
        const longitude = Number(stop?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
        return `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
    }

    function duplicateCoordinateGroups(stops) {
        const groups = new Map();
        for (const stop of Array.isArray(stops) ? stops : []) {
            if (stop?.pinStatus !== "manual") continue;
            const key = coordinateKey(stop);
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(stop);
        }
        return Array.from(groups.values()).filter((group) => group.length > 1);
    }

    function duplicateCoordinateMessage(groups) {
        const addresses = groups
            .flat()
            .map((stop) => String(stop?.address || stop?.id || "").trim())
            .filter(Boolean);
        const shown = addresses.slice(0, 6).join("; ");
        const extra = addresses.length > 6 ? `; plus ${addresses.length - 6} more` : "";
        return (
            "Google optimization stopped because different selected jobs share the same saved coordinates. " +
            `Remove those jobs from this route or correct their pins: ${shown}${extra}`
        );
    }

    function sameIds(left, right) {
        const a = Array.isArray(left) ? left : [];
        const b = Array.isArray(right) ? right : [];
        return a.length === b.length && a.every((id, index) => id === b[index]);
    }

    function localPartsAt(epochMs, timeZone) {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        });
        const parts = {};
        for (const part of formatter.formatToParts(new Date(epochMs))) {
            if (part.type !== "literal") parts[part.type] = Number(part.value);
        }
        return parts;
    }

    function offsetMinutesAt(epochMs, timeZone) {
        const wholeSecondEpoch = Math.floor(epochMs / 1000) * 1000;
        const parts = localPartsAt(wholeSecondEpoch, timeZone);
        const representedUtc = Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second,
        );
        return Math.round((representedUtc - wholeSecondEpoch) / 60000);
    }

    function resolveLocalRouteInstant(routeDate, localTime, timeZone) {
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
            String(routeDate ?? "").trim(),
        );
        const timeMatch = /^(\d{2}):(\d{2})$/.exec(
            String(localTime ?? "").trim(),
        );
        const zone = String(timeZone ?? "").trim();
        if (!dateMatch || !timeMatch || !zone) {
            throw new GoogleRouteBrowserError(
                "INVALID_ROUTE_TIME",
                "The saved route date or time is invalid. Check the Workday controls before Google Optimize.",
            );
        }

        try {
            new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(
                new Date(0),
            );
        } catch {
            throw new GoogleRouteBrowserError(
                "INVALID_ROUTE_TIME",
                "The saved route time zone is invalid. Check the Workday controls before Google Optimize.",
            );
        }

        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        const hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2]);
        const nominalUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
        const offsets = new Set();
        for (const delta of [-172800000, -86400000, 0, 86400000, 172800000]) {
            offsets.add(offsetMinutesAt(nominalUtc + delta, zone));
        }

        const matches = [];
        for (const offsetMinutes of offsets) {
            const candidate = nominalUtc - offsetMinutes * 60000;
            const parts = localPartsAt(candidate, zone);
            if (
                parts.year === year &&
                parts.month === month &&
                parts.day === day &&
                parts.hour === hour &&
                parts.minute === minute &&
                parts.second === 0
            ) {
                matches.push(candidate);
            }
        }

        if (matches.length === 0) {
            throw new GoogleRouteBrowserError(
                "INVALID_ROUTE_TIME",
                `${routeDate} ${localTime} does not exist in ${zone}. Check the Workday controls before Google Optimize.`,
            );
        }

        const chosen = Math.min(...matches);
        return new Date(chosen).toISOString().replace(".000Z", "Z");
    }

    function serviceSecondsFromMinutes(minutes, stopId) {
        const numeric = Number(minutes);
        if (!Number.isFinite(numeric) || numeric < 0) {
            throw new GoogleRouteBrowserError(
                "INVALID_SERVICE_DURATION",
                `Stop ${stopId} has an invalid service duration.`,
            );
        }
        const seconds = numeric * 60;
        const rounded = Math.round(seconds);
        if (Math.abs(seconds - rounded) > 1e-9) {
            throw new GoogleRouteBrowserError(
                "INVALID_SERVICE_DURATION",
                `Stop ${stopId} service time must resolve to a whole number of seconds before Google Optimize.`,
            );
        }
        return rounded;
    }

    function missingDurationMessage(projection) {
        const missing = [];
        for (const stop of Array.isArray(projection?.stops) ? projection.stops : []) {
            for (const item of Array.isArray(stop?.items) ? stop.items : []) {
                if (item?.serviceMinutes !== null) continue;
                missing.push(
                    item.kind === "gig"
                        ? `Gig ${item.workItemId}`
                        : `Order ${item.workItemId}`,
                );
            }
        }
        const shown = missing.slice(0, 6).join(", ");
        const extra = missing.length > 6 ? `, plus ${missing.length - 6} more` : "";
        return (
            "Google Optimize needs a service duration for every routed manual work item. " +
            `Add service minutes for: ${shown}${extra}`
        );
    }

    function stableHomeBasis(home) {
        const latitude = Number(home?.latitude);
        const longitude = Number(home?.longitude);
        return {
            address: String(home?.address ?? "").trim(),
            latitude: Number.isFinite(latitude) ? Number(latitude.toFixed(7)) : null,
            longitude: Number.isFinite(longitude) ? Number(longitude.toFixed(7)) : null,
        };
    }

    function buildScheduleBasisKey({
        routeIds,
        home,
        serviceByStopId,
        timing,
    }) {
        const service = (Array.isArray(routeIds) ? routeIds : []).map((stopId) => [
            stopId,
            Number(serviceByStopId?.[stopId]),
        ]);
        return JSON.stringify({
            routeIds: Array.isArray(routeIds) ? routeIds.slice() : [],
            home: stableHomeBasis(home),
            service,
            departureTime: String(timing?.departureTime ?? ""),
            homeByTime: String(timing?.homeByTime ?? ""),
        });
    }

    function rawRouteHistory(storage, routeHistoryContract) {
        try {
            const key = routeHistoryContract?.STORAGE_KEY;
            const raw = key ? storage?.getItem?.(key) : null;
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function normalizeScheduleForStorage(schedule, basisKey, routeIds) {
        if (!schedule || typeof schedule !== "object") {
            throw new GoogleRouteBrowserError(
                "MISSING_SCHEDULE",
                "Google did not return a complete workday schedule.",
            );
        }
        const visits = Array.isArray(schedule.visits) ? schedule.visits : [];
        if (
            visits.length !== routeIds.length ||
            !sameIds(
                visits.map((visit) => String(visit?.stopId ?? "").trim()),
                routeIds,
            )
        ) {
            throw new GoogleRouteBrowserError(
                "INVALID_GOOGLE_SCHEDULE",
                "Google returned schedule visits that do not match the accepted route order.",
            );
        }
        return {
            basisKey,
            vehicleStartTime: schedule.vehicleStartTime,
            vehicleEndTime: schedule.vehicleEndTime,
            travelDurationSeconds: schedule.travelDurationSeconds,
            totalServiceDurationSeconds: schedule.totalServiceDurationSeconds,
            waitDurationSeconds: schedule.waitDurationSeconds,
            visits: visits.map((visit) => ({
                stopId: visit.stopId,
                startTime: visit.startTime,
            })),
        };
    }

    function persistGoogleSchedule(
        storage,
        routeHistoryContract,
        schedule,
        basisKey,
        routeIds,
    ) {
        const current = rawRouteHistory(storage, routeHistoryContract);
        if (
            !current ||
            current.version !== routeHistoryContract?.ROUTE_HISTORY_VERSION ||
            !current.google ||
            !sameIds(current.google.routeIds, routeIds)
        ) {
            throw new GoogleRouteBrowserError(
                "STALE_ROUTE",
                "The Google route changed while optimization was finishing. The new schedule was not saved.",
            );
        }

        current.google.schedule = normalizeScheduleForStorage(
            schedule,
            basisKey,
            routeIds,
        );
        if (current.basic) current.basic.schedule = null;
        storage.setItem(routeHistoryContract.STORAGE_KEY, JSON.stringify(current));
        return current.google.schedule;
    }

    function readStoredGoogleSchedule(storage, routeHistoryContract) {
        const current = rawRouteHistory(storage, routeHistoryContract);
        const schedule = current?.google?.schedule;
        return schedule && typeof schedule === "object" ? schedule : null;
    }

    function storedScheduleIsCurrent(
        storage,
        routeHistoryContract,
        basisKey,
    ) {
        const schedule = readStoredGoogleSchedule(storage, routeHistoryContract);
        return Boolean(schedule && schedule.basisKey === basisKey);
    }

    async function prepareTimeAwareSnapshot(bridge, options = {}) {
        const runtimeRoot = options.root || root || globalThis;
        const storage = options.storage || runtimeRoot?.localStorage;
        const routeHistoryContract = runtimeRoot?.FMRRouteHistory;
        const planningRuntime = runtimeRoot?.FMRWorkItemPlanningRuntime;
        const workdayContext = runtimeRoot?.FMRWorkdayContext;

        if (!storage || !routeHistoryContract || !planningRuntime || !workdayContext) {
            throw new GoogleRouteBrowserError(
                "PLANNING_NOT_READY",
                "Route timing or service planning is not ready. Refresh the app and try again.",
            );
        }

        const snapshot = await prepareSnapshotForGoogle(bridge);
        const stopIds = (snapshot.stops || []).map((stop) => String(stop.id || ""));
        let history = routeHistoryContract.readRouteHistory(storage);
        const googleSnapshot = history.google;
        if (!googleSnapshot || !sameIds(googleSnapshot.routeIds, stopIds)) {
            throw new GoogleRouteBrowserError(
                "STALE_ROUTE",
                "The Google route changed while it was being prepared. Try Google Optimize again.",
            );
        }

        let dayContext = history.dayContext;
        if (!dayContext) {
            const displayed = workdayContext.displayContext(
                storage,
                options.now || new Date(),
            );
            dayContext = displayed.context;
            history = routeHistoryContract.writeDayContext(
                storage,
                dayContext,
            );
        }
        const validation = routeHistoryContract.validateDayContext(dayContext);
        if (!validation.ok) {
            throw new GoogleRouteBrowserError(
                "INVALID_ROUTE_TIME",
                validation.error,
            );
        }
        dayContext = validation.dayContext;

        const projection = planningRuntime.projectRoute(googleSnapshot);
        if (!projection?.complete) {
            throw new GoogleRouteBrowserError(
                "MISSING_SERVICE_DURATION",
                missingDurationMessage(projection),
            );
        }

        const serviceByStopId = {};
        for (const stop of projection.stops || []) {
            serviceByStopId[stop.stopId] = serviceSecondsFromMinutes(
                stop.serviceMinutes,
                stop.stopId,
            );
        }
        for (const stopId of stopIds) {
            if (!Object.hasOwn(serviceByStopId, stopId)) {
                serviceByStopId[stopId] = 0;
            }
        }

        const timing = {
            departureTime: resolveLocalRouteInstant(
                dayContext.routeDate,
                dayContext.departureTime,
                dayContext.timeZone,
            ),
            homeByTime: resolveLocalRouteInstant(
                dayContext.routeDate,
                dayContext.homeByTime,
                dayContext.timeZone,
            ),
        };
        const preferredFinishTime = resolveLocalRouteInstant(
            dayContext.routeDate,
            dayContext.preferredFinishTime,
            dayContext.timeZone,
        );

        return {
            snapshot: {
                home: snapshot.home,
                timing,
                stops: snapshot.stops.map((stop) => ({
                    ...stop,
                    serviceDurationSeconds: serviceByStopId[stop.id] ?? 0,
                })),
            },
            context: {
                dayContext,
                preferredFinishTime,
                serviceByStopId,
            },
        };
    }

    function buildBrowserRequest(snapshot, id = requestId()) {
        const stops = Array.isArray(snapshot?.stops) ? snapshot.stops : [];
        const duplicateGroups = duplicateCoordinateGroups(stops);
        if (duplicateGroups.length > 0) {
            throw new GoogleRouteBrowserError(
                "DUPLICATE_COORDINATES",
                duplicateCoordinateMessage(duplicateGroups),
            );
        }

        return contract.buildBackendRequest({
            requestId: id,
            home: snapshot?.home,
            ...(snapshot?.timing ? { timing: snapshot.timing } : {}),
            stops: stops.map((stop) => {
                const location =
                    stop?.pinStatus === "manual"
                        ? {
                              id: stop?.id,
                              latitude: stop?.latitude,
                              longitude: stop?.longitude,
                          }
                        : {
                              id: stop?.id,
                              address: stop?.address,
                          };
                return Object.hasOwn(stop || {}, "serviceDurationSeconds")
                    ? {
                          ...location,
                          serviceDurationSeconds: stop.serviceDurationSeconds,
                      }
                    : location;
            }),
        });
    }

    async function responseJson(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    async function optimizeWithGoogle({
        snapshot,
        idToken,
        fetchImpl = globalThis.fetch,
        backendUrl = BACKEND_URL,
        id = requestId(),
    }) {
        const token = String(idToken ?? "").trim();
        if (!token) {
            throw new GoogleRouteBrowserError(
                "SIGN_IN_REQUIRED",
                "Sign in with the company Google account first.",
                401,
            );
        }
        if (typeof fetchImpl !== "function") {
            throw new Error("A fetch implementation is required.");
        }

        const request = buildBrowserRequest(snapshot, id);
        const response = await fetchImpl(`${backendUrl}/optimize`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(request),
        });
        const body = await responseJson(response);

        if (!response.ok) {
            throw new GoogleRouteBrowserError(
                String(body?.code || "GOOGLE_ROUTE_FAILED"),
                String(
                    body?.message ||
                        "Google road optimization could not be completed.",
                ),
                response.status,
            );
        }

        return {
            request,
            response: contract.validateBackendResponse(request, body),
        };
    }

    async function loadWorkbookInboxFromBackend({
        idToken,
        fetchImpl = globalThis.fetch,
        backendUrl = BACKEND_URL,
        timeoutMs = WORKBOOK_INBOX_TIMEOUT_MS,
    }) {
        const token = String(idToken ?? "").trim();
        if (!token) {
            throw new GoogleRouteBrowserError(
                "SIGN_IN_REQUIRED",
                "Sign in with the company Google account first.",
                401,
            );
        }
        if (typeof fetchImpl !== "function") {
            throw new Error("A fetch implementation is required.");
        }

        const controller =
            typeof globalThis.AbortController === "function"
                ? new globalThis.AbortController()
                : null;
        const timeout =
            controller && Number(timeoutMs) > 0
                ? globalThis.setTimeout(
                      () => controller.abort(),
                      Number(timeoutMs),
                  )
                : null;

        let response;
        try {
            response = await fetchImpl(`${backendUrl}/workbook-inbox`, {
                method: "GET",
                headers: {
                    authorization: `Bearer ${token}`,
                },
                cache: "no-store",
                ...(controller ? { signal: controller.signal } : {}),
            });
        } catch (error) {
            if (controller?.signal.aborted) {
                throw new GoogleRouteBrowserError(
                    "WORKBOOK_INBOX_TIMEOUT",
                    "The automatic route check timed out. Tap Check Workbook Route.",
                    408,
                );
            }
            throw error;
        } finally {
            if (timeout !== null) globalThis.clearTimeout(timeout);
        }

        const body = await responseJson(response);

        if (!response.ok) {
            throw new GoogleRouteBrowserError(
                String(body?.code || "WORKBOOK_INBOX_FAILED"),
                String(
                    body?.message ||
                        "The workbook route could not be loaded.",
                ),
                response.status,
            );
        }

        return body;
    }

    async function prepareSnapshotForGoogle(bridge) {
        if (typeof bridge?.prepareSelectedRouteSnapshot !== "function") {
            throw new Error("Google route preparation is unavailable. Refresh the app.");
        }
        return bridge.prepareSelectedRouteSnapshot();
    }

    function formatMetrics(response) {
        const meters = Number(response?.totalDistanceMeters);
        const seconds = Number(response?.totalDurationSeconds);
        const parts = [];

        if (Number.isFinite(meters)) {
            parts.push(`${(meters / 1609.344).toFixed(1)} road miles`);
        }
        if (Number.isFinite(seconds)) {
            const hours = seconds / 3600;
            parts.push(`${hours.toFixed(1)} hours estimated driving`);
        }

        return parts.join(" · ");
    }

    function formatClock(instant, timeZone) {
        const date = new Date(instant);
        if (Number.isNaN(date.getTime())) return "unknown time";
        return new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    }

    function formatScheduleOutcome(response, context) {
        const schedule = response?.schedule;
        const routeIds = Array.isArray(response?.orderedStopIds)
            ? response.orderedStopIds
            : [];
        if (!schedule || routeIds.length === 0) return "";

        const finalStopId = routeIds[routeIds.length - 1];
        const finalVisit = schedule.visits?.[schedule.visits.length - 1];
        const finalServiceSeconds = Number(
            context?.serviceByStopId?.[finalStopId] || 0,
        );
        const finalVisitStart = new Date(finalVisit?.startTime).getTime();
        const fieldFinishMs = finalVisitStart + finalServiceSeconds * 1000;
        const preferredMs = new Date(context?.preferredFinishTime).getTime();
        const timeZone = context?.dayContext?.timeZone || "UTC";
        const homeText = formatClock(schedule.vehicleEndTime, timeZone);
        const fieldText = Number.isFinite(fieldFinishMs)
            ? formatClock(new Date(fieldFinishMs).toISOString(), timeZone)
            : "unknown time";

        let preferredText = "";
        if (Number.isFinite(fieldFinishMs) && Number.isFinite(preferredMs)) {
            const differenceMinutes = Math.round(
                Math.abs(fieldFinishMs - preferredMs) / 60000,
            );
            preferredText =
                fieldFinishMs > preferredMs
                    ? ` Preferred finish exceeded by ${differenceMinutes} min.`
                    : ` Preferred finish met with about ${differenceMinutes} min to spare.`;
        }

        return ` Field work finishes about ${fieldText}; Home about ${homeText}.${preferredText}`;
    }

    function formatWorkbookRefreshStatus(result, addressCount) {
        const count = Number.isInteger(addressCount) && addressCount >= 0
            ? addressCount
            : 0;
        if (result === "newer" || result === "pending") {
            return `New Route Available — ${count} address${count === 1 ? "" : "es"}`;
        }
        if (result === "older") return "Older workbook route ignored.";
        if (result === "not-approved") return "Workbook route was not loaded.";
        if (result === "empty") return "Workbook route has no jobs.";
        return "Workbook route is up to date.";
    }

    function installScheduleRestoreHook(runtimeRoot) {
        const backup = runtimeRoot?.FMRBackup;
        const routeHistoryContract = runtimeRoot?.FMRRouteHistory;
        const storage = runtimeRoot?.localStorage;
        if (
            !backup ||
            typeof backup.takeParsedGoogleScheduleForRestore !== "function" ||
            !routeHistoryContract ||
            !storage ||
            typeof runtimeRoot.restoreRoutes !== "function" ||
            runtimeRoot.restoreRoutes?.fmrGoogleScheduleAware === true
        ) {
            return false;
        }

        const originalRestoreRoutes = runtimeRoot.restoreRoutes;
        const wrapped = function googleScheduleAwareRestoreRoutes(routes) {
            const result = originalRestoreRoutes(routes);
            const restored = backup.takeParsedGoogleScheduleForRestore();
            if (restored?.schedule && restored.routeIds?.length) {
                persistGoogleSchedule(
                    storage,
                    routeHistoryContract,
                    restored.schedule,
                    restored.schedule.basisKey,
                    restored.routeIds,
                );
            }
            return result;
        };
        wrapped.fmrGoogleScheduleAware = true;
        runtimeRoot.restoreRoutes = wrapped;
        return true;
    }

    function initializeBrowserUi(runtimeRoot = globalThis) {
        const document = runtimeRoot?.document;
        const bridge = runtimeRoot?.FMRRouteBridge;
        const signInContainer = document?.getElementById("googleRouteSignIn");
        const optimizeButton = document?.getElementById("googleOptimizeRoute");
        const authStatus = document?.getElementById("googleRouteAuthStatus");

        if (!document || !bridge || !signInContainer || !optimizeButton) return false;

        installScheduleRestoreHook(runtimeRoot);

        let idToken = "";
        let identityInitialized = false;
        let backendInboxRefreshPromise = null;

        function setStatus(message) {
            bridge.setRouteStatus(String(message || ""));
        }

        function showSignInControl(show) {
            signInContainer.hidden = !show;
        }

        function requestReturningGoogleIdentity() {
            const identity = runtimeRoot?.google?.accounts?.id;
            if (typeof identity?.prompt !== "function") return false;
            identity.prompt();
            return true;
        }

        function rejectGoogleIdentity(error) {
            idToken = "";
            optimizeButton.disabled = true;
            showSignInControl(true);
            if (authStatus) {
                authStatus.textContent =
                    error?.statusCode === 401
                        ? "Google sign-in expired. Reconnecting with the approved company account…"
                        : "The account was not approved. Sign in again with the company account.";
            }
            if (error?.statusCode === 401) {
                requestReturningGoogleIdentity();
            }
        }

        async function refreshBackendWorkbookInbox({
            allowStaleConfirmation = false,
        } = {}) {
            if (!idToken || document.visibilityState === "hidden") return null;
            if (backendInboxRefreshPromise) return backendInboxRefreshPromise;
            if (typeof bridge.applyWorkbookInboxFromBackend !== "function") {
                return null;
            }

            setStatus("Checking for new route…");
            backendInboxRefreshPromise = (async () => {
                const inbox = await loadWorkbookInboxFromBackend({ idToken });
                const result = await bridge.applyWorkbookInboxFromBackend(
                    inbox,
                    { allowStaleConfirmation },
                );
                setStatus(
                    formatWorkbookRefreshStatus(
                        result,
                        inbox.addresses.length,
                    ),
                );
                return result;
            })();

            try {
                return await backendInboxRefreshPromise;
            } finally {
                backendInboxRefreshPromise = null;
            }
        }

        async function refreshBackendWorkbookInboxOnReturn() {
            try {
                await refreshBackendWorkbookInbox({
                    allowStaleConfirmation: false,
                });
            } catch (error) {
                setStatus(
                    error?.message ||
                        "The workbook route could not be refreshed.",
                );
                if (error?.statusCode === 401 || error?.statusCode === 403) {
                    rejectGoogleIdentity(error);
                }
            }
        }

        function initializeIdentity() {
            if (identityInitialized) return;
            const identity = runtimeRoot?.google?.accounts?.id;
            if (!identity) {
                if (authStatus) {
                    authStatus.textContent =
                        "Google sign-in did not load. Refresh the app and try again.";
                }
                return;
            }

            identityInitialized = true;
            identity.initialize({
                client_id: CLIENT_ID,
                auto_select: true,
                button_auto_select: true,
                use_fedcm_for_button: true,
                cancel_on_tap_outside: true,
                callback: async (credentialResponse) => {
                    idToken = String(credentialResponse?.credential ?? "").trim();
                    optimizeButton.disabled = !idToken;
                    showSignInControl(!idToken);
                    if (authStatus) {
                        authStatus.textContent = idToken
                            ? "Connected with the approved company Google account."
                            : "Google sign-in was not completed.";
                    }
                    if (idToken) {
                        try {
                            await refreshBackendWorkbookInbox({
                                allowStaleConfirmation: true,
                            });
                        } catch (error) {
                            setStatus(
                                error?.message ||
                                    "The workbook route could not be loaded.",
                            );
                            if (
                                error?.statusCode === 401 ||
                                error?.statusCode === 403
                            ) {
                                rejectGoogleIdentity(error);
                            }
                        }
                    }
                },
            });
            showSignInControl(true);
            identity.renderButton(signInContainer, {
                type: "standard",
                theme: "outline",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
            });
            if (authStatus) {
                authStatus.textContent =
                    "Checking the saved business Google sign-in…";
            }
            requestReturningGoogleIdentity();
        }

        optimizeButton.disabled = true;
        optimizeButton.addEventListener("click", async () => {
            if (!idToken) {
                setStatus("Sign in with the company Google account first.");
                return;
            }

            optimizeButton.disabled = true;
            setStatus("Preparing work times and selected addresses for Google…");

            try {
                const prepared = await prepareTimeAwareSnapshot(bridge, {
                    root: runtimeRoot,
                });
                setStatus("Google is calculating the traffic-aware workday…");
                const result = await optimizeWithGoogle({
                    snapshot: prepared.snapshot,
                    idToken,
                });
                bridge.applyGoogleRouteResult(result.request, result.response);

                const routeIds = result.response.orderedStopIds.slice();
                const basisKey = buildScheduleBasisKey({
                    routeIds,
                    home: prepared.snapshot.home,
                    serviceByStopId: prepared.context.serviceByStopId,
                    timing: prepared.snapshot.timing,
                });
                persistGoogleSchedule(
                    runtimeRoot.localStorage,
                    runtimeRoot.FMRRouteHistory,
                    result.response.schedule,
                    basisKey,
                    routeIds,
                );

                const metrics = formatMetrics(result.response);
                const scheduleOutcome = formatScheduleOutcome(
                    result.response,
                    prepared.context,
                );
                setStatus(
                    `Google road route applied to ${routeIds.length} jobs.` +
                        (metrics ? ` ${metrics}.` : "") +
                        scheduleOutcome,
                );
            } catch (error) {
                setStatus(error?.message || "Google road optimization failed.");
                if (error?.statusCode === 401 || error?.statusCode === 403) {
                    rejectGoogleIdentity(error);
                }
            } finally {
                optimizeButton.disabled = !idToken;
            }
        });

        runtimeRoot.addEventListener?.("focus", refreshBackendWorkbookInboxOnReturn);
        document.addEventListener?.("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                refreshBackendWorkbookInboxOnReturn();
            }
        });

        if (document.readyState === "complete") {
            initializeIdentity();
        } else {
            runtimeRoot.addEventListener("load", initializeIdentity, { once: true });
        }

        return true;
    }

    return {
        BACKEND_URL,
        CLIENT_ID,
        GoogleRouteBrowserError,
        buildBrowserRequest,
        buildScheduleBasisKey,
        coordinateKey,
        duplicateCoordinateGroups,
        formatMetrics,
        formatScheduleOutcome,
        formatWorkbookRefreshStatus,
        initializeBrowserUi,
        installScheduleRestoreHook,
        loadWorkbookInboxFromBackend,
        optimizeWithGoogle,
        persistGoogleSchedule,
        prepareSnapshotForGoogle,
        prepareTimeAwareSnapshot,
        readStoredGoogleSchedule,
        requestId,
        resolveLocalRouteInstant,
        storedScheduleIsCurrent,
    };
});

if (typeof window !== "undefined") {
    window.FMRGoogleRouteBrowser?.initializeBrowserUi(window);
}