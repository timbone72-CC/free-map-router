from pathlib import Path


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f"Expected one {label}; refusing to patch.")
    return text.replace(old, new, 1)


contract_path = Path("contract.js")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    '    const PIN_STATUSES = new Set(["unverified", "geocoded", "manual"]);\n',
    '    const PIN_STATUSES = new Set(["unverified", "geocoded", "manual"]);\n'
    '    const ROUTE_SOURCES = new Set(["GIS", "DCFS"]);\n',
    "route source constant anchor",
)
contract = replace_once(
    contract,
    '''    function text(value) {
        return (value ?? "").toString().trim();
    }
''',
    '''    function text(value) {
        return (value ?? "").toString().trim();
    }

    function normalizeSource(value) {
        const source = text(value).toUpperCase();
        return ROUTE_SOURCES.has(source) ? source : "";
    }
''',
    "text helper anchor",
)
contract = replace_once(
    contract,
    '''            label: text(raw?.label || raw?.company),
            notes: text(raw?.notes),
''',
    '''            label: text(raw?.label || raw?.company),
            source: normalizeSource(raw?.source),
            notes: text(raw?.notes),
''',
    "normalized stop fields anchor",
)
contract = replace_once(
    contract,
    '''            label: existing.label || incoming.label,
            notes: existing.notes || incoming.notes,
''',
    '''            label: existing.label || incoming.label,
            source: incoming.source || existing.source,
            notes: existing.notes || incoming.notes,
''',
    "merge stop fields anchor",
)
contract = replace_once(
    contract,
    '''        normalizeAddress,
        addressKey,
''',
    '''        normalizeAddress,
        normalizeSource,
        addressKey,
''',
    "contract export anchor",
)
contract_path.write_text(contract)

app_path = Path("app.js")
app = app_path.read_text()
app = replace_once(
    app,
    '''function routeDisplaySource(job) {
    const searchable = [job?.label, job?.notes]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();

    if (/\\bDCFS\\b/.test(searchable)) return "DCFS";
    if (/\\bGIS\\b/.test(searchable)) return "GIS";
    return "";
}
''',
    '''function routeDisplaySource(job) {
    const source = String(job?.source || "").trim().toUpperCase();
    if (source === "DCFS" || source === "GIS") return source;

    const searchable = [job?.label, job?.notes]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();

    if (/\\bDCFS\\b/.test(searchable)) return "DCFS";
    if (/\\bGIS\\b/.test(searchable)) return "GIS";
    return "";
}
''',
    "Build Route source helper",
)
app_path.write_text(app)

garmin_path = Path("garmin-gpx.js")
garmin = garmin_path.read_text()
garmin = replace_once(
    garmin,
    '''    function routeSource(point) {
        const searchable = [point?.label, point?.notes]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();

        if (/\\bDCFS\\b/.test(searchable)) return "DCFS";
        if (/\\bGIS\\b/.test(searchable)) return "GIS";
        return "";
    }
''',
    '''    function routeSource(point) {
        const source = String(point?.source || "").trim().toUpperCase();
        if (source === "DCFS" || source === "GIS") return source;

        const searchable = [point?.label, point?.notes]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();

        if (/\\bDCFS\\b/.test(searchable)) return "DCFS";
        if (/\\bGIS\\b/.test(searchable)) return "GIS";
        return "";
    }
''',
    "Garmin source helper",
)
garmin_path.write_text(garmin)

index_path = Path("index.html")
index = index_path.read_text()
index = replace_once(
    index,
    '<script src="contract.js?v=2.1.0"></script>',
    '<script src="contract.js?v=2.2.0"></script>',
    "contract cache version",
)
index = replace_once(
    index,
    '<script src="garmin-gpx.js?v=1.1.0"></script>',
    '<script src="garmin-gpx.js?v=1.2.0"></script>',
    "Garmin cache version",
)
index = replace_once(
    index,
    '<script src="app.js?v=3.8.0"></script>',
    '<script src="app.js?v=3.9.0"></script>',
    "app cache version",
)
index_path.write_text(index)

