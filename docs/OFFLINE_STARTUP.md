# Faster startup and installed-app offline opening

## Cause and change

The coach route was already lazy and never invoked DeepSeek during Training startup. Startup instead waited for session/profile hydration, followed by a membership request on every route transition. There was a manifest but no service worker; installing to a home screen did not make fresh offline launches work.

- Lazy landing/sign-in pages, onboarding styles, optional nutrition AI reviews and deferred analytics.
- Stable React and Supabase vendor chunks can be reused across app releases. The initial app entry is around 22 kB uncompressed, **in addition to** the shared vendors (about 383 kB uncompressed); this is a caching/code-splitting improvement, not a 95% reduction in the whole download.
- Bootstrap the existing stored session and an account-scoped minimal profile without waiting for token refresh. Refetch the profile on user changes/reconnection, rather than every token/session update. Device snapshots are display data only, not server authorisation.
- Reuse a recent membership snapshot; deduplicate concurrent checks and refresh in the background. Profile/membership and read requests have finite timeouts where applicable. Server authentication, membership enforcement and RLS on writes remain unchanged.
- Show saved Training and viewed nutrition records immediately, then refresh. Cached training is read-only; starting/reopening sessions requires a connection. Food entry still uses the existing durable offline queue.

## App shell cache

`web/build/offlinePlugin.js` generates `/sw.js` from the actual hashed output files. Precache the shell and static dependencies for Training, Calorie Bank, workout previews, Account, Privacy and sign-in. Do not precache the coach, AI review, onboarding, full session player, analytics or the exercise image library. Shared code needed by a core screen is included.

Register after page load/idle. Navigation uses the cached generic HTML; hashed code/styles and viewed public exercise pictures use cache-first loading with a bounded runtime cache. Supabase, AI, auth, checkout, other origins, writes and private API paths are never intercepted. Query-string navigation such as `/bank?section=builder` still works offline. Vercel must serve `/sw.js` as JavaScript with no-cache headers.

Do not force `skipWaiting` or reload an active workout. A newly installed update activates when existing app tabs/windows close. Old version caches are removed on activation.

## Device snapshots and limits

`deviceCache.js` stores snapshots by account ID, never credentials. It follows Keep me signed in: localStorage if enabled, sessionStorage otherwise. The Supabase session remains in its existing SDK store; no second token copy is created. Profile snapshots omit measurements, birth date and tokens. Other cached screens contain the user's own previously viewed training/food records. Display snapshots expire after 30 days; membership snapshots after seven days. Sign-out clears account snapshots and local credentials immediately. Responses that arrive after sign-out must not recreate account caches. Pending logs are separate and retained for that same account.

Visit Training and Calorie Bank online once to prepare their saved data. A first-ever offline visit cannot download the app or unseen account records. Cached weeks do not invent a new week's results; the last saved week can be opened explicitly. AI, payments, new/reopened workout sessions and unvisited optional pages need internet. An already-open workout retains its existing connection-drop logging behaviour.

## Verification

- `npm test --workspace web`: snapshot expiry/ownership, session-only storage, sign-out isolation, immutable cached write flags, blocked storage, offline navigation/assets and exclusion of private requests.
- `npm run build:web`: generated precache paths all exist; AI/onboarding are excluded; vendors are separate.
- An isolated production-build fixture uses synthetic local records and blocks remote requests. Warm the service worker, stop its local HTTP server, reload Training and `/bank?section=builder`, and log food into the local pending queue. No real account or API key is used in this browser test.
- Browser evidence: saved screens render after a fresh server-off reload; queued food is shown as pending rather than incorporated into confirmed totals.
