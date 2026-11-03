# Finished workout screen reliability

The old global error boundary called every render/module error a connection problem. Finishing navigated to a separate lazy HistoryDetail module, which was not precached. An older open app could request a chunk removed by a deployment even with Wi-Fi: the public domain returns the SPA HTML for that old asset URL, which cannot load as JavaScript. A cache-storage write failure could also reject an otherwise successful asset download.

- HistoryDetail now travels with the app shell, so finishing needs no additional route download. SessionPlayer and HistoryList and their static dependencies are precached after initial load. AI, onboarding and analytics remain deferred.
- Public cache reads/writes fail open to the network; successful downloads remain usable when storage is full. HTML fallbacks are not cached as JavaScript or CSS.
- Only recognized module/CSS download errors trigger one automatic recovery per location per five minutes while online. Runtime errors have a separate message. Offline messages are shown only when the browser reports offline and the error is a download failure.
- Recovery checks for a waiting public-code update, explicitly activates it, then reloads the same URL. Requests are bounded and cannot activate a late update after the timeout. Normal updates still wait, preserving active workouts.
- No private cache, auth state, IndexedDB queue or workout record is cleared or rewritten.

Verification: 210 tests pass; production build passes. Synthetic production-build session was resumed, finished via Save & finish workout, and displayed its saved detail page with 1 set, 200 kg volume and 1:37 active time. Public old detail asset URL returned HTML rather than JavaScript, confirming the stale-chunk failure path. Built manifest includes SessionPlayer/HistoryList; HistoryDetail is in the entry graph; AI and analytics remain excluded from precache.
