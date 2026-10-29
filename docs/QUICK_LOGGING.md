# Quick logging

New food entries and working sets are written to a user-scoped IndexedDB queue
before the UI acknowledges them. The app retries on reconnection and every 15
seconds while open, with bounded exponential backoff. Eight transient failures
require an explicit retry. Browser storage failure is visible and never reported
as a successful save. Up to 200 pending entries per account are supported.

Scope: connection drops in an already loaded food diary or workout session.
The queue survives closing/reloading the browser and syncs on the next connected
sign-in. This release does not promise a fresh offline app launch, background
sync after the browser closes, or offline creation of a new session/programme.
Corrections, removals, favourites and session finish require a connection. A
workout cannot finish or discard exercises while it has queued sets.

`sync_log_entry` serializes each mutation and stores immutable owner-scoped
receipts. Identical retries do not duplicate records; changed payloads conflict.
Receipts survive removal of the resulting entry so a delayed retry cannot
resurrect deleted food. Set writes lock the workout and reject finished,
cancelled, replaced or excluded exercises and occupied set positions. No queued
entry overwrites an existing server entry. Conflict and permission failures stay
visible for review. Removing a queued copy explicitly does not delete anything
already saved online. Cross-tab acknowledgements use BroadcastChannel where
available; server receipts protect against duplicates across all tabs/devices.

Only synced records enter cloud totals, history, PRs and weekly reviews. Pending
food is shown separately and blocks marking that day complete. Pending sets are
visible in the current session and must sync before session completion. Sign-out
retains pending entries for the same account; another account cannot see them in
the app. The current device queue is included in account export and is cleared
after successful account deletion when device storage is available. Clearing
browser storage yourself can lose unsynced entries.

Quick meals: cloud favourites support ingredient meals and manual label-calorie
foods. Recent meals show up to eight distinct choices from the last 30 synced
entries. “Log again” explicitly adds the same portions on the selected date;
“Adjust portions” opens the existing builder without logging. Saved templates,
individual meal shuffles and session exercise swaps remain available.

Barcode lookup uses Open Food Facts API v3.6 through an authenticated function,
sending only the barcode and a GymIQ User-Agent. The current `nutrition` aggregate
schema and older `nutriments` values are parsed separately. Only declared
as-sold, per-100 values are accepted from the current schema; serving/prepared
values are never mistaken for per-100 values. Missing/implausible values fall
back to manual label entry. Portions are calculated in code and require a label
confirmation. Product data is separated from the curated planner catalogue,
cached for 14 days, and attributed under ODbL. Fresh lookup limits are 12/minute
app-wide and four/minute/account, below the documented 15/minute/IP provider
limit. Camera detection is on-device when BarcodeDetector supports it, with
manual digits available on all supported browsers. Physical camera performance
still depends on the user's phone/browser.

Sources: [Open Food Facts API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/),
[v3 product schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/),
[BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector).

Verification: queue unit tests cover offline retention, lost responses, stable
IDs, backoff, conflicts, account isolation and removed records. SQL authenticated
role tests verify replay, changed payloads, tombstones, cancelled workouts and
owner visibility. Browser checks cover favourite/recent logging, label-confirmed
barcode portions, a pending entry surviving reload, explicit retry after restored
access, and synced workout sets. No new package or paid API key is required.
