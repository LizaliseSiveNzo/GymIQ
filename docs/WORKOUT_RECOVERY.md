# Return to an unfinished workout after relaunch

The installed app still starts at `/workout`, but a signed-in, onboarded account is offered **Return to your workout?** when an unfinished session is available. Training, Calorie Bank and Account can show this prompt; it never interrupts a session that is already open.

- Save an account-scoped recovery pointer as soon as a session log opens. The pointer holds only the original log/day ID, name and start date, in the existing device-view cache. Timer state, typed drafts and exercise position remain in the existing timer recovery storage; completed/pending sets retain their existing cloud/device saves.
- Validate a saved pointer against the owner's unfinished cloud log in the background. If there is no pointer, find the most recent owned unfinished log, including sessions started before this feature existed or on another device. Finished/cancelled logs are excluded.
- **Return to workout** routes to `/workout/session/<day-or-free>?resume=<original-log-id>`. The session player reads that exact owned log and validates it is still unfinished and belongs to that day. It does not call `open_workout` on this path, so a stale, completed or invalid resume link cannot silently create a new session.
- Explicit recovery opens paused, even for a very recently created log. Restore saved active/rest time, draft rows, extra rows and exercise position. Time while the process was closed is not counted.
- **Not now** dismisses the prompt for the current app runtime without cancelling, finishing or deleting the session. A fresh app launch can offer it again. The existing Continue workout link uses an exact resume ID too.
- Finish/cancel removes only that log's local recovery pointer after the server confirms success. Sign-out already clears the account's view cache. Reconnecting is required to reopen the cloud-backed session; an offline pointer stays saved and the prompt explains this.

No database schema or permissions change. Existing RLS, membership gates and owned-log checks remain in force. Recovery never copies a finished workout into a new log or changes PRs.

## Verification

- Recovery tests cover exact IDs, freestyle, older dates, foreign/closed/malformed logs, matching-only cleanup, safe internal routes and paused timing/draft snapshots.
- Exact resume-loader tests verify no new-workout RPC is called and stale links fail instead of falling back to creation.
- Isolated production browser fixture: start at Training with a previous-day unfinished log, accept the prompt, verify the same log URL, completed set 20 kg × 10, draft 22.5 kg × 11, second exercise selected, active time 1:37 and rest paused at 0:35. Dismiss/reload offers recovery again. All records in this browser check are synthetic; no real account is modified.
