const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function rootJavaScriptFiles() {
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
        .map((entry) => entry.name)
        .sort();
}

test("contract-first control documents are present and mandatory", () => {
    const agents = read("AGENTS.md");
    const changeControl = read("CHANGE_CONTROL_CONTRACT.md");
    const regression = read("REGRESSION_CHECKLIST.md");

    assert.match(agents, /Mandatory read order/);
    assert.match(agents, /Never make an intentional behavior change directly on `main`/);
    assert.match(changeControl, /A `MutationObserver` is prohibited by default/);
    assert.match(changeControl, /Use a pull request into `main`/);
    assert.match(regression, /Address page — protected live smoke test/);
    assert.match(regression, /browser unresponsive warning/);
});

test("first-party production scripts do not use unapproved DOM observers", () => {
    const offenders = rootJavaScriptFiles().filter((filename) =>
        /\bMutationObserver\b/.test(read(filename)),
    );

    assert.deepEqual(
        offenders,
        [],
        `Unapproved MutationObserver found in: ${offenders.join(", ")}`,
    );
});

test("the recursive route-numbering hotfix script is not retained", () => {
    assert.equal(
        fs.existsSync(path.join(root, "route-numbering-ui.js")),
        false,
    );
});

test("every local JavaScript loaded by index exists and is cache-versioned", () => {
    const html = read("index.html");
    const sources = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map(
        (match) => match[1],
    );
    const localSources = sources.filter(
        (source) => !/^https?:\/\//i.test(source),
    );

    for (const source of localSources) {
        assert.match(source, /\.js\?v=[A-Za-z0-9._-]+$/);
        const file = source.replace(/\?.*$/, "");
        assert.equal(
            fs.existsSync(path.join(root, file)),
            true,
            `${file} is loaded by index.html but does not exist`,
        );
    }
});

test("only the approved Garmin button adapter loads after app.js", () => {
    const html = read("index.html");
    const sources = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g))
        .map((match) => match[1])
        .filter((source) => !/^https?:\/\//i.test(source))
        .map((source) => source.replace(/\?.*$/, ""));
    const appIndex = sources.indexOf("app.js");

    assert.notEqual(appIndex, -1);
    assert.deepEqual(sources.slice(appIndex + 1), ["garmin-export-ui.js"]);

    const adapter = read("garmin-export-ui.js");
    assert.doesNotMatch(adapter, /\bMutationObserver\b/);
    assert.doesNotMatch(adapter, /fmrOriginalText/);
});
