#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


path = "index.html"
text = read(path)
text = replace_once(
    text,
    '''                <button
                    id="downloadGarminGpx"
                    type="button"
                    class="btn btnSmall"
                >
                    Download Garmin GPX
                </button>
''',
    '''                <button
                    id="downloadGarminGpx"
                    type="button"
                    class="btn btnSmall"
                >
                    Download Garmin GPX
                </button>
                <button
                    id="saveRouteBackup"
                    type="button"
                    class="btn btnSmall"
                >
                    Save Route Backup
                </button>
''',
    "index route backup button",
)
text = replace_once(
    text,
    '''            <div id="routeMapLinks" class="btnRow" hidden></div>
            <p id="routeStatus" class="tiny muted">
''',
    '''            <div id="routeMapLinks" class="btnRow" hidden></div>
            <div id="routeBackupLinks" class="btnRow" hidden></div>
            <p id="routeStatus" class="tiny muted">
''',
    "index route backup links",
)
text = replace_once(
    text,
    '''        <script src="google-drive.js?v=1.4.0"></script>
        <script src="routing.js?v=1.4.0"></script>
        <script src="garmin-gpx.js?v=1.2.0"></script>
        <script src="vendor/leaflet.js?v=1.9.4"></script>
        <script src="app.js?v=3.10.1"></script>
''',
    '''        <script src="google-drive.js?v=1.5.0"></script>
        <script src="routing.js?v=1.4.0"></script>
        <script src="garmin-gpx.js?v=1.2.0"></script>
        <script src="route-backup.js?v=1.0.0"></script>
        <script src="vendor/leaflet.js?v=1.9.4"></script>
        <script src="app.js?v=3.11.0"></script>
''',
    "index script versions",
)
write(path, text)

path = "google-drive.js"
text = read(path)
text = replace_once(
    text,
    '''    const DRIVE_INBOX_NAME = "Free Map Router Address Inbox.json";
''',
    '''    const DRIVE_INBOX_NAME = "Free Map Router Address Inbox.json";
    const DRIVE_ROUTE_BACKUPS_FOLDER_NAME = "Route Backups";
''',
    "Drive route backup folder constant",
)

