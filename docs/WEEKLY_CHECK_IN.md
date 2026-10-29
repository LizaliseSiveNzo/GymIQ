# Weekly check-in

Available at `/workout/check-in`, linked from Workouts and Calorie Bank. Opens the
last completed Monday–Sunday week; older weeks can be selected. All calendar dates
use the user's browser timezone, matching existing workout and food RPCs.

The review combines completed working-set sessions, current reference-programme
completion, same-exercise load/rep comparisons, weekly scale-weight averages and
food-log coverage. Programme schedules are not historical snapshots: the page
labels its current reference programme and omits a schedule denominator if that
programme started after the reviewed week began.

Food averages include only days explicitly marked complete. Intake-versus-guide
comparisons use only complete days with a dated goal version. Missing and partial
days never become zero intake, a whole-week deficit or a calorie debt. Plans are
not food eaten. Weight-average changes require two weigh-ins in each week and do
not claim measured fat loss. Weight/rep changes describe recorded work, not a
clinical strength assessment.

Next-session proposals are shown only on the latest completed week's review and
use the latest actual history, including newer sessions, with the existing
progression coach's effort, full-set, stale-history and increment safeguards.
Up to six distinct exercises are offered. Varying per-set rep suggestions stay in
the session coach because persistent targets hold one rep value. Review opens an
editable dialog; saving explicitly creates/replaces an exercise target, which
prefills future unlogged sets until cleared in Exercise stats. It never creates
a performed set or changes a PR. Calorie-goal changes use the existing explicit
Calorie Bank goal form and server validation; this review does not autonomously
cut calories based on a single week.

This is a live, deterministic review, not a frozen or submitted report. Refresh
after correcting records. Existing authenticated owner RLS/RPCs protect all data;
no database schema or grants change. No additional provider calls, health-data
exports, AI budgets or credentials are needed.

Verification: unit tests cover incomplete food logging, dated targets, sparse
weights, excluded records, paired sides, schedule baselines and actionable coach
proposals. Browser verification covers review, cancel/save target approval,
reload persistence, goal-form navigation and a mobile layout.
