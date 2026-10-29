# Weekly workout progress and recovery

Weeks run Monday–Sunday in the browser's local calendar. No historical workout
rows are reset or deleted. A new week reads a new date range, and the dashboard
automatically moves to the new week while open. Previous/next controls support
review from the programme's first week through the current week.

Completed workout cards are green with name and description struck through.
Past unfinished workout cards are red; individual exercise lists show which
exercises were performed or missed even in a partially finished workout.
Only completed, non-cancelled sessions with valid completed working sets count.
Warm-ups and exercises excluded from a session do not count as performed.
A matching exercise completed elsewhere that week also counts. Freestyle
sessions appear as training dates but do not invent a prescribed day completion.
The first partial programme week is not treated as a full missed week.

Rest days are flexible because existing programmes do not assign weekdays.
The target is seven minus the number of programme workout days (five workouts
means two rest days). Users mark today as rest or undo a current-week mark.
A date with a completed workout takes precedence over a rest mark. Unrecorded
rest days are neutral in history, rather than inferred from missing workouts.

## Optional make-up exercises

The current week's first load snapshots an optional make-up plan. Candidates are
base exercises missed in the previous full calendar week, excluding exercise
identities already performed last week or this week. Candidates are sampled in
turn from source days, deduplicated, and distributed across unstarted unfinished
workouts by fewest extras. An exercise already prescribed in a destination is
not duplicated there.

- At most four additions per session and eight total per week.
- At most two prescribed sets per extra, with at least two target RIR.
- Finished or in-progress destination sessions are untouched.
- No rest day becomes a workout automatically.
- Extras can be removed using the existing session Remove exercise control.
- Extras expire with the week; only base exercises are candidates in a later
  week, so extras cannot recursively accumulate.
- The snapshot stays stable on reload and across devices. Later historical log
  corrections do not silently edit the plan of an in-progress training week.

An old paused session loads its own original week's extras, never new extras.
Extras use normal saved-set history and exercise identity for defaults and PRs,
but do not modify programme_exercises. Merely scheduling an extra adds no stats.

## Storage and security

`gymiq-workout-week` validates the bearer token with getUser, selects only the
owner's programme and reads records through a user-scoped client. Current-week
plan/rest writes additionally require active membership and an active programme.
`workout_week_plans` and `workout_rest_days` have owner-only read RLS; browser
roles cannot write the server-created snapshots. A unique key prevents duplicate
week preparation or duplicate rest-date marks. Own rows are included in the
existing data export and cascade when the account/programme is deleted.
No data is sent to an AI provider for this feature.

`workout_week_activity` is an authenticated SECURITY INVOKER RPC with pinned
search_path. It aggregates date-bounded valid working sets under existing RLS,
without the previous dashboard's truncated most-recent-session rotation.

Verification covers week/year boundaries, weekly reset semantics, partial
completion, make-up caps, deduplication, distribution, blocked destinations,
source completion and empty weeks. Database checks additionally verify RLS,
server-only write grants and cancelled/warm-up filtering.