drive_functions = r'''
    async function findRouteBackupsFolder(
        token,
        appFolderId,
        fetchFn = globalThis.fetch,
    ) {
        const url = new URL("https://www.googleapis.com/drive/v3/files");
        url.searchParams.set(
            "q",
            `name = '${DRIVE_ROUTE_BACKUPS_FOLDER_NAME}' and '${appFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        );
        url.searchParams.set("spaces", "drive");
        url.searchParams.set("fields", "files(id,name,parents)");
        url.searchParams.set("pageSize", "1");

        const response = await fetchFn(url.toString(), {
            headers: authorizationHeaders(token),
        });
        requireSuccessfulResponse(
            response,
            "Google Drive could not find the Route Backups folder.",
        );
        const data = await response.json();
        return Array.isArray(data?.files) ? data.files[0] || null : null;
    }

    async function createRouteBackupsFolder(
        token,
        appFolderId,
        fetchFn = globalThis.fetch,
    ) {
        const response = await fetchFn(
            "https://www.googleapis.com/drive/v3/files?fields=id,name,parents",
            {
                method: "POST",
                headers: {
                    ...authorizationHeaders(token),
                    "Content-Type": "application/json; charset=UTF-8",
                },
                body: JSON.stringify({
                    name: DRIVE_ROUTE_BACKUPS_FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder",
                    parents: [appFolderId],
                    appProperties: {
                        app: "free-map-router",
                        role: "route-backups-folder",
                    },
                }),
            },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not create the Route Backups folder.",
        );
        return response.json();
    }

    async function ensureRouteBackupsFolder(
        token,
        appFolderId,
        fetchFn = globalThis.fetch,
    ) {
        return (
            (await findRouteBackupsFolder(token, appFolderId, fetchFn)) ||
            createRouteBackupsFolder(token, appFolderId, fetchFn)
        );
    }

    async function createRouteBackupDocument(
        token,
        folderId,
        routeBackup,
        fetchFn = globalThis.fetch,
    ) {
        const documentName = String(routeBackup?.documentName || "").trim();
        const html = String(routeBackup?.html || "");
        if (!documentName || !html) {
            throw new Error("The route backup document is incomplete.");
        }

        const boundary = `fmr_route_${Date.now().toString(16)}`;
        const metadata = {
            name: documentName,
            mimeType: "application/vnd.google-apps.document",
            parents: [folderId],
            appProperties: {
                app: "free-map-router",
                role: "route-backup",
            },
        };
        const body = [
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify(metadata),
            `--${boundary}`,
            "Content-Type: text/html; charset=UTF-8",
            "",
            html,
            `--${boundary}--`,
            "",
        ].join("\r\n");

        const response = await fetchFn(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,parents",
            {
                method: "POST",
                headers: {
                    ...authorizationHeaders(token),
                    "Content-Type": `multipart/related; boundary=${boundary}`,
                },
                body,
            },
        );
        requireSuccessfulResponse(
            response,
            "Google Drive could not create the route backup document.",
        );
        return response.json();
    }

    async function saveRouteBackupToDrive(
        token,
        routeBackup,
        fetchFn = globalThis.fetch,
    ) {
        const appFolder = await ensureBackupFolder(token, fetchFn);
        const routeFolder = await ensureRouteBackupsFolder(
            token,
            appFolder.id,
            fetchFn,
        );
        return createRouteBackupDocument(
            token,
            routeFolder.id,
            routeBackup,
            fetchFn,
        );
    }

'''
text = replace_once(
    text,
    '''    function requestDriveToken() {
''',
    drive_functions + '''    function requestDriveToken() {
''',
    "Drive route backup functions",
)
text = replace_once(
    text,
    '''        DRIVE_INBOX_NAME,
        DRIVE_SCOPE,
        ensureAddressInbox,
''',
    '''        DRIVE_INBOX_NAME,
        DRIVE_ROUTE_BACKUPS_FOLDER_NAME,
        DRIVE_SCOPE,
        createRouteBackupDocument,
        ensureAddressInbox,
        ensureRouteBackupsFolder,
''',
    "Drive route backup exports 1",
)
text = replace_once(
    text,
    '''        findAddressInbox,
        findBackupFolder,
        findBackupFile,
''',
    '''        findAddressInbox,
        findBackupFolder,
        findBackupFile,
        findRouteBackupsFolder,
''',
    "Drive route backup exports 2",
)
text = replace_once(
    text,
    '''        requestDriveToken,
        saveBackupToDrive,
''',
    '''        requestDriveToken,
        saveBackupToDrive,
        saveRouteBackupToDrive,
''',
    "Drive route backup exports 3",
)
write(path, text)

path = "app.js"
text = read(path)
text = replace_once(
    text,
    '''if (!globalThis.FMRInbox) {
    throw new Error("Free Map Router workbook inbox failed to load.");
}

''',
    '''if (!globalThis.FMRInbox) {
    throw new Error("Free Map Router workbook inbox failed to load.");
}

if (!globalThis.FMRRouteBackup) {
    throw new Error("Free Map Router route backup helper failed to load.");
}

if (!globalThis.FMRGarminGpx) {
    throw new Error("Free Map Router Garmin helper failed to load.");
}

''',
    "app route backup prerequisites",
)
text = replace_once(
    text,
    '''const {
    applyAddressInbox,
    parseAddressInbox,
} = globalThis.FMRInbox;
const {
''',
    '''const {
    applyAddressInbox,
    parseAddressInbox,
} = globalThis.FMRInbox;
const {
    COMPANY_BACKUP_EMAIL,
    buildGmailComposeUrl,
    buildRouteBackupDocument,
    buildRouteBackupEmailBody,
    routeNameForDate,
} = globalThis.FMRRouteBackup;
const {
''',
    "app route backup imports",
)
text = replace_once(
    text,
    '''    requestDriveToken,
    saveBackupToDrive,
} = globalThis.FMRGoogleDrive;
''',
    '''    requestDriveToken,
    saveBackupToDrive,
    saveRouteBackupToDrive,
} = globalThis.FMRGoogleDrive;
''',
    "app Drive route backup import",
)
text = replace_once(
    text,
    '''    routeMapLinks: document.getElementById("routeMapLinks"),
    clearRoute: document.getElementById("clearRoute"),

    // actions
    optimizeRoute: document.getElementById("optimizeRoute"),
    exportRoute: document.getElementById("exportRoute"),
''',
    '''    routeMapLinks: document.getElementById("routeMapLinks"),
    routeBackupLinks: document.getElementById("routeBackupLinks"),
    clearRoute: document.getElementById("clearRoute"),

    // actions
    optimizeRoute: document.getElementById("optimizeRoute"),
    exportRoute: document.getElementById("exportRoute"),
    saveRouteBackup: document.getElementById("saveRouteBackup"),
''',
    "app route backup DOM",
)
text = replace_once(
    text,
    '''function renderRouteList() {
    const list = els.routeList;
''',
    '''function renderRouteList() {
    clearRouteBackupActions();
    const list = els.routeList;
''',
    "clear stale route backup links",
)

