# Progression coach: first premium-value stage

The coach is a transparent rules-based feature in the live workout logger.
No API provider receives effort ratings, readiness or recommendations.
Suggested inputs require explicit acceptance and never rewrite performed sets,
PRs or saved manual targets. Existing manual defaults remain the starting values.

## Recommendations

- Use only completed, non-cancelled working-set history from the existing
  exercise progress RPC. Partial exercises, missing feedback, long gaps and
  make-up work receive conservative repeat/review guidance.
- A complete manageable session can suggest one extra rep for each set, capped
  at the exercise's prescribed rep maximum. Different per-set reps are retained.
- A load increase requires two complete sessions at the same load, every
  prescribed set at the top of the rep range, and positive effort feedback for
  both sessions. Use one configured equipment increment, no more than 10%.
  Restart at the lower rep target only after the user accepts.
- Users configure the increment in the same units as their kg log (total barbell
  weight, or per-side/dumbbell weight). Configured barbell plates can supply a
  default increment. Missing/oversized increments never invent a load increase.
- Too-hard feedback can offer one smaller increment within 10%, otherwise asks
  for review. Tired/sore readiness suppresses increases. This is a product rule,
  not a medical recovery assessment or a clinical safety guarantee.
- Unilateral recommendations use the weaker rep count; asymmetric loads and
  assistance machines require manual review. Bodyweight progression stays
  rep-based, with manual variation selection at the top range.
- Accepting affects unlogged exercise inputs only; a started exercise cannot
  have its sets overwritten by the coach. Recovery drafts preserve those inputs
  using the existing session timer cache.

The current ACSM 2026 position stand supports individualisation and gradually
increasing training stimulus when appropriate:
https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/

Earlier ACSM progression guidance discusses small load increases after repeated
successful workloads:
https://pubmed.ncbi.nlm.nih.gov/19204579/

GymIQ's exact feedback thresholds and implementation are conservative product
choices, not a validated diagnostic or individualized clinical algorithm.

## Feedback and privacy

`exercise_coach_feedback` stores Too easy / About right / Too hard per exercise
and workout. RLS requires an owned, non-cancelled log containing an actual valid
working set of that exercise. Feedback on unfinished sessions cannot influence
recommendations based on completed history. `exercise_coach_preferences` stores
available load increments. Both tables use owner policies, are included in the
existing account export and cascade on account deletion.

`workout_logs.coach_readiness` stores Ready/Tired/Sore. The readiness RPC permits
updates only on an owned unfinished, non-cancelled log. Optional fitness feedback
is disclosed in privacy policy v5. Existing Groq reviews are a separate feature.

## Session substitutions

The swap picker offers matching primary muscle and movement patterns with
equipment filters. A replacement uses its own history/defaults: a barbell load
is never carried directly to a dumbbell or bodyweight exercise.

`save_workout_session_plan` snapshots the session plan, canonicalises exercise
names/equipment from the catalogue, verifies programme ownership and blocks
changing an exercise after sets have been logged. The base programme is not
modified. Prescribed replacements retain the original programme slot ID for
weekly completion, but sets retain the actual replacement ID/name for PRs and
history. Thus fulfilled slots do not become false missed-work make-ups.
Freestyle plans are also saved to the server, including later additions.

The weekly summary identifies the replacement instead of claiming the original
exercise was performed. Swaps pause the session and require Resume afterwards.

## Verification

Unit tests cover reps/load progression, two-session thresholds, incomplete and
unrated history, small increments, readiness, unilateral/bodyweight/assistance
cases, stale data, swap matching and original-slot completion. Database checks
cover feedback before/after a valid set, owner isolation, readiness, canonical
session snapshots and started-exercise swap rejection.
