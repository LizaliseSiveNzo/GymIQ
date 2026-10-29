# Monthly progress story

`/workout/progress-story` is linked from Workouts and Training analytics. It is
available as a read-only history view after membership expiry. Previous months
are browsable; the current month is always labelled in progress, including its
last day. It uses local calendar dates and never extrapolates a month-end result.

Finished, non-cancelled sessions with valid working sets build the calendar,
session/set totals and training-week counts. Rest days do not break a daily
streak because no daily streak is imposed. Empty days are labelled as no finished
session recorded, not missed prescribed workouts. Historical programme schedules
are not inferred from the user's current programme.

Lift stories compare the first and latest finished exercise session within the
month. Added-load comparisons require matching rep counts. If multiple counts
match, the highest shared rep count is used and the highest load at that count
in each session is shown. Bodyweight-only work compares best reps at zero added
load. Paired sets consistently use the lower side. Assistance-machine loads and
unmatched rep ranges are displayed without calling higher numbers an improvement.
Within-month gains are explicitly distinct from all-time PRs.

The scale chart shows actual dated measurements, with a labelled zoomed vertical
axis and a text list. Lines are visual guides, not imputed measurements. A weight
change summary needs at least two weigh-ins in both the first and last recorded
calendar weeks in that month. It describes scale weight, not fat or muscle change.
Food coverage counts explicit complete-day acknowledgements only; gaps never
become a calorie deficit. The story does not change targets or calorie guides.

All reads use existing authenticated owner RLS/RPCs. No new schema, provider calls,
credentials, images or plotting dependency are needed. Corrections update the live
story when refreshed; pending device records remain excluded until synced and,
for training, the workout has finished.

Unit coverage includes month boundaries, incomplete months, excluded/duplicate
records, non-daily consistency, matching reps, assisted/bodyweight/paired work,
sparse weigh-ins, first-ever versus monthly milestones and missing food logs.
