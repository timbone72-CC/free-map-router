const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexSource = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
);
const appSource = fs.readFileSync(
    path.join(__dirname, "..", "app.js"),
    "utf8",
);
const driveSource = fs.readFileSync(
    path.join(__dirname, "..", "google-drive.js"),
    "utf8",
);

test("Build Route exposes one manual route backup action without Gmail API access", () => {
    assert.match(indexSource, /id="saveRouteBackup"/);
    assert.match(indexSource, />\s*Save Route Backup\s*</);
    assert.match(indexSource, /id="routeBackupLinks"/);
    assert.match(indexSource, /route-backup\.js\?v=1\.0\.0/);
    assert.ok(
        indexSource.indexOf("route-backup.js?v=1.0.0") <
            indexSource.indexOf("app.js?v="),
    );

    assert.match(appSource, /saveCurrentRouteBackup/);
    assert.match(appSource, /saveRouteBackupToDrive/);
    assert.match(appSource, /buildGmailComposeUrl/);
    assert.doesNotMatch(appSource, /MutationObserver|setInterval\(/);

    assert.match(
        driveSource,
        /https:\/\/www\.googleapis\.com\/auth\/drive\.file/,
    );
    assert.doesNotMatch(
        `${appSource}\n${driveSource}`,
        /gmail\.googleapis\.com|https:\/\/www\.googleapis\.com\/auth\/gmail/,
    );
});
