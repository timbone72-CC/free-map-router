(function attachFreeMapRouterRouteBackup(root, factory) {
    const routeBackup = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = routeBackup;
    }

    if (root) {
        root.FMRRouteBackup = routeBackup;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRouteBackup() {
    "use strict";

    const COMPANY_BACKUP_EMAIL = "InandOutInspections2026@gmail.com";
    const GMAIL_COMPOSE_URL = "https://mail.google.com/mail/";

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function validDate(value) {
        const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
        if (!Number.isFinite(date.getTime())) {
            throw new Error("A valid route backup date is required.");
        }
        return date;
    }

    function localDateParts(value) {
        const date = validDate(value);
        return {
            year: String(date.getFullYear()),
            month: String(date.getMonth() + 1).padStart(2, "0"),
            day: String(date.getDate()).padStart(2, "0"),
            hour: String(date.getHours()).padStart(2, "0"),
            minute: String(date.getMinutes()).padStart(2, "0"),
            second: String(date.getSeconds()).padStart(2, "0"),
        };
    }

    function routeNameForDate(value) {
        const parts = localDateParts(value);
        return `Free Map Router ${parts.year}-${parts.month}-${parts.day}`;
    }

    function routeBackupDocumentName(value) {
        const parts = localDateParts(value);
        return (
            `Free Map Router Route Backup ${parts.year}-${parts.month}-${parts.day} ` +
            `${parts.hour}-${parts.minute}-${parts.second}`
        );
    }

    function routeSource(stop) {
        const source = String(stop?.source || "").trim().toUpperCase();
        if (source === "GIS" || source === "DCFS") return source;

        const searchable = [stop?.label, stop?.notes]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();
        if (/\bDCFS\b/.test(searchable)) return "DCFS";
        if (/\bGIS\b/.test(searchable)) return "GIS";
        return "";
    }

    function routeStopLine(stop, index) {
        const number = String(index + 1).padStart(2, "0");
        const source = routeSource(stop);
        const address = String(stop?.address || "").trim();
        return [number, source, address].filter(Boolean).join(" — ");
    }

    function normalizeSections(sections) {
        return (Array.isArray(sections) ? sections : [])
            .map((section, index, all) => ({
                number: Number(section?.number) || index + 1,
                total: Number(section?.total) || all.length,
                url: String(section?.url || "").trim(),
            }))
            .filter((section) => section.url);
    }

    function buildRouteBackupDocument({
        createdAt,
        home,
        stops,
        sections,
        garminFilename,
    }) {
        const generated = validDate(createdAt || new Date());
        const homeAddress = String(home?.address || "").trim();
        const routeStops = Array.isArray(stops) ? stops.filter(Boolean) : [];
        const mapSections = normalizeSections(sections);

        if (!homeAddress) {
            throw new Error("The route backup needs a saved Home address.");
        }
        if (routeStops.length === 0) {
            throw new Error("The route backup needs at least one selected stop.");
        }
        if (mapSections.length === 0) {
            throw new Error("The route backup could not create Google Maps links.");
        }

        const routeName = routeNameForDate(generated);
        const documentName = routeBackupDocumentName(generated);
        const stopLines = routeStops.map(routeStopLine);
        const gpxName = String(garminFilename || "").trim();
        const parts = localDateParts(generated);
        const generatedLabel =
            `${parts.year}-${parts.month}-${parts.day} ` +
            `${parts.hour}:${parts.minute}:${parts.second}`;

        const mapItems = mapSections
            .map(
                (section) =>
                    `<li><a href="${escapeHtml(section.url)}">` +
                    `Map ${section.number} of ${section.total}</a></li>`,
            )
            .join("");
        const stopItems = stopLines
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join("");

        const html = [
            "<!doctype html>",
            '<html><head><meta charset="UTF-8"></head><body>',
            `<h1>${escapeHtml(routeName)}</h1>`,
            `<p><strong>Created:</strong> ${escapeHtml(generatedLabel)}</p>`,
            `<p><strong>Home:</strong> ${escapeHtml(homeAddress)}</p>`,
            `<p><strong>Stops:</strong> ${routeStops.length}</p>`,
            gpxName
                ? `<p><strong>Garmin GPX:</strong> ${escapeHtml(gpxName)}</p>`
                : "",
            "<h2>Google Maps</h2>",
            `<ol>${mapItems}</ol>`,
            "<h2>Route Order</h2>",
            `<ol>${stopItems}</ol>`,
            `<p><strong>Finish:</strong> ${escapeHtml(homeAddress)}</p>`,
            "</body></html>",
        ]
            .filter(Boolean)
            .join("\n");

        return Object.freeze({
            documentName,
            emailSubject: `[Free Map Router Backup] ${routeName}`,
            generatedAt: generated.toISOString(),
            garminFilename: gpxName,
            homeAddress,
            html,
            mapSections,
            routeName,
            stopCount: routeStops.length,
            stopLines,
        });
    }

    function buildRouteBackupEmailBody(routeBackup, driveUrl) {
        const backup = routeBackup || {};
        const lines = [
            "Free Map Router route backup",
            "",
            `Route: ${String(backup.routeName || "").trim()}`,
            `Stops: ${Number(backup.stopCount) || 0}`,
        ];

        const gpxName = String(backup.garminFilename || "").trim();
        if (gpxName) lines.push(`Garmin GPX: ${gpxName}`);

        const savedUrl = String(driveUrl || "").trim();
        if (savedUrl) {
            lines.push("", `Drive backup: ${savedUrl}`);
        }

        lines.push("", "Google Maps:");
        for (const section of normalizeSections(backup.mapSections)) {
            lines.push(
                `Map ${section.number} of ${section.total}: ${section.url}`,
            );
        }

        lines.push(
            "",
            "The full numbered stop list is stored in the Drive backup.",
        );
        return lines.join("\n");
    }

    function buildGmailComposeUrl({
        to = COMPANY_BACKUP_EMAIL,
        subject,
        body,
    }) {
        const url = new URL(GMAIL_COMPOSE_URL);
        url.searchParams.set("view", "cm");
        url.searchParams.set("fs", "1");
        url.searchParams.set("to", String(to || "").trim());
        url.searchParams.set("su", String(subject || "").trim());
        url.searchParams.set("body", String(body || ""));
        return url.toString();
    }

    return Object.freeze({
        COMPANY_BACKUP_EMAIL,
        buildGmailComposeUrl,
        buildRouteBackupDocument,
        buildRouteBackupEmailBody,
        escapeHtml,
        routeBackupDocumentName,
        routeNameForDate,
        routeSource,
        routeStopLine,
    });
});
