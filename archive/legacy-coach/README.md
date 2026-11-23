# Legacy coach/trainer feature — archived

Archived 2026-11-23 to remove unreachable code and dormant schema from the live app.

## What's here
- `web/` — the removed **coach/trainer + intermediate** pages and components (31 files), moved verbatim from `web/src/`. These were no longer reachable via any route after GymIQ pivoted to an individual fitness product.
- `migrations/` — the **legacy SQL migrations (0001–0081)** that defined the dropped schema, copied from `supabase/migrations/` (the originals are still there and in git history).

## Dropped database tables
These tables were dropped from production because no current code referenced them:

`appointments`, `block_exercises`, `workout_blocks`, `day_plans`, `day_plan_blocks`, `client_journal`, `journal_entries`, `trainer_clients`, `trainer_announcements`, `meal_plan_items`, `nutrition_plans`, `food_logs`, `form_checks`

(previously dropped: `personal_records`, `entitlements`, `nutrition_settings`, `habits`)

## How to recreate
The DDL is in `migrations/` (copies) and in `supabase/migrations/` (originals). Re-run the relevant migration(s) against a database to recreate any table or function.
