(function attachFreeMapRouterWorkdayContext(root, factory) {
    const routeHistory =
        typeof module === "object" && module.exports
            ? require("./route-history.js")
            : root?.FMRRouteHistory;
    const workdayContext = factory(routeHistory, root);

    if (typeof module === "object" && module.exports) {
        module.exports = workdayContext;
    }

    if (root) {
        root.FMRWorkdayContext = workdayContext;
    }

    if (root?.document && root?.localStorage) {
        workdayContext.bindWorkdayControls();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildWorkdayContext(routeHistory, root) {
    "use strict";

    const DEFAULT_PREFERRED_FINISH = "15:00";
    const DEFAULT_HOME_BY = "17:00";
    const LATE_DAY_HOME_BY = "23:59";

    if (!routeHistory) {
        throw new Error("Free Map Router route history failed to load.");
    }

    const {
        ROUTE_HISTORY_CHANGED_EVENT,
        readRouteHistory,
        validateDayContext,
        writeDayContext,
    } = routeHistory;

    function resolvedTimeZone() {
        const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return String(candidate || "UTC").trim() || "UTC";
    }

    function localDateTimeParts(date, timeZone) {
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        });
        const parts = {};
        for (const part of formatter.formatToParts(date)) {
            if (part.type !== "literal") parts[part.type] = part.value;
        }
        return {
            routeDate: `${parts.year}-${parts.month}-${parts.day}`,
            departureTime: `${parts.hour}:${parts.minute}`,
        };
    }

    function timeMinutes(localTime) {
        const [hour, minute] = String(localTime || "")
            .split(":")
            .map(Number);
        if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
        return hour * 60 + minute;
    }

    function defaultHomeByTime(departureTime) {
        const departureMinutes = timeMinutes(departureTime);
        const normalHomeByMinutes = timeMinutes(DEFAULT_HOME_BY);
        if (
            departureMinutes !== null &&
            normalHomeByMinutes !== null &&
            departureMinutes < normalHomeByMinutes
        ) {
            return DEFAULT_HOME_BY;
        }
        return LATE_DAY_HOME_BY;
    }

    function defaultDayContext(date = new Date(), timeZone = resolvedTimeZone()) {
        const parts = localDateTimeParts(date, timeZone);
        return {
            routeDate: parts.routeDate,
            departureTime: parts.departureTime,
            preferredFinishTime: DEFAULT_PREFERRED_FINISH,
            homeByTime: defaultHomeByTime(parts.departureTime),
            timeZone,
        };
    }

    function displayContext(storage, now = new Date()) {
        const history = readRouteHistory(storage);
        if (history.dayContext) {
            return {
                context: history.dayContext,
                saved: true,
            };
        }
        return {
            context: defaultDayContext(now),
            saved: false,
        };
    }

    function homeByRestrictionEnabled(document = root?.document) {
        const input = document?.getElementById?.("routeHomeByTime");
        if (!input) return true;
        return String(input.value ?? "").trim() !== "";
    }

    function bindWorkdayControls({
        document = root?.document,
        storage = root?.localStorage,
        now = () => new Date(),
    } = {}) {
        if (!document || !storage) return false;

        const container = document.getElementById("workdayControls");
        const routeDate = document.getElementById("routeDate");
        const departureTime = document.getElementById("routeDepartureTime");
        const preferredFinishTime = document.getElementById(
            "routePreferredFinishTime",
        );
        const homeByTime = document.getElementById("routeHomeByTime");
        const status = document.getElementById("routeDayContextStatus");
        const inputs = [
            routeDate,
            departureTime,
            preferredFinishTime,
            homeByTime,
        ];

        if (!container || inputs.some((input) => !input) || !status) return false;
        if (container.dataset.fmrWorkdayBound === "true") return true;
        container.dataset.fmrWorkdayBound = "true";

        let activeTimeZone = resolvedTimeZone();

        function setStatus(message, state = "") {
            status.textContent = message;
            if (state) {
                status.dataset.state = state;
            } else {
                delete status.dataset.state;
            }
        }

        function refresh() {
            const current = displayContext(storage, now());
            const context = current.context;
            activeTimeZone = context.timeZone;
            routeDate.value = context.routeDate;
            departureTime.value = context.departureTime;
            preferredFinishTime.value = context.preferredFinishTime;
            homeByTime.value = context.homeByTime;
            setStatus(
                current.saved
                    ? `Route timing saved for ${context.routeDate} • ${context.timeZone}.`
                    : `Today's defaults • ${context.timeZone}. Changes save to this route.`,
                current.saved ? "saved" : "default",
            );
        }

        function save() {
            if (!homeByRestrictionEnabled(document)) {
                setStatus(
                    "Home By limit off for Google Optimize. Enter a Home By time to turn the limit back on.",
                    "default",
                );
                return true;
            }

            const draft = {
                routeDate: routeDate.value,
                departureTime: departureTime.value,
                preferredFinishTime: preferredFinishTime.value,
                homeByTime: homeByTime.value,
                timeZone: activeTimeZone,
            };
            const validation = validateDayContext(draft);
            if (!validation.ok) {
                setStatus(validation.error, "error");
                return false;
            }

            try {
                writeDayContext(storage, validation.dayContext);
                setStatus(
                    `Route timing saved for ${validation.dayContext.routeDate} • ${validation.dayContext.timeZone}.`,
                    "saved",
                );
                return true;
            } catch (error) {
                setStatus(
                    error?.message || "Route timing could not be saved.",
                    "error",
                );
                return false;
            }
        }

        for (const input of inputs) {
            input.addEventListener("change", save);
        }

        if (
            root &&
            typeof root.addEventListener === "function" &&
            ROUTE_HISTORY_CHANGED_EVENT
        ) {
            root.addEventListener(ROUTE_HISTORY_CHANGED_EVENT, refresh);
        }

        refresh();
        return true;
    }

    return {
        DEFAULT_HOME_BY,
        DEFAULT_PREFERRED_FINISH,
        LATE_DAY_HOME_BY,
        bindWorkdayControls,
        defaultDayContext,
        defaultHomeByTime,
        displayContext,
        homeByRestrictionEnabled,
        resolvedTimeZone,
    };
});