# Meal builder and monthly goals

Calorie Bank now uses daily food intake and dated calorie guides, not a rolling
ledger balance as permission to eat. Historical food transactions remain visible
in their calendar periods. Old deposits/activity credits remain stored but do not
inflate the new food guide. Workouts remain the flagship tab.

## Data and calculations

- `nutrition_goals`: current settings and server-calculated result.
- `nutrition_goal_versions`: effective-day snapshots; earlier days do not change
  when a new goal is saved. Multiple changes today replace today's guide.
- `nutrition_meal_plans`: saved daily plan, calculated portions and explicit source.
- `saved_meals`: reusable owner-only ingredient templates, separate from intake.
- `calorie_transactions`: one negative food row per logged meal or extra. UUID
  upserts prevent duplicate retry writes. Corrections update that row; removing
  it removes its calories. Templates and planned meals never add intake.
- `nutrition_day_status`: explicit complete/partial logging acknowledgement.

Mifflin-St Jeor resting-energy estimate plus non-gym activity and a net gym
estimate, averaged per day. General strength training uses 3.5 MET minus 1 MET
resting energy. Planned schedule or valid finished sessions from the last 28
days can be used. Recorded activity requires 3 sessions and 14 days of history;
cancelled sessions, sessions without completed working sets and durations above
3 hours are excluded. The model is approximate, particularly because session
duration includes rests. It refreshes when the user saves goals.

The 30-day model uses 7,700 kcal/kg; the deficit is capped at 500 kcal/day,
25% of maintenance and a floor of max(estimated BMR, 1,500 kcal/day). Requests
0–4 kg are accepted, but the displayed modelled pace may be lower. Adult-only
general planning; no clinical diet, allergy safety or weight-loss guarantees.
Extra food never lowers tomorrow's target or creates compensation advice.

## Food provenance

The catalogue includes eight default mixed-meal options each for breakfast,
lunch, snack and dinner (32 total), plus four existing vegetarian/vegan opt-in
recipes. Recipes use 3–5 familiar ingredients from the same verified food data.
Default lunch and dinner require meat/fish; explicit diet preferences and
ingredient exclusions filter all generated and shuffled choices.

Each card has a shuffle control, and a central button replaces all four meals.
Shuffle always excludes the current recipe from eligible alternatives, scales
replacement portions to the saved daily guide, and preserves other cards exactly
for a single-card change. It runs within GymIQ without a Groq request or quota
reservation. It changes the saved plan only, never food diary rows or templates.
Plans with outdated goals must be rebuilt first. A conditional timestamp update
prevents simultaneous device requests from silently overwriting each other.
With restrictive preferences, a slot may have no alternative; the API returns a
clear explanation and leaves the plan unchanged.

`supabase/functions/_shared/nutrition/foods.json` contains 21 curated USDA SR
Legacy generic foods, with FDC IDs, descriptions and source URLs. Nutrients are
per 100 g edible portion. Raw/dry/cooked/drained states are explicit. The
extractor is `scripts/extract_nutrition_foods.py`; source CSVs are ignored.

Source download:
https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip

Extract food.csv and food_nutrient.csv into artifacts/nutrition-source, then run
the extractor from the repository root. To expand the catalogue, update the
curation list, verify preparation state and allergen tags, and seed a new
migration. FoodData Central SR Legacy is a generic historical dataset; package
labels are preferable for the actual product eaten.

General meal pattern reference:
https://www.canada.ca/en/health-canada/services/food-guide/eating-support/cooking/make-healthy-meals-plate.html

Activity reference: https://pacompendium.com/conditioning-exercise/

## Groq boundary

Function `gymiq-meal-plan` verifies the bearer token with getUser and checks
membership. Goal calculations and preference filtering stay inside GymIQ.
Only the public recipe catalogue is sent to Groq for meal selection: no user
measurements, targets, intake, identifiers or exclusions. Strict JSON recipe IDs
are validated and locally filtered; incompatible choices use matching presets.
Code calculates portions and all nutrients. The opt-in AI path shares existing
nutrition review quotas and returns a labelled basic plan on provider failures.
Cached selections avoid repeated provider requests. No arbitrary prompts/tools.

RLS isolates owned records; calorie guides and plans are server-written only.
New owner tables are included by the existing data-export discovery and cascade
on account deletion. Server-only goal write RPC has no browser execute grant.

## Verification

`npm test --workspace web` covers net activity, requested/capped deficits,
maintenance, unsuitable inputs, ingredient validation, portion scaling, diet
filtering and missing/incomplete period data. Database checks verify canonical
food calories, idempotent retries, corrections and authenticated owner policies.