app_functions = r'''
function clearRouteBackupActions() {
    if (!els.routeBackupLinks) return;
    els.routeBackupLinks.innerHTML = "";
    els.routeBackupLinks.hidden = true;
}

function showRouteBackupActions(driveUrl, gmailUrl) {
    if (!els.routeBackupLinks) return;
    clearRouteBackupActions();

    const savedLink = document.createElement("a");
    savedLink.className = "btn btnSmall";
    savedLink.href = driveUrl;
    savedLink.target = "_blank";
    savedLink.rel = "noopener";
    savedLink.textContent = "Open Saved Backup";

    const gmailLink = document.createElement("a");
    gmailLink.className = "btn btnSmall";
    gmailLink.href = gmailUrl;
    gmailLink.target = "_blank";
    gmailLink.rel = "noopener";
    gmailLink.textContent = "Open Gmail Message";

    els.routeBackupLinks.appendChild(savedLink);
    els.routeBackupLinks.appendChild(gmailLink);
    els.routeBackupLinks.hidden = false;
}

async function saveCurrentRouteBackup() {
    if (!home) {
        alert("Save your Home / Route Base first.");
        return;
    }

    const selected = selectedRouteJobs();
    if (selected.length === 0) {
        alert("No addresses are currently listed in the route.");
        return;
    }

    const sections = buildGoogleMapsRouteSections(home, selected);
    if (sections.length === 0) {
        alert(
            "The current route could not create valid Google Maps links.",
        );
        return;
    }

    const generatedAt = new Date();
    const routeName = routeNameForDate(generatedAt);
    const routeBackup = buildRouteBackupDocument({
        createdAt: generatedAt,
        home,
        stops: selected,
        sections,
        garminFilename: globalThis.FMRGarminGpx.garminFilename(routeName),
    });

    const composeTab = window.open("about:blank", "_blank");
    if (composeTab) {
        try {
            composeTab.document.title = "Preparing route backup…";
            composeTab.document.body.textContent =
                "Saving the route backup to Google Drive…";
        } catch (error) {
            console.warn("Could not prepare the Gmail tab:", error);
        }
    }

    els.saveRouteBackup.disabled = true;
    clearRouteBackupActions();
    if (els.routeStatus) {
        els.routeStatus.textContent =
            "Saving a dated route backup to Google Drive…";
    }

    try {
        const token = await requestDriveToken();
        const saved = await saveRouteBackupToDrive(token, routeBackup);
        const driveUrl =
            String(saved?.webViewLink || "").trim() ||
            `https://drive.google.com/open?id=${encodeURIComponent(saved?.id || "")}`;
        const gmailUrl = buildGmailComposeUrl({
            to: COMPANY_BACKUP_EMAIL,
            subject: routeBackup.emailSubject,
            body: buildRouteBackupEmailBody(routeBackup, driveUrl),
        });

        showRouteBackupActions(driveUrl, gmailUrl);

        if (composeTab && !composeTab.closed) {
            composeTab.location.replace(gmailUrl);
        } else {
            window.open(gmailUrl, "_blank");
        }

        if (els.routeStatus) {
            els.routeStatus.textContent =
                `Route backup saved in Free Map Router / Route Backups. ` +
                `A Gmail message to ${COMPANY_BACKUP_EMAIL} is ready for review and sending.`;
        }
    } catch (error) {
        if (composeTab && !composeTab.closed) composeTab.close();
        if (els.routeStatus) {
            els.routeStatus.textContent =
                error?.message || "The route backup could not be saved.";
        }
    } finally {
        els.saveRouteBackup.disabled = false;
    }
}

'''
text = replace_once(
    text,
    '''// ============================================================================
// SECTION 13 — Event Wiring
// ============================================================================
''',
    app_functions + '''// ============================================================================
// SECTION 13 — Event Wiring
// ============================================================================
''',
    "app route backup handler",
)
text = replace_once(
    text,
    '''if (els.exportRoute) {
    els.exportRoute.addEventListener("click", exportToGoogleMaps);
}

''',
    '''if (els.exportRoute) {
    els.exportRoute.addEventListener("click", exportToGoogleMaps);
}

if (els.saveRouteBackup) {
    els.saveRouteBackup.addEventListener("click", saveCurrentRouteBackup);
}

''',
    "app route backup event",
)
write(path, text)

