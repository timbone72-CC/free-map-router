(function attachRouteNumberingUi() {
    "use strict";

    function routeSource(text) {
        const value = String(text || "").toUpperCase();
        if (/\bDCFS\b/.test(value)) return "DCFS";
        if (/\bGIS\b/.test(value)) return "GIS";
        return "";
    }

    function cleanRouteText(text) {
        return String(text || "")
            .replace(/\bMCS\b\s*[—–-]?\s*/gi, "")
            .replace(/^\s*\d{1,3}\s*[—–-]\s*/, "")
            .replace(/^\s*(DCFS|GIS)\s*[—–-]\s*/i, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function numberRouteList() {
        const list = document.getElementById("routeList");
        if (!list) return;

        const rows = Array.from(list.children);
        let stopNumber = 0;

        for (const row of rows) {
            const text = String(row.textContent || "").trim();
            if (/^(Start|Finish)\s*[—–-]/i.test(text)) continue;
            if (/^(No addresses selected|Save your Home)/i.test(text)) continue;

            const label = row.querySelector("span");
            if (!label) continue;

            stopNumber += 1;
            const original = label.dataset.fmrOriginalText || label.textContent || "";
            label.dataset.fmrOriginalText = original;

            const source = routeSource(original);
            const clean = cleanRouteText(original);
            const number = String(stopNumber).padStart(2, "0");
            label.textContent = source
                ? `${number} — ${source} — ${clean}`
                : `${number} — ${clean}`;
        }
    }

    function start() {
        const list = document.getElementById("routeList");
        if (!list) return;

        numberRouteList();
        const observer = new MutationObserver(numberRouteList);
        observer.observe(list, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
