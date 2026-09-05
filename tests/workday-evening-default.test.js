const test = require("node:test");
const assert = require("node:assert/strict");

const routeHistory = require("../route-history.js");
const {
    bindWorkdayControls,
    defaultDayContext,
} = require("../workday-context.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

function fakeElement() {
    const listeners = new Map();
    return {
        value: "",
        textContent: "",
        dataset: {},
        addEventListener(type, listener) {
            listeners.set(type, listener);
        },
        fire(type) {
            return listeners.get(type)?.();
        },
    };
}

function fakeDocument() {
    const ids = [
        "workdayControls",
        "routeDate",
        "routeDepartureTime",
        "routePreferredFinishTime",
        "routeHomeByTime",
        "routeDayContextStatus",
    ];
    const elements = new Map(ids.map((id) => [id, fakeElement()]));
    return {
        elements,
        getElementById(id) {
            return elements.get(id) || null;
        },
    };
}

test("late-day Workday defaults remain valid after the normal 5 PM Home By", () => {
    const context = defaultDayContext(
        new Date("2026-09-05T02:22:00.000Z"),
        "America/Chicago",
    );

    assert.deepEqual(context, {
        routeDate: "2026-09-04",
        departureTime: "21:22",
        preferredFinishTime: "15:00",
        homeByTime: "23:59",
        timeZone: "America/Chicago",
    });
    assert.equal(routeHistory.validateDayContext(context).ok, true);
});

test("1 PM departure with 11:30 PM Home By is accepted on the same route date", () => {
    const validation = routeHistory.validateDayContext({
        routeDate: "2026-09-04",
        departureTime: "13:00",
        preferredFinishTime: "18:30",
        homeByTime: "23:30",
        timeZone: "America/Chicago",
    });

    assert.equal(validation.ok, true);
    assert.equal(validation.dayContext.departureTime, "13:00");
    assert.equal(validation.dayContext.homeByTime, "23:30");
});

test("workday controls save a 1 PM departure and later Home By without a route-time conflict", () => {
    const storage = memoryStorage();
    routeHistory.writeDayContext(storage, {
        routeDate: "2026-09-04",
        departureTime: "21:22",
        preferredFinishTime: "15:00",
        homeByTime: "23:59",
        timeZone: "America/Chicago",
    });
    const document = fakeDocument();

    assert.equal(
        bindWorkdayControls({
            document,
            storage,
            now: () => new Date("2026-09-05T02:22:00.000Z"),
        }),
        true,
    );

    const departure = document.elements.get("routeDepartureTime");
    const homeBy = document.elements.get("routeHomeByTime");
    const status = document.elements.get("routeDayContextStatus");

    assert.equal(departure.value, "21:22");
    assert.equal(homeBy.value, "23:59");

    departure.value = "13:00";
    assert.equal(departure.fire("change"), true);
    assert.equal(routeHistory.readRouteHistory(storage).dayContext.departureTime, "13:00");

    homeBy.value = "23:30";
    assert.equal(homeBy.fire("change"), true);

    const saved = routeHistory.readRouteHistory(storage).dayContext;
    assert.equal(saved.departureTime, "13:00");
    assert.equal(saved.homeByTime, "23:30");
    assert.match(status.textContent, /Route timing saved/);
});
