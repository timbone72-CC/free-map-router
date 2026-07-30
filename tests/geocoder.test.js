const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CACHE_KEY,
    GEOAPIFY_MIN_REQUEST_INTERVAL_MS,
    MIN_REQUEST_INTERVAL_MS,
    findAddress,
    findAddressWithGeoapify,
    mapUrl,
} = require("../geocoder.js");

function memoryStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

test("free lookup requests one US result and caches it", async () => {
    const storage = memoryStorage();
    let requestedUrl = "";
    let requestCount = 0;

    const fetchFn = async (url) => {
        requestCount++;
        requestedUrl = url;
        return {
            ok: true,
            json: async () => [
                {
                    lat: "35.4111",
                    lon: "-99.4042",
                    display_name: "Test address",
                },
            ],
        };
    };

    const first = await findAddress("100 Main St, Elk City, OK", {
        storage,
        fetchFn,
        waitFn: async () => {},
    });
    const second = await findAddress("  100 MAIN ST, ELK CITY, OK  ", {
        storage,
        fetchFn,
        waitFn: async () => {},
    });

    const request = new URL(requestedUrl);
    assert.equal(request.searchParams.get("limit"), "1");
    assert.equal(request.searchParams.get("countrycodes"), "us");
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(requestCount, 1);
    assert.ok(storage.getItem(CACHE_KEY));
});

test("lookup rejects a response without usable coordinates", async () => {
    await assert.rejects(
        findAddress("Missing Place", {
            storage: memoryStorage(),
            fetchFn: async () => ({
                ok: true,
                json: async () => [],
            }),
            waitFn: async () => {},
        }),
        /No location was found/,
    );
});

test("map preview targets the exact found coordinates", () => {
    const url = mapUrl(35.4111, -99.4042);
    assert.match(url, /mlat=35.4111/);
    assert.match(url, /mlon=-99.4042/);
});

test("free provider interval remains one second", () => {
    assert.equal(MIN_REQUEST_INTERVAL_MS, 1000);
});

test("automatic lookup uses Geoapify and caches the location", async () => {
    const storage = memoryStorage();
    let requestedUrl = "";
    let requestCount = 0;
    const fetchFn = async (url) => {
        requestCount++;
        requestedUrl = url;
        return {
            ok: true,
            json: async () => ({
                results: [
                    {
                        lat: 35.5262,
                        lon: -98.7076,
                        formatted: "400 N 6th St, Weatherford, OK 73096",
                    },
                ],
            }),
        };
    };

    const first = await findAddressWithGeoapify(
        "400 N 6th St, Weatherford, OK 73096",
        "test-key",
        { storage, fetchFn, waitFn: async () => {} },
    );
    const second = await findAddressWithGeoapify(
        " 400 N 6TH ST, WEATHERFORD, OK 73096 ",
        "test-key",
        { storage, fetchFn, waitFn: async () => {} },
    );

    const request = new URL(requestedUrl);
    assert.equal(request.searchParams.get("text"), "400 N 6th St, Weatherford, OK 73096");
    assert.equal(request.searchParams.get("filter"), "countrycode:us");
    assert.equal(request.searchParams.get("limit"), "1");
    assert.equal(request.searchParams.get("apiKey"), "test-key");
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(requestCount, 1);
});

test("Geoapify lookup requires a saved key", async () => {
    await assert.rejects(
        findAddressWithGeoapify("400 N 6th St, Weatherford, OK 73096", ""),
        /Save the Geoapify key/,
    );
});

test("Geoapify requests stay below the free rate limit", () => {
    assert.equal(GEOAPIFY_MIN_REQUEST_INTERVAL_MS, 250);
});