product_contract_path = Path("CONTRACT.md")
product_contract = product_contract_path.read_text()
product_contract = replace_once(
    product_contract,
    '''14. Build Route labels and Garmin point names may show `DCFS` or `GIS` when
    that source exists in the saved label or notes. They never insert `MCS`;
    when neither approved source is present, they show the number and address.
''',
    '''14. Build Route labels and Garmin point names may show `DCFS` or `GIS` when
    that source exists in the saved label or notes. They never insert `MCS`;
    when neither approved source is present, they show the number and address.
15. The live workbook may send an optional dedicated route `source` of `GIS` or
    `DCFS` with an address. That authoritative source is stored separately from
    client labels and notes, updates the matching physical address, and is used
    first by Build Route and Garmin. Older inboxes without `source` remain valid.
''',
    "route contract source rule",
)
product_contract_path.write_text(product_contract)

test_path = Path("tests/workbook-source-handoff.test.js")
if test_path.exists():
    raise SystemExit("Focused source handoff test already exists; refusing to overwrite.")
test_path.write_text(r'''const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const contract = require("../contract.js");
const { applyAddressInbox, parseAddressInbox } = require("../inbox.js");
const { routeSource, routePointName } = require("../garmin-gpx.js");
const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

function inboxText(addresses) {
    return JSON.stringify({
        app: "free-map-router",
        inboxVersion: 1,
        source: "InspectorADE Repeat Job Predictor - LIVE",
        updatedAt: "2026-07-31T14:00:00.000Z",
        addresses,
    });
}

function routeFormatter() {
    const match = appSource.match(
        /function routeDisplaySource\(job\) \{[\s\S]*?\n\}\n\nfunction formatRouteStopLine\(job, index\) \{[\s\S]*?\n\}/,
    );
    assert.ok(match, "Build Route source helpers must remain in app.js");
    const context = {};
    vm.runInNewContext(
        `${match[0]}\nthis.helpers = { routeDisplaySource, formatRouteStopLine };`,
        context,
    );
    return context.helpers;
}

test("only GIS and DCFS are accepted as dedicated route sources", () => {
    assert.equal(contract.normalizeSource(" gis "), "GIS");
    assert.equal(contract.normalizeSource("DCFS"), "DCFS");
    assert.equal(contract.normalizeSource("MCS"), "");
    assert.equal(contract.normalizeSource("Guardian"), "");
});

test("workbook source updates a matching address without replacing client data or pin", () => {
    const existing = [{
        id: "cache-stop",
        address: "420 NWGRANITE AVE, Cache",
        label: "MCS",
        notes: "Client details",
        latitude: 34.63615,
        longitude: -98.624558,
        pinStatus: "manual",
    }];
    const inbox = parseAddressInbox(inboxText([{
        address: "420 NWGRANITE AVE, Cache",
        source: "GIS",
    }]));
    const result = applyAddressInbox(existing, inbox);
    const stop = result.stops[0];

    assert.equal(stop.id, "cache-stop");
    assert.equal(stop.source, "GIS");
    assert.equal(stop.label, "MCS");
    assert.equal(stop.notes, "Client details");
    assert.equal(stop.pinStatus, "manual");
    assert.equal(stop.latitude, 34.63615);
    assert.equal(stop.longitude, -98.624558);
});

test("older workbook inboxes without source remain valid", () => {
    const inbox = parseAddressInbox(inboxText([{
        address: "100 Main St, Elk City, OK 73644",
    }]));
    assert.equal(inbox.addresses[0].source, "");
});

test("Build Route and Garmin prefer the dedicated workbook source", () => {
    const { formatRouteStopLine } = routeFormatter();
    const stop = {
        address: "420 NWGRANITE AVE, Cache",
        source: "GIS",
        label: "MCS",
        notes: "",
    };

    assert.equal(
        formatRouteStopLine(stop, 7),
        "08 — GIS — 420 NWGRANITE AVE, Cache",
    );
    assert.equal(routeSource(stop), "GIS");
    assert.equal(
        routePointName(stop, 8, 10),
        "08 - GIS - 420 NWGRANITE AVE, Cache",
    );
});

test("unknown dedicated source cannot override legacy fallback", () => {
    assert.equal(
        routeSource({ source: "MCS", label: "DCFS", notes: "" }),
        "DCFS",
    );
});

test("runtime source handling does not add observers or polling", () => {
    assert.doesNotMatch(appSource, /\bMutationObserver\b/);
    assert.doesNotMatch(appSource, /setInterval\s*\(/);
});
''')
