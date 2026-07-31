const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function localScriptSources() {
    const html = read("index.html");
    return Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g))
        .map((match) => match[1])
        .filter((source) => !/^https?:\/\//i.test(source));
}

function runtimeExceptions() {
    return JSON.parse(read("RUNTIME_EXCEPTIONS.json"));
}

test("contract-first guardrails use three proportionate risk levels", () => {
    const agents = read("AGENTS.md");
    const contract = read("CONTRACT.md");
    const changeControl = read("CHANGE_CONTROL_CONTRACT.md");
    const regression = read("REGRESSION_CHECKLIST.md");
    const pullRequestTemplate = read(".github/pull_request_template.md");

    for (const document of [agents, changeControl, pullRequestTemplate]) {
        assert.match(document, /Level 1/);
        assert.match(document, /Level 2/);
        assert.match(document, /Level 3/);
    }

    assert.match(agents, /Mandatory contract read/);
    assert.match(agents, /Do not ask for the same approval again/);
    assert.match(contract, /process must match the risk/);
    assert.match(changeControl, /keeping useful development moving/);
    assert.match(changeControl, /No duplicate approval is required/);
    assert.match(regression, /Documentation-only Level 1 changes do not require a live app smoke test/);
    assert.match(regression, /Extended responsiveness check/);
});

test("every local JavaScript loaded by index exists and is cache-versioned", () => {
    for (const source of localScriptSources()) {
        assert.match(source, /\.js\?v=[A-Za-z0-9._-]+$/);
        const file = source.replace(/\?.*$/, "");
        assert.equal(
            fs.existsSync(path.join(root, file)),
            true,
            `${file} is loaded by index.html but does not exist`,
        );
    }
});

test("runtime exceptions are explicit, narrow, and reference real files", () => {
    const exceptions = runtimeExceptions();

    assert.ok(Array.isArray(exceptions.postAppScripts));
    assert.ok(Array.isArray(exceptions.mutationObservers));

    for (const entry of exceptions.postAppScripts) {
        assert.equal(typeof entry.file, "string");
        assert.ok(entry.file.endsWith(".js"));
        assert.equal(typeof entry.reason, "string");
        assert.ok(entry.reason.trim().length >= 20);
        assert.ok(fs.existsSync(path.join(root, entry.file)));
    }

    for (const entry of exceptions.mutationObservers) {
        assert.equal(typeof entry.file, "string");
        assert.equal(typeof entry.reason, "string");
        assert.equal(typeof entry.test, "string");
        assert.ok(entry.reason.trim().length >= 20);
        assert.ok(fs.existsSync(path.join(root, entry.file)));
        assert.ok(fs.existsSync(path.join(root, entry.test)));
    }
});

test("scripts loaded after app.js are declared as narrow adapters", () => {
    const sources = localScriptSources().map((source) =>
        source.replace(/\?.*$/, ""),
    );
    const appIndex = sources.indexOf("app.js");
    const allowed = new Set(
        runtimeExceptions().postAppScripts.map((entry) => entry.file),
    );

    assert.notEqual(appIndex, -1);
    for (const file of sources.slice(appIndex + 1)) {
        assert.ok(
            allowed.has(file),
            `${file} loads after app.js without a runtime exception record`,
        );
    }
});

test("loaded production scripts use only approved DOM observers", () => {
    const allowed = new Set(
        runtimeExceptions().mutationObservers.map((entry) => entry.file),
    );
    const offenders = localScriptSources()
        .map((source) => source.replace(/\?.*$/, ""))
        .filter((file) => /\bMutationObserver\b/.test(read(file)))
        .filter((file) => !allowed.has(file));

    assert.deepEqual(
        offenders,
        [],
        `Unapproved MutationObserver found in loaded scripts: ${offenders.join(", ")}`,
    );
});
