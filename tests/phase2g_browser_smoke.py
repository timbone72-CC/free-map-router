import json
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait


APP_URL = "http://127.0.0.1:8765/index.html"
EVIDENCE_PATH = Path("phase2g-browser-smoke-results.json")


def build_fixture():
    stops = [
        {
            "schemaVersion": 3,
            "id": "stop_shared",
            "address": "100 Test Ave, Elk City, OK 73644",
            "addressKey": "100 test ave,elk city,ok 73644",
            "addressAliases": [],
            "label": "Shared test property",
            "source": "GIS",
            "notes": "",
            "latitude": 35.41,
            "longitude": -99.40,
            "placeId": "",
            "pinStatus": "manual",
        },
        {
            "schemaVersion": 3,
            "id": "stop_manual",
            "address": "150 Test Ave, Elk City, OK 73644",
            "addressKey": "150 test ave,elk city,ok 73644",
            "addressAliases": [],
            "label": "Manual-only test",
            "source": "",
            "notes": "",
            "latitude": 35.42,
            "longitude": -99.41,
            "placeId": "",
            "pinStatus": "manual",
        },
        {
            "schemaVersion": 3,
            "id": "stop_second",
            "address": "200 Test Ave, Elk City, OK 73644",
            "addressKey": "200 test ave,elk city,ok 73644",
            "addressAliases": [],
            "label": "Second test property",
            "source": "DCFS",
            "notes": "",
            "latitude": 35.43,
            "longitude": -99.42,
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
    now = "2026-09-04T03:50:00.000Z"
    gigs = [
        {
            "schemaVersion": 2,
            "id": "GIG-200",
            "stopId": "stop_shared",
            "source": "HNP",
            "workOrderId": "HNP-A",
            "expectedPay": 18,
            "notes": "Shared manual job",
            "routeIncluded": True,
            "dueDate": "2026-09-05",
            "completedDate": None,
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "schemaVersion": 2,
            "id": "ORDER-100",
            "stopId": "stop_shared",
            "source": "OTHER",
            "workOrderId": "SAME-ID",
            "expectedPay": 12,
            "notes": "Gig ID deliberately matches workbook ID text",
            "routeIncluded": True,
            "dueDate": None,
            "completedDate": None,
            "createdAt": now,
            "updatedAt": now,
        },
        {
            "schemaVersion": 2,
            "id": "GIG-300",
            "stopId": "stop_manual",
            "source": "HNP",
            "workOrderId": "HNP-B",
            "expectedPay": 25,
            "notes": "Manual only job",
            "routeIncluded": True,
            "dueDate": "2026-09-06",
            "completedDate": None,
            "createdAt": now,
            "updatedAt": now,
        },
    ]
    google = {
        "routeIds": ["stop_shared", "stop_manual", "stop_second"],
        "sourceUpdatedAt": "2026-09-04T03:45:00.000Z",
        "optimizationStatus": "not_optimized",
        "orderIdsByStopId": {
            "stop_shared": ["ORDER-100", "ORDER-101"],
            "stop_second": ["ORDER-200"],
        },
        "workbookPayByStopId": {
            "stop_shared": {"expectedPay": 20, "expectedPayComplete": True},
            "stop_second": {"expectedPay": 10, "expectedPayComplete": True},
        },
        "gigIdsByStopId": {
            "stop_shared": ["GIG-200", "ORDER-100"],
            "stop_manual": ["GIG-300"],
        },
        "gigManagedStopIds": ["stop_manual"],
    }
    basic = {
        **google,
        "routeIds": ["stop_second", "stop_shared", "stop_manual"],
        "orderIdsByStopId": {
            "stop_second": ["ORDER-200"],
            "stop_shared": ["ORDER-100", "ORDER-101"],
        },
        "workbookPayByStopId": {
            "stop_second": {"expectedPay": 10, "expectedPayComplete": True},
            "stop_shared": {"expectedPay": 20, "expectedPayComplete": True},
        },
    }
    route = {"version": 5, "google": google, "basic": basic, "pending": None}
    return {
        "fmr_v2_stops": json.dumps(stops),
        "fmr_v2_home": json.dumps(home),
        "fmr_v1_gigs": json.dumps(gigs),
        "fmr_route_history_v1": json.dumps(route),
        "fmr_work_item_planning_v1": "[]",
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

    def js(expression):
        return driver.execute_script(f"return ({expression});")

    def check(name, condition, detail=None):
        results[name] = {"pass": bool(condition), "detail": detail}
        print(("PASS" if condition else "FAIL"), name, "" if detail is None else f":: {detail}")
        if not condition:
            raise AssertionError(name)

    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": """
                    window.__smokeErrors = [];
                    window.addEventListener('error', (e) => {
                        window.__smokeErrors.push({
                            type: 'error',
                            message: String(e.message || ''),
                            source: String(e.filename || '')
                        });
                    });
                    window.addEventListener('unhandledrejection', (e) => {
                        window.__smokeErrors.push({
                            type: 'rejection',
                            message: String(e.reason?.message || e.reason || '')
                        });
                    });
                """
            },
        )

        # First navigation creates only the disposable localhost origin.
        driver.get(APP_URL)
        fixture = build_fixture()
        driver.execute_script(
            "localStorage.clear(); sessionStorage.clear(); "
            "for (const [k,v] of Object.entries(arguments[0])) localStorage.setItem(k,v);",
            fixture,
        )
        driver.refresh()

        wait.until(lambda d: d.execute_script("return document.readyState === 'complete'"))
        wait.until(
            lambda d: d.execute_script(
                "return typeof window.FMRWorkItemPlanningRuntime === 'object'"
            )
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningPanel') !== null"
            )
        )
        driver.execute_script("showPage('route')")
        wait.until(
            lambda d: d.execute_script(
                "return document.querySelector('[data-page=route]').hidden === false"
            )
        )

        panel_count = js("document.querySelectorAll('#workItemPlanningPanel').length")
        route_rows = js("document.querySelectorAll('#routeList > li').length")
        check("single planning panel", panel_count == 1, panel_count)
        check("Google route renders each physical stop once", route_rows == 3, route_rows)

        options_data = js(
            "Array.from(document.querySelectorAll('#workItemPlanningSelect option'))"
            ".map(o=>({value:o.value,text:o.textContent,kind:o.dataset.kind,id:o.dataset.workItemId,stop:o.dataset.stopId}))"
        )
        values = [item["value"] for item in options_data]
        check("six exact work items appear on Google route", len(options_data) == 6, options_data)
        check(
            "same-text workbook and gig identities remain separate",
            "workbook:ORDER-100" in values and "gig:ORDER-100" in values,
            values,
        )
        shared = [item for item in options_data if item["stop"] == "stop_shared"]
        check(
            "shared physical stop exposes all four exact work items without duplicating the stop",
            len(shared) == 4 and route_rows == 3,
            shared,
        )
        manual_label = next(
            (item["text"] for item in options_data if item["value"] == "gig:GIG-200"),
            "",
        )
        check(
            "manual gig planning label carries manual work identity",
            "HNP" in manual_label and "HNP-A" in manual_label and "GIG-200" in manual_label,
            manual_label,
        )

        driver.execute_script(
            "const s=document.getElementById('routeChoice');"
            "s.value='basic';s.dispatchEvent(new Event('change',{bubbles:true}));"
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningRouteSummary').textContent.includes('Basic Route')"
            )
        )
        basic_first = js("document.querySelector('#routeList li')?.textContent || ''")
        check("switching to Basic Route rerenders the route", "200 Test Ave" in basic_first, basic_first)
        basic_values = js(
            "Array.from(document.querySelectorAll('#workItemPlanningSelect option')).map(o=>o.value)"
        )
        check("Basic Route retains all exact work identities", set(basic_values) == set(values), basic_values)

        driver.execute_script(
            "const s=document.getElementById('routeChoice');"
            "s.value='google';s.dispatchEvent(new Event('change',{bubbles:true}));"
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningRouteSummary').textContent.includes('Google Route')"
            )
        )

        driver.execute_script(
            """
            const s=document.getElementById('workItemPlanningSelect');
            s.value='workbook:ORDER-101';
            s.dispatchEvent(new Event('change',{bubbles:true}));
            document.getElementById('workItemPlanningMinutes').value='20';
            document.getElementById('workItemPlanningDate').value='2026-09-04';
            document.getElementById('workItemPlanningLocked').checked=true;
            document.getElementById('workItemPlanningForm')
                .dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
            """
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningStatus').textContent.includes('Revision 1')"
            )
        )
        workbook_record = js("FMRWorkItemPlanningRuntime.get('workbook','ORDER-101')")
        check(
            "workbook planning saves exact fields at revision 1",
            workbook_record
            and workbook_record["serviceMinutes"] == 20
            and workbook_record["assignedDate"] == "2026-09-04"
            and workbook_record["lockedDay"] is True
            and workbook_record["revision"] == 1,
            workbook_record,
        )

        driver.execute_script(
            """
            const s=document.getElementById('workItemPlanningSelect');
            s.value='gig:ORDER-100';
            s.dispatchEvent(new Event('change',{bubbles:true}));
            document.getElementById('workItemPlanningMinutes').value='15';
            document.getElementById('workItemPlanningDate').value='2026-09-05';
            document.getElementById('workItemPlanningLocked').checked=false;
            document.getElementById('workItemPlanningForm')
                .dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
            """
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningStatus').textContent.includes('Revision 1')"
            )
        )
        gig_record = js("FMRWorkItemPlanningRuntime.get('gig','ORDER-100')")
        workbook_same_text = js("FMRWorkItemPlanningRuntime.get('workbook','ORDER-100')")
        check(
            "same-text manual Gig_ID saves independently",
            gig_record
            and gig_record["serviceMinutes"] == 15
            and gig_record["assignedDate"] == "2026-09-05"
            and gig_record["revision"] == 1,
            gig_record,
        )
        check(
            "same-text workbook Order ID was not accidentally written",
            workbook_same_text is None,
            workbook_same_text,
        )

        driver.refresh()
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningPanel') !== null"
            )
        )
        driver.execute_script("showPage('route')")
        reload_workbook = js("FMRWorkItemPlanningRuntime.get('workbook','ORDER-101')")
        reload_gig = js("FMRWorkItemPlanningRuntime.get('gig','ORDER-100')")
        active_choice = js("document.getElementById('routeChoice').value")
        check(
            "planning survives browser reload",
            reload_workbook == workbook_record and reload_gig == gig_record,
            {"workbook": reload_workbook, "gig": reload_gig},
        )
        check("reload still opens Google Route as governed", active_choice == "google", active_choice)

        driver.execute_script(
            "const s=document.getElementById('workItemPlanningSelect');"
            "s.value='workbook:ORDER-101';s.dispatchEvent(new Event('change',{bubbles:true}));"
        )
        form_values = js(
            "({m:document.getElementById('workItemPlanningMinutes').value,"
            "d:document.getElementById('workItemPlanningDate').value,"
            "l:document.getElementById('workItemPlanningLocked').checked,"
            "r:document.getElementById('workItemPlanningForm').dataset.expectedRevision})"
        )
        check(
            "saved planning reloads into visible editor",
            form_values == {"m": "20", "d": "2026-09-04", "l": True, "r": "1"},
            form_values,
        )

        gig_state = js(
            "FMRManualGigs.list().map(g=>({id:g.id,stopId:g.stopId,routeIncluded:g.routeIncluded,workOrderId:g.workOrderId,source:g.source}))"
        )
        route_state = json.loads(js("localStorage.getItem('fmr_route_history_v1')"))
        check(
            "manual gig records remain intact after planning edits",
            len(gig_state) == 3 and all(item["routeIncluded"] for item in gig_state),
            gig_state,
        )
        check(
            "shared route still contains one physical stop after planning edits",
            route_state["google"]["routeIds"].count("stop_shared") == 1
            and route_state["basic"]["routeIds"].count("stop_shared") == 1,
            {
                "google": route_state["google"]["routeIds"],
                "basic": route_state["basic"]["routeIds"],
            },
        )
        check(
            "planning edits do not rewrite route work identity metadata",
            route_state["google"]["orderIdsByStopId"]["stop_shared"]
            == ["ORDER-100", "ORDER-101"]
            and route_state["google"]["gigIdsByStopId"]["stop_shared"]
            == ["GIG-200", "ORDER-100"],
            {
                "orders": route_state["google"]["orderIdsByStopId"]["stop_shared"],
                "gigs": route_state["google"]["gigIdsByStopId"]["stop_shared"],
            },
        )

        for _ in range(3):
            driver.execute_script("showPage('addresses')")
            driver.execute_script("showPage('route')")
        repeated_panel_count = js("document.querySelectorAll('#workItemPlanningPanel').length")
        check(
            "repeated page navigation does not duplicate planning UI",
            repeated_panel_count == 1,
            repeated_panel_count,
        )

        driver.set_window_size(390, 844)
        time.sleep(0.5)
        overflow = js(
            "Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth"
        )
        panel_rect = js(
            "(()=>{const r=document.getElementById('workItemPlanningPanel').getBoundingClientRect();"
            "return {left:r.left,right:r.right,width:r.width,viewport:innerWidth};})()"
        )
        check(
            "planning surface has no meaningful horizontal overflow at phone width",
            overflow <= 1,
            {"overflow": overflow, "panel": panel_rect},
        )
        driver.set_window_size(1280, 900)

        print("DWELL starting 31-second responsiveness check")
        time.sleep(31)
        driver.execute_script(
            "const s=document.getElementById('routeChoice');"
            "s.value='basic';s.dispatchEvent(new Event('change',{bubbles:true}));"
        )
        wait.until(
            lambda d: d.execute_script(
                "return document.getElementById('workItemPlanningRouteSummary').textContent.includes('Basic Route')"
            )
        )
        check(
            "Build Route remains interactive after 30+ seconds open",
            True,
            js("document.getElementById('workItemPlanningRouteSummary').textContent"),
        )

        captured_errors = js("window.__smokeErrors || []")
        first_party_errors = []
        for item in captured_errors:
            source = item.get("source", "") or ""
            message = item.get("message", "") or ""
            if "accounts.google.com" in source or "accounts.google.com" in message:
                continue
            first_party_errors.append(item)
        check(
            "no first-party uncaught browser errors",
            not first_party_errors,
            {"all": captured_errors, "firstParty": first_party_errors},
        )

        browser_logs = driver.get_log("browser")
        first_party_console_errors = [
            entry
            for entry in browser_logs
            if entry.get("level") == "SEVERE"
            and "accounts.google.com" not in entry.get("message", "")
            and "favicon.ico" not in entry.get("message", "")
        ]
        check(
            "no first-party severe browser console entries",
            not first_party_console_errors,
            first_party_console_errors,
        )

        evidence = {
            "checks": results,
            "planningStorage": json.loads(js("localStorage.getItem('fmr_work_item_planning_v1')")),
            "routeSummary": js("document.getElementById('workItemPlanningRouteSummary').textContent"),
            "routeRows": js(
                "Array.from(document.querySelectorAll('#routeList > li')).map(li=>li.textContent.trim())"
            ),
            "capturedErrors": captured_errors,
            "browserLogs": browser_logs,
        }
        EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
        print(f"SMOKE_COMPLETE {len(results)} checks passed")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
