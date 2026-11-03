# Training and nutrition context for the personal coach

Each explicitly sent coach message now refreshes a bounded, account-scoped history summary alongside the existing pantry, equipment, programme, diet/allergen preferences and calorie guide. These reads do not run on app startup or on opening the coach page.

## Added information

- Up to 500 recent completed working sets, summarized across the most recent 28 days: latest two sessions per exercise with actual paired weight/reps, left/right values and RIR; loaded working-set counts by primary muscle; recent sessions, valid duration, recorded readiness, rest dates, matched effort ratings and saved future targets.
- Dated food-log totals and completion status across the last 28 days, including across month boundaries. Guide values come from the dated goal version. Calories are averaged only across days marked complete. Missing/incomplete days remain explicitly unknown.
- Up to 40 recent food entries across seven days: meal names, slots, portions and known catalogue-derived protein/carbohydrate/fat amounts. Calorie-only or partly unknown ingredient entries have unknown macros, not invented zeros.
- Today's meal plan and up to eight saved meal templates, clearly separated from actual eaten food.
- Recent weight check-ins, separate-week averages and an observed change only when each week has at least two distinct dates. Requested monthly loss/goal weight and the existing modelled calorie-guide estimate remain separate.

## Scope and accuracy

All personal queries use the authenticated Supabase client and explicit user_id/client_id filters. No RLS policies, grants, table schemas, coach-account allowlist or write tools were broadened. The existing validated draft/Apply flow remains. The provider receives whitelisted fields; account identity, date of birth, body-fat/circumference measurements and private notes are omitted. Food/exercise names and messages can themselves contain personal details, as explained in Privacy.

The model is told about sampling limits, unavailable sections, unsynced records, incomplete diaries, planned-vs-performed distinctions and avoiding double-counted gym calories or compensatory restriction. Cancelled/unfinished workouts, warmups, removed exercises and their unmatched effort ratings do not become achieved performance. Summaries are calculated in code; they do not assert all-time PRs or guaranteed fat-loss results. Unknown custom-exercise muscles are labelled Unmapped.

Optional history-query failures are marked in unavailable_sections instead of making the model silently assume there were no records. Essential pantry/goal/programme validation still fails closed if required context cannot load. Added a Review my training & food logs chat starter.

## Verification

232 tests pass, including ten new tests for paired progression, exclusions/duplicate sets, effort matching, dated guides/incomplete food days, known-vs-unknown macros, planned meals/targets, goal estimates, local dates, sparse/deduplicated weight samples, bounded data and privacy/owner filtering. Production build passes. Live schema/RLS checks confirmed all personal read tables use RLS, nutrition_period is SECURITY INVOKER, and a disposable authenticated QA session saw zero other-account workouts, food entries or weights; the SQL read test rolled back. No real customer records were sent to DeepSeek during verification. Live synthesis/voice activation was not part of this change.
