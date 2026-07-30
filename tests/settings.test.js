const test = require("node:test");
const assert = require("node:assert/strict");
const {
    GEOAPIFY_KEY,
    maskedKey,
    readGeoapifyKey,
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
