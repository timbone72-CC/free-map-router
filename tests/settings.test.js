const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    GEOAPIFY_KEY,
    isFreeMapRouterCache,
    maskedKey,
    readGeoapifyKey,
    updateApp,
    writeGeoapifyKey,
} = require("../settings.js");

function memoryStorage() {
    const data = new Map();
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
    };
}

function read(relativePath) {
    return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

test("Geoapify key remains in browser storage", () => {
    const storage = memoryStorage();
    writeGeoapifyKey(storage, "  test-private-key-1234  ");

    assert.equal(readGeoapifyKey(storage), "test-private-key-1234");
    assert.equal(
        storage.getItem(GEOAPIFY_KEY),
        "test-private-key-1234",
    );
});

test("saved key status never displays the full key", () => {
    const key = "test-private-key-1234";
    const status = maskedKey(key);

    assert.equal(status, "Key saved in this browser ••••1234");
    assert.equal(status.includes(key), false);
});

test("clearing the key removes it from browser storage", () => {
    const storage = memoryStorage();
    writeGeoapifyKey(storage, "temporary-key");
    writeGeoapifyKey(storage, "");

    assert.equal(readGeoapifyKey(storage), "");
});

test("Update App clears only this app's cache and service worker", async () => {
    const unregistered = [];
    const deletedCaches = [];
    let replacedUrl = "";

    const result = await updateApp({
        online: true,
        serviceWorker: {
            getRegistrations: async () => [
                {
                    scope: "https://example.test/free-map-router/",
                    unregister: async () => unregistered.push("router"),
                },
                {
                    scope: "https://example.test/field-ledger/",
                    unregister: async () => unregistered.push("other"),
                },
            ],
        },
        cacheStorage: {
            keys: async () => [
                "free-map-router-v4",
                "fmr-app-shell-v2",
                "field-ledger-v7",
            ],
            delete: async (name) => deletedCaches.push(name),
        },
        location: {
            href: "https://example.test/free-map-router/?release=old",
            replace: (url) => {
                replacedUrl = url;
            },
        },
        now: () => 12345,
    });

    assert.deepEqual(unregistered, ["router"]);
    assert.deepEqual(deletedCaches, [
        "free-map-router-v4",
        "fmr-app-shell-v2",
    ]);
    assert.equal(
        replacedUrl,
        "https://example.test/free-map-router/?release=old&update=12345",
    );
    assert.deepEqual(result, { updated: true });
    assert.equal(isFreeMapRouterCache("field-ledger-v7"), false);
});

test("Update App stays put while offline", async () => {
    let replaced = false;
    const result = await updateApp({
        online: false,
        location: {
            href: "https://example.test/free-map-router/",
            replace: () => {
                replaced = true;
            },
        },
    });

    assert.deepEqual(result, { updated: false, reason: "offline" });
    assert.equal(replaced, false);
});

test("Settings exposes the protected Update App control", () => {
    const html = read("index.html");
    const app = read("app.js");

    assert.match(html, /id="updateApp"[^>]*>[\s\S]*?Update App/);
    assert.match(html, /Your saved[\s\S]*addresses and routes stay/);
    assert.match(app, /els\.updateApp\.addEventListener\("click"/);
    assert.match(app, /online: navigator\.onLine !== false/);
});
