# Free Map Router Contract

This contract protects behavior the user has approved. It does not require
features that have not been built.

## 1. App purpose

Free Map Router stores addresses for one driver, builds one route, and opens
that route in Google Maps.

## 2. Address rules

1. Address is the only required stop field.
2. Any valid address may be added, regardless of company or source.
3. Company, client, label, and notes are optional display information. They
   never determine duplicates, saved locations, route order, or optimization.
4. One normalized physical address represents one saved stop.

## 3. Saved-data rules

1. Stops and the home address remain saved in the current browser until the
   user deletes or replaces them.
2. Home is stored separately from stops and is never imported or counted as a
   stop.
3. Existing legacy address data remains available as a recovery copy during
   migration.
4. A complete valid coordinate pair may be saved with an address. Partial or
   invalid coordinates are rejected.
5. A later import must not overwrite a manually saved coordinate pair with a
   less reliable location.
6. Free address lookup is started only by the user, caches successful results,
   shows OpenStreetMap attribution, and is limited to one outside request per
   second.
7. A found location is not silently treated as manually verified.
8. Clicking the map or dragging its pin marks the coordinates as manually
   verified and saves them with the address.
9. A manually verified pin must remain protected from later imports and
   automatic lookups.
10. Pin placement provides free **Aerial** and **Roads** views, with Aerial
    shown first so the user can identify the physical property.

## 4. Page and menu rules

1. The app uses a visible **Go to** dropdown menu.
2. The menu contains these five understandable pages:
   **Home**, **Addresses**, **Import Addresses**, **Build Route**, and
   **Settings**.
3. Only the selected page is shown. The app must not return to one long page
   requiring the user to scroll through every feature.
4. Existing pages may not be renamed, removed, combined, or reordered without
   the user's approval.
5. Settings stores the Geoapify key only in the current browser. The key must
   never be committed to GitHub, included in route links, or displayed in full
   after saving.
6. Settings provides a downloadable backup and restore. The backup contains
   Home, saved addresses, pins, and the selected route, but never the Geoapify
   key.
7. Google Drive backup uses the limited `drive.file` permission and may access
   only files created or selected for this app. It must never request access to
   every file in Google Drive.
8. The app creates and owns one Google Drive folder named **Free Map Router**.
   Its cloud backup is saved inside that folder and is not dependent on another
   application's filing rules.
9. After the user connects Google Drive, changes save automatically while that
   short-lived Google connection remains active. If it expires, the app must
   say that reconnection is required and must not claim the change was saved.
10. The app folder contains one workbook handoff file named **Free Map Router
    Address Inbox.json**. It is reserved for Daily Print jobs from
    **InspectorADE Repeat Job Predictor - LIVE**.

## 5. Route rules

1. A saved home address is required to build a round trip.
2. Every round trip starts and finishes at the saved home address.
3. Home is not included in the stop count.
4. Optimization may change stop order, but it must not add, remove, or silently
   replace selected stops.
5. Stops have no appointment windows unless the user approves that feature.
6. Home may use the free lookup and manual pin correction. Its verified
   coordinates remain stored only with the separate home record.
7. Free optimization requires verified coordinates for Home and every selected
   stop, and shortens the complete round trip anchored at Home.
8. Optimization must never return a route longer than its initial free
   nearest-stop order.
9. Address text remains the primary Google Maps destination and the
   user-facing route label. Coordinates stay hidden and are exported only when
   the user manually corrected that pin.
10. With a saved Geoapify key, **Optimize Route** automatically finds and
    remembers missing coordinates for selected addresses before ordering them.
11. Automatic lookup never changes address text and never marks a pin as
    manually corrected.

## 6. Change control

1. A live-tested change confirmed by the user as **Works** becomes protected.
2. Protected behavior may not be removed, weakened, bypassed, or silently
   replaced without the user's approval.
3. Only files and behavior required for the requested change may be modified.
4. New features, fields, pages, services, paid APIs, or workflow changes require
   approval before implementation.
5. A change is incomplete if relevant regression tests fail or if it violates
   this contract.

## 7. Required regression checks

Tests must continue to protect:

- address-only stop creation;
- company-independent address identity;
- safe legacy migration;
- valid coordinate pairs and manual-coordinate priority;
- home stored separately from stops;
- round trips starting and finishing at home; and
- the four-page dropdown menu with only one selected page visible.
