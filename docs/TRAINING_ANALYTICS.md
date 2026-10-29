# Visual training analytics

Route: `/workout/analytics`. A chart-icon button on the Workouts page opens a
separate read-only dashboard. Existing Exercise stats remains the place to edit
sets or manual targets. Like existing records/history, own analytics remains
readable after membership expiry.

## Source and counting

Reuse the paginated `exercise_progress_sets` RPC and existing exercise-history
loader. It enforces owner access and includes only valid completed working sets
from finished, non-cancelled sessions. Warm-ups and excluded exercises are
filtered. Analytics defensively deduplicates set IDs and excludes invalid or
future rows. Planned targets, accepted suggestions and scheduled make-ups have
no effect until actual sets are logged and the workout is finished.

One logged row counts as one working set, including paired-side entries. Primary
sets use the actual performed exercise ID's primary muscle tag. Supporting
involvement is a separate optional count for each positive secondary-muscle tag;
it is not multiplied by the catalogue fraction or added to unique primary sets.
A single compound set can appear as supporting involvement for multiple muscles.

Legacy rows without an ID can match one unambiguous catalogue name. Unmatched
rows remain in total sets with an explicit missing-tag count. They are not
silently dropped or assigned an invented muscle group. Actual replacement
exercise IDs determine body parts and exercise trend groups, regardless of the
original programme slot.

## Graphs

- Primary sets by body part, optional supporting bars and optional zero-set rows.
- Per-exercise line chart for top working-set load per completed session.
- Rep view tracks the best working-set reps, showing the accompanying load.
- First/latest/change metrics refer to the selected time range, not mixed lifts.
- Paired entries use the lower performed-side load and rep count for a single
  comparable point; individual side details remain in exercise records.
- Bodyweight work remains in set totals, with a rep view for useful progression.
- Time filters: current week/month, rolling 4/12 weeks, all completed history.

The responsive SVG uses actual session dates on the horizontal axis and a
zero-based vertical axis. Session inspection is available by tapping points or
using a native selector. A data table exposes every chart point for accessible
reading. Empty and single-session states avoid invented trend percentages.
No additional chart dependency, API provider or database schema is introduced.

## Verification

Unit tests cover primary/supporting counts, duplicate filtering, invalid and
excluded records, time windows, session grouping, load/rep association, paired
sets, bodyweight rows, substitutions, ambiguous tags and zero-based scales.
Browser QA checks the main-page link, filters, session inspection and mobile fit.
