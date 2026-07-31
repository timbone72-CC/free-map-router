const test = require("node:test");
const assert = require("node:assert/strict");

const {
    COMPANY_BACKUP_EMAIL,
    buildGmailComposeUrl,
    buildRouteBackupDocument,
    buildRouteBackupEmailBody,
    routeBackupDocumentName,
    routeNameForDate,
    routeSource,
    routeStopLine,
} = require("../route-backup.js");

function fixtureDate() {
    return new Date(2026, 6, 31, 13, 55, 4);
}

function fixtureSections() {
    return [
        {
            number: 1,
            total: 2,
            url: "https://www.google.com/maps/dir/?api=1&origin=Home&destination=Stop+2",
        },
        {
            number: 2,
            total: 2,
            url: "https://www.google.com/maps/dir/?api=1&origin=Stop+2&destination=Home",
        },
    ];
}

test("route backup names match the dated Garmin route without overwriting earlier files", () => {
    const date = fixtureDate();
    assert.equal(routeNameForDate(date), "Free Map Router 2026-07-31");
    assert.equal(
        routeBackupDocumentName(date),
        "Free Map Router Route Backup 2026-07-31 13-55-04",
    );
});

test("route backup document preserves numbered order, approved sources, Home, maps, and GPX name", () => {
    const backup = buildRouteBackupDocument({
        createdAt: fixtureDate(),
        home: { address: "222 Blackburn Blvd, Elk City, OK 73644" },
        stops: [
            {
                source: "GIS",
                address: "100 Main St, Elk City, OK 73644",
            },
            {
                label: "MCS",
                notes: "DCFS order",
                address: "200 A&B <Road>, Elk City, OK 73644",
            },
        ],
        sections: fixtureSections(),
        garminFilename: "free-map-router-2026-07-31.gpx",
    });

    assert.equal(backup.stopCount, 2);
    assert.deepEqual(backup.stopLines, [
        "01 — GIS — 100 Main St, Elk City, OK 73644",
        "02 — DCFS — 200 A&B <Road>, Elk City, OK 73644",
    ]);
    assert.match(backup.html, /222 Blackburn Blvd/);
    assert.match(backup.html, /Map 1 of 2/);
    assert.match(backup.html, /Map 2 of 2/);
    assert.match(backup.html, /free-map-router-2026-07-31\.gpx/);
    assert.match(backup.html, /200 A&amp;B &lt;Road&gt;/);
    assert.doesNotMatch(backup.html, />MCS</);
});

test("route source and line rules remain aligned with Build Route and Garmin", () => {
    assert.equal(routeSource({ source: "gis" }), "GIS");
    assert.equal(routeSource({ label: "MCS", notes: "" }), "");
    assert.equal(routeSource({ notes: "Guardian DCFS" }), "DCFS");
    assert.equal(
        routeStopLine({ address: "300 Main St" }, 2),
        "03 — 300 Main St",
    );
});

test("email compose targets the company Gmail and includes the Drive backup and every map section", () => {
    const backup = buildRouteBackupDocument({
        createdAt: fixtureDate(),
        home: { address: "Home" },
        stops: [{ address: "Stop 1" }],
        sections: fixtureSections(),
        garminFilename: "route.gpx",
    });
    const body = buildRouteBackupEmailBody(
        backup,
        "https://drive.google.com/open?id=route-backup-1",
    );
    const compose = buildGmailComposeUrl({
        subject: backup.emailSubject,
        body,
    });
    const url = new URL(compose);

    assert.equal(url.origin, "https://mail.google.com");
    assert.equal(url.searchParams.get("to"), COMPANY_BACKUP_EMAIL);
    assert.match(url.searchParams.get("su"), /^\[Free Map Router Backup\]/);
    assert.match(url.searchParams.get("body"), /Drive backup:/);
    assert.match(url.searchParams.get("body"), /Map 1 of 2:/);
    assert.match(url.searchParams.get("body"), /Map 2 of 2:/);
    assert.doesNotMatch(compose, /gmail\.googleapis\.com|mail\.google\.com\/mail\/u\/0\/api/);
});
