import json
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

APP_URL = "http://127.0.0.1:8765/index.html"
EVIDENCE_PATH = Path("phase2g-service-time-browser-smoke.json")


def fixture():
    stops = [
        {
            "schemaVersion": 3,
            "id": "stop_shared",
            "address": "100 Test Ave, Elk City, OK 73644",
            "addressKey": "100 test ave,elk city,ok 73644",
            "addressAliases": [],
            "label": "Shared stop",
            "source": "GIS",
            "notes": "",
            "latitude": 35.41,
            "longitude": -99.40,
            "placeId": "",
            "pinStatus": "manual",
        },
        {
            "schemaVersion": 3,
            "id": "stop_second",
            "address": "200 Test Ave, Elk City, OK 73644",
            "addressKey": "200 test ave,elk city,ok 73644",
            "addressAliases": [],
            "label": "Second stop",
            "source": "DCFS",
            "notes": "",
            "latitude": 35.42,
            "longitude": -99.41,
            "placeId": "",
            "pinStatus": "manual",
        },
    ]
    home = {
        "schemaVersion": 3,
        "id": "home",
        "address": "500 Home Test Rd, Elk City, OK 73644",
        "addressKey": "500 home test rd,elk city,ok 73644",
        "addressAliases": [],
        "label": "Home",
        "source": "",
        "notes": "",
        "latitude": 35.40,
        "longitude": -99.39,
        "placeId": "",
        "pinStatus": "manual",
        "role": "home",
    }
    now = "2026-09-04T05:55:00.000Z"
    gigs = [
        {
            "schemaVersion": 2,
            "id": "GIG-1",
            "stopId": "stop_shared",
            "source": "HNP",
            "workOrderId": "HNP-1",
            "expectedPay": 18,
            "notes": "Unknown service duration until operator enters it",
            "routeIncluded": True,
            "dueDate": "2026-09-05",
            "completedDate": None,
            "createdAt": now,
            "updatedAt": now,
        }
    ]
    google = {
        "routeIds": ["stop_shared", "stop_second"],
        "sourceUpdatedAt": now,
        "optimizationStatus": "not_optimized",
        "orderIdsByStopId": {
            "stop_shared": ["ORDER-1", "ORDER-2"],
            "stop_second": ["ORDER-3"],
        },
        "workbookPayByStopId": {},
        "gigIdsByStopId": {"stop_shared": ["GIG-1"]},
        "gigManagedStopIds": [],
    }
    basic = {
        **google,
        "routeIds": ["stop_second", "stop_shared"],
        "orderIdsByStopId": {
            "stop_second": ["ORDER-3"],
            "stop_shared": ["ORDER-1", "ORDER-2"],
        },
    }
    planning = [
        {
            "schemaVersion": 1,
            "kind": "workbook",
            "workItemId": "ORDER-2",
            "serviceMinutes": 20,
            "assignedDate": None,
            "lockedDay": False,
            "revision": 1,
            "updatedAt": now,
        }
    ]
    return {
        "fmr_v2_stops": json.dumps(stops),
        "fmr_v2_home": json.dumps(home),
        "fmr_v1_gigs": json.dumps(gigs),
        "fmr_route_history_v1": json.dumps({"version": 5, "google": google, "basic": basic, "pending": None}),
        "fmr_work_item_planning_v1": json.dumps(planning),
    }


def main():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,900")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 12)
    results = {}

    def check(name, condition, detail=None):
        results[name] = {"pass": bool(condition), "detail": detail}
        print(("PASS" if condition else "FAIL"), name, "" if detail is None else f":: {detail}")
        if not condition:
            raise AssertionError(name)

    def text(selector):
        return driver.execute_script(
            "return document.querySelector(arguments[0])?.textContent || '';",
            selector,
        )

    try:
        driver.get(APP_URL)
        driver.execute_script(
            "localStorage.clear(); sessionStorage.clear(); for (const [k,v] of Object.entries(arguments[0])) localStorage.setItem(k,v);",
            fixture(),
        )
        driver.refresh()
        wait.until(lambda d: d.execute_script("return document.readyState === 'complete'"))
        wait.until(lambda d: d.execute_script("return !!window.FMRWorkItemPlanningControls"))
        driver.execute_script("showPage('route')")
        wait.until(lambda d: d.execute_script("return !document.querySelector('[data-page=route]').hidden"))

        total = text("#workItemPlanningServiceSummary")
        shared = text('#routeList > li[data-stop-id="stop_shared"]')
        second = text('#routeList > li[data-stop-id="stop_second"]')
        check(
            "incomplete route shows known service plus one missing duration",
            total.strip() == "Route service: 30 min known + 1 work item missing duration.",
            total,
        )
        check(
            "shared physical stop shows its known 25 minutes plus missing manual duration",
            "Service: 25 min known + 1 work item missing duration" in shared,
            shared,
        )
        check("ordinary workbook-only stop shows five-minute default", "Service: 5 min" in second, second)

        driver.execute_script(
            """
            const select = document.getElementById('workItemPlanningSelect');
            select.value = 'gig:GIG-1';
            select.dispatchEvent(new Event('change', {bubbles:true}));
            document.getElementById('workItemPlanningMinutes').value = '15';
            document.getElementById('workItemPlanningForm').dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
            """
        )
        wait.until(lambda d: d.execute_script("return document.getElementById('workItemPlanningServiceSummary').textContent.trim() === 'Route service: 45 min.'"))
        total_after = text("#workItemPlanningServiceSummary")
        shared_after = text('#routeList > li[data-stop-id="stop_shared"]')
        check("saving missing manual duration immediately completes route total", total_after.strip() == "Route service: 45 min.", total_after)
        check("shared stop immediately becomes complete at forty minutes", "Service: 40 min" in shared_after, shared_after)

        saved = driver.execute_script("return FMRWorkItemPlanningRuntime.get('gig','GIG-1');")
        check("manual duration saved to exact Gig_ID only", saved and saved["serviceMinutes"] == 15 and saved["revision"] == 1, saved)

        driver.execute_script(
            "const s=document.getElementById('routeChoice'); s.value='basic'; s.dispatchEvent(new Event('change',{bubbles:true}));"
        )
        wait.until(lambda d: "Basic Route" in d.execute_script("return document.getElementById('workItemPlanningRouteSummary').textContent"))
        basic_total = text("#workItemPlanningServiceSummary")
        basic_first = text('#routeList > li[data-stop-id="stop_second"]')
        check("Basic Route uses same exact service totals after reordering", basic_total.strip() == "Route service: 45 min.", basic_total)
        check("per-stop service stays attached to physical stop after route reorder", "Service: 5 min" in basic_first, basic_first)

        driver.refresh()
        wait.until(lambda d: d.execute_script("return !!window.FMRWorkItemPlanningControls"))
        driver.execute_script("showPage('route')")
        reload_total = text("#workItemPlanningServiceSummary")
        check("completed service total survives browser reload", reload_total.strip() == "Route service: 45 min.", reload_total)

        time.sleep(2)
        severe = [entry for entry in driver.get_log("browser") if entry.get("level") == "SEVERE"]
        unexpected = [
            entry for entry in severe
            if "Not signed in with the identity provider" not in entry.get("message", "")
        ]
        check("no unexpected severe browser console entries", not unexpected, unexpected)
    finally:
        EVIDENCE_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
        driver.quit()


if __name__ == "__main__":
    main()