path = "tests/google-drive.test.js"
text = read(path)
text = replace_once(
    text,
    '''    DRIVE_INBOX_NAME,
    DRIVE_SCOPE,
    currentDriveToken,
    ensureAddressInbox,
    ensureBackupFolder,
''',
    '''    DRIVE_INBOX_NAME,
    DRIVE_ROUTE_BACKUPS_FOLDER_NAME,
    DRIVE_SCOPE,
    currentDriveToken,
    ensureAddressInbox,
    ensureBackupFolder,
    ensureRouteBackupsFolder,
''',
    "Drive test imports 1",
)
text = replace_once(
    text,
    '''    findAddressInbox,
    loadAddressInboxFromDrive,
    loadBackupFromDrive,
    saveBackupToDrive,
''',
    '''    findAddressInbox,
    findRouteBackupsFolder,
    loadAddressInboxFromDrive,
    loadBackupFromDrive,
    saveBackupToDrive,
    saveRouteBackupToDrive,
''',
    "Drive test imports 2",
)
text = replace_once(
    text,
    '''    assert.equal(DRIVE_INBOX_NAME, "Free Map Router Address Inbox.json");
});
''',
    '''    assert.equal(DRIVE_INBOX_NAME, "Free Map Router Address Inbox.json");
    assert.equal(DRIVE_ROUTE_BACKUPS_FOLDER_NAME, "Route Backups");
});
''',
    "Drive test folder constant",
)

text += r'''

test("route backup folder search stays under the app-owned Drive folder", async () => {
    let requestedUrl = "";
    await findRouteBackupsFolder(
        "token",
        "app-folder-1",
        async (url, options) => {
            requestedUrl = url;
            assert.equal(options.headers.Authorization, "Bearer token");
            return { ok: true, json: async () => ({ files: [] }) };
        },
    );

    const request = new URL(requestedUrl);
    assert.match(request.searchParams.get("q"), /Route Backups/);
    assert.match(request.searchParams.get("q"), /'app-folder-1' in parents/);
    assert.match(request.searchParams.get("q"), /google-apps\.folder/);
});

test("route backup save creates a new Google Doc inside Route Backups without changing scope", async () => {
    const requests = [];
    const fetchFn = async (url, options = {}) => {
        requests.push({ url, options });
        if (requests.length === 1) {
            return {
                ok: true,
                json: async () => ({ files: [{ id: "app-folder-1" }] }),
            };
        }
        if (requests.length === 2) {
            return { ok: true, json: async () => ({ files: [] }) };
        }
        if (requests.length === 3) {
            assert.equal(options.method, "POST");
            assert.match(options.body, /Route Backups/);
            assert.match(options.body, /"parents":\["app-folder-1"\]/);
            return {
                ok: true,
                json: async () => ({ id: "route-folder-1" }),
            };
        }

        assert.equal(options.method, "POST");
        assert.match(url, /uploadType=multipart/);
        assert.match(options.body, /Free Map Router Route Backup 2026-07-31/);
        assert.match(
            options.body,
            /application\/vnd\.google-apps\.document/,
        );
        assert.match(options.body, /"parents":\["route-folder-1"\]/);
        assert.match(options.body, /role":"route-backup"/);
        assert.match(options.body, /Map 1 of 1/);
        return {
            ok: true,
            json: async () => ({
                id: "route-doc-1",
                webViewLink: "https://docs.google.com/document/d/route-doc-1/edit",
            }),
        };
    };

    const result = await saveRouteBackupToDrive(
        "token",
        {
            documentName: "Free Map Router Route Backup 2026-07-31 13-55-04",
            html: "<h1>Route</h1><a>Map 1 of 1</a>",
        },
        fetchFn,
    );

    assert.equal(result.id, "route-doc-1");
    assert.equal(
        result.webViewLink,
        "https://docs.google.com/document/d/route-doc-1/edit",
    );
    assert.equal(DRIVE_SCOPE, "https://www.googleapis.com/auth/drive.file");
});

test("existing Route Backups folder is reused without creating another folder", async () => {
    let count = 0;
    const folder = await ensureRouteBackupsFolder(
        "token",
        "app-folder-1",
        async () => {
            count += 1;
            return {
                ok: true,
                json: async () => ({
                    files: [{ id: "route-folder-existing" }],
                }),
            };
        },
    );
    assert.equal(folder.id, "route-folder-existing");
    assert.equal(count, 1);
});
'''
write(path, text)

path = "CONTRACT.md"
text = read(path)
text = replace_once(
    text,
    '''11. Connecting Google Drive reads that inbox. Valid Daily Print addresses are
    added to saved addresses without weakening existing pins, and only the
    current route selection is replaced in workbook print order.
''',
    '''11. Connecting Google Drive reads that inbox. Valid Daily Print addresses are
    added to saved addresses without weakening existing pins, and only the
    current route selection is replaced in workbook print order.
12. **Save Route Backup** is a manual Build Route action. It reads the current
    Home and route order without changing either one.
13. Each successful route-backup action creates one new dated Google Doc inside
    **Free Map Router / Route Backups**. It never replaces or deletes an earlier
    route backup.
14. The route-backup document includes Home, every selected stop once in current
    numbered order, every Google Maps section, stop count, and the matching
    Garmin GPX filename.
15. After the Drive document is created, the app opens a ready-to-review Gmail
    compose message addressed to `InandOutInspections2026@gmail.com`. Sending
    remains a manual operator action.
16. Route-backup email subjects begin with `[Free Map Router Backup]` so the
    company mailbox can file them with one Gmail filter and label.
17. Route backup does not request Gmail API access, read the mailbox, send
    automatically, create labels, or expand the existing `drive.file` scope.
''',
    "contract route backup rules",
)
write(path, text)

path = "REGRESSION_CHECKLIST.md"
text = read(path)
text = replace_once(
    text,
    '''## Level 3 release checks
''',
    '''## Route backup and email checks

- [ ] Saving requires Home and at least one current route stop.
- [ ] One click creates one new dated Google Doc under
      **Free Map Router / Route Backups** and does not replace an older backup.
- [ ] The document preserves every current stop once in route order, approved
      GIS/DCFS labels, Home, every Google Maps section, and the Garmin filename.
- [ ] The ready Gmail message is addressed to
      `InandOutInspections2026@gmail.com`, includes the Drive link and every map
      section, and is not sent automatically.
- [ ] The app retains only `drive.file` permission and adds no Gmail API scope.
- [ ] Changing the current route clears earlier temporary backup result links.
- [ ] Route backup does not change saved addresses, pins, Home, route order,
      workbook inbox, regular Drive autosave, Google Maps, or Garmin export.

## Level 3 release checks
''',
    "regression route backup checks",
)
write(path, text)

print("route backup and email patch applied")
