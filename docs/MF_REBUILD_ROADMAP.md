# GymIQ — MacroFactor-Workouts Rebuild: Master Roadmap

**Objective:** restructure GymIQ from a trainer↔client coaching app into a self-coached,
MF-Workouts-style training product: generated structured programs, rule-based auto-progression
with RIR, a live session player, per-muscle volume analytics on a body map, a customizable
widget dashboard, and an adaptive (closed-loop) nutrition layer.

**Locked decisions (owner-approved):**
1. **Platform:** web-first PWA (React/Vite + Supabase stay; no native rewrite).
2. **Nutrition depth:** adaptive targets + food logging (no barcode/photo-AI in v1).
3. **Monetization:** paywall/trial *structure* built, billing wired later.

**Ground rules:**
- We replicate **functionality and interaction patterns**, never MacroFactor's assets,
  artwork, marketing copy, or proprietary algorithm constants. Our progression/expenditure
  maths are our own implementations of published sports-science principles.
- Every engine is **rule-based and auditable**: all tunable constants live in one config file
  per engine, commented with the rationale. No black boxes.
- Existing users/data survive: additive migrations only, legacy routes kept behind a flag
  until parity.

---

## 0. Target product definition

### 0.1 Information architecture (end state)

```
Bottom tab bar (persistent):   [ Today ]  [ Workout ]  ( + )  [ Levels ]  [ More ]
```

| Slot | Purpose |
|---|---|
| **Today** | Customizable widget dashboard (rings, habit grids, metrics, muscle & exercise cards) |
| **Workout** | Week strip + active program card + workout list → session launcher |
| **( + ) FAB** | Global Shortcuts sheet: Log weight · Progress photo · Body metrics · History · Up Next card · Empty workout · New program |
| **Levels** | Set Levels: anatomical body map + weekly sets/muscle, window selector |
| **More** | Profile/account, subscription stub, integrations, units, theme, feature settings (Dashboard/Workout/Shortcuts/Weight trend/Exercises/Gym profiles), data export/deletion, legal, about |

Full-screen flows outside tabs: `/onboarding/*` wizard, live session player, exercise picker,
program editor/generator interview, weigh-in, progress photos, history/detail views.

### 0.2 Route map (new)

```
/onboarding                 checklist hub (Basics ✓ → Gym & Equipment → Program)
/onboarding/basics/:step    health-link consent, sex, dob, height, weight, bf%, experience, cardio
/onboarding/gym/:step       where you train, gym nickname, equipment selection (+denominations)
/onboarding/program/:step   goal, focus, deprioritize, days, time, split, deload, name, color/icon
/onboarding/preview         GENERATED program preview ("the aha") → paywall structure → account
/today                      dashboard (widgets, customize mode)
/workout                    week strip + program + workouts A–D
/workout/session/:logId     LIVE SESSION PLAYER
/workout/history/:id        past session detail
/levels                     Set Levels body map
/more                       settings hub (+ subpages)
/exercises                  browse/search catalog (also modal picker everywhere)
/nutrition                  food log + adaptive targets (absorbs Calorie Bank UI)
/journal                    existing journal, restyled into More/Today widgets
```

Legacy `/customer/*`, `/coach/*`, `/schedule`, `/announcements` remain mounted behind
`VITE_LEGACY_UI=1` until Phase 7 cutover, then archived (code kept, routes removed).

---

## 1. Current-state audit → disposition

| Existing asset | Disposition in rebuild |
|---|---|
| `AppShell.jsx` sidebar/tabbar/FAB | **Transform** → new `TabShell` (5 slots, center FAB); shortcuts sheet rebuilt to MF spec |
| `ClientLog.jsx` (form-based logger) | **Replace** → `SessionPlayer` (timers, set table, Auto targets, RIR) |
| `ProgrammeBuilder.jsx`, `CoachPlayerDetail.jsx` builder | **Transform** → manual `ProgramEditor`; generator writes the same tables |
| `BlockLibrary.jsx`, `WorkoutCalendar.jsx`, day_plans tables | **Archive after cutover** (superseded by programs+week strip); keep tables inert |
| `exercise_presets` (88 moves, flat metadata) | **Extend massively** (see §3 M2) — foundation of everything |
| `CalorieBank.jsx` + `calorieBank.js` | **Upgrade engine** → adaptive expenditure; bank metaphor retained as the UI |
| `food_logs` (one row/day of totals) | **Replace** with per-item `food_entries`; old table kept read-only for backfill |
| `body_metrics` (weight rows) | **Keep + extend** (visual BF%, measurements jsonb, source=health/manual) |
| `client_journal`, `journal_entries`, `form_checks` | **Keep**, restyled; FormCheck becomes our "video" differentiator |
| `trainer_clients`, appointments, trainer_announcements, notifications | **Inert/archive**; notifications repurposed for PRs/deload/streak events |
| `Assistant.jsx` AI coach | **Keep** — recontextualized as Q&A over your own data (our differentiator) |
| Auth (`Login.jsx`, magic links?, users table) | **Keep**; extend profile fields; add onboarding-state machine |
| PWA bits (manifest/SW/icons) | **New** |

---

## 2. Data model plan — migration sequence

All user-owned tables get `using (user_id = auth.uid())` / `(client_id = auth.uid())` RLS.
Naming: new tables prefer `user_id uuid references users(id)`.

**M1 `0080_profile_v2.sql`**
- `alter table users add column sex text check in ('male','female')`,
  `dob date`, `height_cm numeric`, `body_fat_pct numeric`,
  `training_experience text ('novice'|'intermediate'|'advanced')`,
  `cardio_experience text`, `acquisition_source text`,
  `units text ('metric','imperial') default 'metric'`,
  `theme text ('system','light','dark') default 'dark'`,
  `health_link_consent bool default false`,
  `onboarding_state jsonb default '{"phase":"basics","step":0}'`,
  `onboarded_at timestamptz`.
- `nutrition_settings` (1 row/user): `goal_type ('cut','maintain','gain')`,
  `weekly_rate_kg numeric`, `calorie_mode ('adaptive','manual')`, `manual_target int`,
  `floor_kcal int default max(1200, …)`, `protein_g_per_kg numeric`, `fat_pct int`.

**M2 `0081_muscles_equipment_exercises.sql`** *(the foundation migration)*
- `muscles` (global): `id slug`, `name`, `region ('upper','lower','core')`, `svg_path text`,
  `front_back enum`, `sort`. Seed ~17 muscles (chest, upper back, lats, traps, front/side/rear
  delts, biceps, triceps, forearms, abs, obliques, quads, hamstrings, glutes, calves, neck…).
- `equipment_items` (global): `name`, `category ('barbell','dumbbell','machine','cable',
  'kettlebell','bodyweight','other')`, `default_denominations_kg numeric[]`.
  Seed ~40 curated items (not 276 — see §7).
- `gym_profiles`: `user_id`, `name`, `icon`, `is_default`; `gym_profile_equipment`:
  `profile_id`, `equipment_id`, `selected bool`, `denominations_kg numeric[]` (editable).
- `exercises` (replaces `exercise_presets`; presets migrated in):
  `name unique`, `primary_muscle_id`, `secondary_muscle_fraction jsonb`
  (`{"triceps":0.5,"front_delts":0.45}`), `movement_pattern ('horizontal_push',
  'vertical_push','horizontal_pull','vertical_pull','squat','hinge','lunge','carry','core',…)`,
  `laterality ('bilateral','unilateral_alt','unilateral_single')`,
  `stability_demand int 1–5`, `rom_category text`, `equipment_ids uuid[]`,
  `is_weighted bool` (vs bodyweight), `cue_text`, `setup_notes`, `media_ref null`
  (reserved), `is_custom bool`, `owner_user_id null` (custom exercises per user),
  `difficulty int 1–3`. Seed: migrate 88 presets + author ~120 more high-value lifts
  programmatically (template-assisted, owner-reviewed). Target ≥200 at GA, schema supports 1k+.

**M3 `0082_programmes_v2.sql`**
- Extend `workout_programmes`: `goal ('hypertrophy','strength','both')`,
  `split ('full_body','upper_lower','ppl','arnold','custom')`, `days_per_week int`,
  `session_minutes int`, `focus_muscle_ids uuid[]`, `deprioritized_muscle_ids uuid[]`,
  `deload_policy ('auto','every_4w','every_6w','never')`, `color text`, `icon text`,
  `current_week int default 1`, `generated bool default false`,
  `source ('generator','manual','import')`.
- New `programme_weeks`: `programme_id`, `week_number`, `kind ('accumulate','deload')`,
  `volume_multiplier numeric default 1.0`, `notes`.
- Extend `programme_days`: `label ('A'..'F')`, `week_number null` (null = every week),
  `focus_summary text`.
- New `programme_prescriptions` (per programme_exercises row, or columns added):
  `target_sets int`, `rep_min int`, `rep_max int`, `target_rir int`,
  `rest_seconds int`, `set_types jsonb` (e.g. drop-set markers), `start_weight_kg numeric null`.

**M4 `0083_logging_v2.sql`**
- Extend `workout_logs`: `gym_profile_id uuid null`, `duration_sec int`,
  `week_number int`, `completed_at timestamptz`.
- Extend `logged_sets`:
  `set_type ('normal','warmup','drop','myorep','partial','failure','superset') default 'normal'`,
  `rir int null`, `weight_left numeric null`, `reps_left int null`
  (right = existing weight/reps columns; left filled only when unilateral),
  `target_weight numeric null`, `target_rep_min int null`, `target_rep_max int null`,
  `target_rir int null`, `completed bool default false`, `superset_group uuid null`,
  `plate_hint jsonb null`.
- New `personal_records`: `user_id`, `exercise_id`, `pr_type ('e1rm','top_set_volume',
  'rep_record:{n}')`, `value numeric`, `achieved_on date`.

**M4b `0083a_habits_photos_metrics.sql`**
- `habits`: `user_id`, `day date`, `weighed_in bool`, `worked_out bool`,
  `logged_food bool`, PK (user_id, day).
- `progress_photos`: `user_id`, `storage_path`, `taken_at timestamptz`, `pose text null`.
- Extend `body_metrics`: `visual_bf_pct numeric null`, `measurements jsonb null`
  (waist/hips/…), `source ('manual','health_import')`.

**M5 `0084_food_entries_adaptive.sql`**
- `food_entries`: `user_id`, `entry_date date`, `meal ('breakfast','lunch','dinner','snack')`,
  `name`, `kcal int`, `protein_g`, `carbs_g`, `fat_g numeric`, `quantity text null`,
  `source ('manual','quick_add','copy')`, `created_at`. (Per-item replaces daily-total `food_logs`.)
- `quick_foods`: user-saved reusable items.
- `expenditure_estimates`: `user_id`, `week_start date`, `estimate_kcal int`,
  `method ('formula','blended','adaptive')`, `intake_avg int`, `ewma_start numeric`,
  `ewma_end numeric`, `confidence numeric`, computed by engine weekly.
- RPCs: `recompute_expenditure(uid)` (SECURITY DEFINER, idempotent, weekly),
  `ensure_month_deposit` updated to read latest estimate when `calorie_mode='adaptive'`.

**M6 `0085_dashboard_prefs_entitlements.sql`**
- `dashboard_layout`: `user_id`, `widget_key text`, `position int`, `visible bool`.
  Default order mirrors MF §6.1.
- `shortcuts_config`: `user_id`, `shortcut_key`, `visible bool`.
- `entitlements` (structure only, no billing): `user_id`,
  `plan ('trial','premium_monthly','premium_yearly','free')`, `trial_started_at`,
  `trial_ends_at`, `status ('active','expired','none')`, `store 'future_stripe'`.

**Backfills:** preset→exercise migration script; habits seeded from existing
`body_metrics` dates and `workout_logs` dates; PR bootstrap scan over historical logged_sets.

---

## 3. Engine specifications

All engines are pure TypeScript modules under `web/src/lib/engines/` with their constants
in sibling `*.rules.ts` files. Unit tests (Vitest) cover each rule branch.

### 3.1 Program generator (`engines/generator.ts`)

Inputs: goal, days/week (2–6), session_minutes (30/45/60/75/90), split choice (or auto),
experience, focus muscles, deprioritized muscles, gym equipment set, sex/bodyweight (load
defaults).

Process:
1. **Split resolution:** if auto → map days→split {2:FB, 3:FB or UL, 4:UL, 5:PPL+UL/Arnold-lite,
   6:PPL×2}. Respect explicit override.
2. **Weekly volume budget per muscle** from `volumeLandmarks.rules.ts` (MEV/MAV/MRV baseline
   sets/week, adjusted by experience: novice −30% sets, advanced +10%; deprioritized → MV;
   focus → MAV..MRV).
3. **Session budget:** exercises ≈ session_minutes / ~9 min per exercise-slot; sets capped
   per session per muscle (~≤6–8 hard sets/muscle/session).
4. **Template assembly:** per workout day, pick movement-pattern slots from the split template
   (e.g. FB-A: squat pattern, horizontal push, horizontal pull, hinge, vertical push/pull alt,
   arms/core accessory), then choose the best available exercise per slot filtered by:
   equipment ⊆ gym equipment, difficulty ≤ experience, laterality variety (avoid two
   unilateral picks in one slot pair), non-overlapping primary muscles already hit that day.
5. **Prescriptions by goal:** hypertrophy → 2–3 sets, 6–12 reps (accessories 10–15), RIR 1–2;
   strength → 3–5 sets, 3–6 reps main lifts, RIR 2–3 (more rest); both → main lift strength
   scheme + accessories hypertrophy scheme.
6. **Deload scheduling:** every_4w/6w → week N marked deload (volume ×0.5, load ×0.85);
   auto → schedule at MRV proximity heuristic (fixed 5-week cycle v1).
7. Output: full programme tree (weeks, days, exercises, prescriptions) written transactionally;
   preview screen renders it *before* paywall/account (funnel requirement).

### 3.2 Progression engine (`engines/progression.ts`) — "Auto"

For each programmed exercise, using recent sessions (last 3 performances):

- **Performance model:** best-set e1RM (Epley) per session; endurance ratio = reps@load trend.
- **Double progression:** if both prescribed sessions in a row hit `rep_max` at `target_rir`
  or harder → increase load: barbells +2.5kg (upper) / +5kg (lower); dumbbells/isolates → next
  denomination from the gym profile (fallback +2%). If missed `rep_min` twice with honest RIR
  → −load one step / −5%.
- **RIR regulation:** if actual RIR exceeded target by ≥2 across sets, bump target load one
  step next time even mid-range; consistent RIR 0 grinders → hold load, add rep floor.
- **Rep-range expansion (plateau breaker):** stalled 3 sessions → widen range (e.g. 8–10 →
  6–10) once, then swap suggestion via smart-swap heuristics (same pattern/equipment/laterality).
- **Deload weeks:** engine emits reduced Auto targets from `programme_weeks.multiplier`.
- **Warm-up generator:** % working-load ramp (empty bar/50%/70%/85% × prescribed reps⁻¹ rule),
  capped at 3–4 warmup sets, skipped for isolates.
- Everything editable: any Auto cell can be overridden pre/post set; overrides recorded
  (`prescription_override bool`) so learning uses actuals, not prescriptions.
- All constants (increments, thresholds, e1RM formula choice, floors) live in
  `progression.rules.ts` with comments citing the principle (double progression; RIR-targeted
  autoregulation; deload attenuation).

### 3.3 Adaptive expenditure (`engines/expenditure.ts`)

Replaces Mifflin-St Jeor as the Calorie Bank's source of truth once data allows:

1. Daily weigh-ins smoothed with EWMA (half-life ≈ 10 d; missing days carried forward).
2. Rolling 14-day window: `ΔEWMA(kg)/days` → daily energy surplus/deficit ≈ Δ×7700/7 kcal.
3. `TDEE ≈ avg_intake − surplus_estimate`. Requires ≥14 distinct logged days AND ≥8 weigh-ins
   AND intake data present ≥70% of window → else fall back to blended mode:
   `0.5×formula + 0.5×estimate` between days 14–28, then fully adaptive.
4. Weekly job (on first app open each Monday, via RPC `recompute_expenditure`): write
   `expenditure_estimates` snapshot; clamp change to ±300 kcal vs prior week (stability);
   enforce safety floor.
5. Calorie Bank monthly deposit recomputed from current estimate × days-in-month; bank UI shows
   "Expenditure learned from your data" badge + trend sparkline of estimates.
6. Macro targets derived: protein g/kg by goal (cut 2.2, maintain 1.8, gain 2.0 — editable),
   fat 25% kcal, carbs remainder. Bank stays authoritative for kcal; macros advisory chips.

### 3.4 Set Levels aggregation (`levels.sql` view + `BodyMap.jsx`)

- SQL view `v_muscle_volume(user_id, muscle_id, window_start)`: sum over logged_sets joined
  exercises: `primary → credit 1.0`, secondaries × fraction; only `set_type <> 'warmup'`;
  completed sets only; windows 7/14/28 days selectable.
- `BodyMap.jsx`: inline SVG (hand-authored paths per muscle, front/back toggle) fill intensity
  scaled 0→MRV with legend; tap muscle → drill-in (which exercises contributed, weekly chart).
  Mini-thumbnails reuse same SVG with single-muscle highlight.

---

## 4. Frontend architecture

- **Shell:** `TabShell.jsx` — 5-tab bar, center raised FAB, safe-area padding, per-tab scroll
  restoration; Shortcuts bottom-sheet component global.
- **UI kit (`components/ui/`):** `ProgressRing`, `MetricCard`, `Sparkline` (tiny SVG, no chart
  lib yet), `HabitGrid`, `DayStrip`, `OptionCard`, `MuscleChips`, `SetTable`, `RestTimerChip`,
  `PlateCalculator`, `BottomSheet`, `SegmentedControl`, `Stepper`, `BodyMap`, `WidgetFrame`.
  All styled off CSS variables; dark-first palette (near-black bg #0B0B0B-family, charcoal
  cards, blue interactive accent) matching our existing green brand where sensible — accent
  tokenized so theming (System/Light/Dark) is a variable swap.
- **State/data:** keep Supabase direct calls in custom hooks (`hooks/useX.js`); introduce
  lightweight cache hook (`useQueryLite`) to dedupe/fetch-key caches — no Redux.
- **PWA:** manifest + icons + install prompt; service worker (Workbox via Vite plugin) with
  network-first for data, cache-first for catalog/static; offline queue for set completions
  (IndexedDB outbox flushed on reconnect).
- **Charts:** hand-rolled SVG sparklines v1; evaluate `visx`/`echarts` only if dashboards need
  richer interactions (decision point at Phase 5).

---

## 5. Screen build specs (acceptance criteria per screen)

**Onboarding hub** — 3-phase checklist nodes w/ states (done/current/locked), sticky CTA,
progress persists across visits (`users.onboarding_state`). Resume exactly where left.
**Basics steps (8)** — one decision/screen; big OptionCards; date/number inputs with unit-aware
steppers; skip allowed only for BF% & cardio experience; health-link step stores consent only
(web has no HealthKit — see §7).
**Gym steps (3)** — location type cards; nickname input; equipment multi-select grouped by
category w/ denominations editor (chip list per item), Selected/All toggle, Deselect All.
**Program steps (9)** — goal/focus/deprioritize multi-select body-map-lite pickers (reuse
muscle chips), days stepper, time cards, split cards (with mini layout diagrams), deload radio,
name input, color/icon personalization grid.
**Preview + paywall structure** — render generated program (days, workouts, exercises, weekly
sets/muscle summary); "everything can be customized" explainer; plan-comparison screen +
trial CTA wired to `entitlements` (creates trial row, no payment); then account creation if
guest, else straight in; First-30-days explainer; health disclaimer accept (versioned consent
columns reused).
**Today/Dashboard** — widget framework: ordered array from `dashboard_layout`, each widget a
component receiving its own fetcher; Customize mode = drag-reorder + visibility toggles.
Widgets v1: Weekly rings (sets/exercises/muscles vs program targets), Workouts insight card,
Weight Trend card (EWMA line + latest), Weigh-In habit grid, Workout habit grid, Body metrics
cards, Muscle-group cards (from Levels view), Exercise progress cards (per-exercise e1RM
sparkline), Steps placeholder (manual entry until integration exists).
**Workout tab** — DayStrip (completion rings), Active Program header w/ Week N switcher,
program card expandable, workout rows (letter, exercise preview, muscle chips, done state),
"Empty workout" entry, calendar icon → month history heatmap.
**Session player** — elapsed timer chip, rest timer auto-starts on set complete (configurable
duration per prescription, ± buttons), media slot = FormCheck quick-cam + cue card (see §7),
pills: Info/Warm Up/Targets/Swap/Notes, set table with Auto column, kg(/side), reps(/side),
RIR selector (0–4 wheel), set-type pill menu (normal/warm-up/drop/myoreps/partials/failure/
superset grouping), add-set, finish flow (summary: total volume, PRs earned, duration) →
writes log + habits + triggers PR detection toast/celebration.
**Levels** — body map front/back toggle, window selector, refresh, muscle list rows with
mini-thumb + sets count, empty state copy, drill-in panel.
**Shortcuts sheet** — circular actions (Weight, Photos, Metrics, History), Up Next card
(next unscheduled/next-in-split workout w/ chips), Empty Workout / New Program / New Workout
rows, configure icon.
**More** — sections per IA; Units converter affects display everywhere (kg⇄lb formatting util);
Theme switcher (3 cards); Gym profiles CRUD; Exercises settings (units, default rest);
Data Export (JSON download of all owned rows via storage/RPC), Account & Data Deletion
(cascade delete RPC + typed confirmation); Subscription page reads entitlements (structure).
**Exercise picker** (modal everywhere) — search, filters (muscle chips, equipment=gym profile,
type weighted/bodyweight, laterality), alphabetized rows w/ primary•secondary label, cart
badge multi-add, custom-exercise creation form.
**Nutrition** — day view meals w/ entries (quick add kcal/macros), macro chips vs targets,
adaptive status card (estimate, confidence, next calibration), Calorie Bank ledger retained
as the "balance" visualization, weekly estimate trend.

---

## 6. What we deliberately do differently (and why)

1. **No filmed technique library.** We can't ship Jeff Nippard's videos. Substitute: (a) rich
   cue/setup text per exercise, (b) **FormCheck** camera AI (already built — unique advantage),
   launched inline from the session player media slot, (c) optional external GIF/link field
   per exercise the owner can curate later. Roadmap item: record own short clips eventually.
2. **Web, not app-store IAP.** Entitlements table + trial logic now; Stripe checkout stubbed.
3. **Equipment catalog curated (~40 items, not 276)** covering >95% of commercial/home setups;
   schema identical so expansion is data-entry, not code.
4. **AI Assistant retained** as an on-brand extra MF doesn't emphasize: answers grounded in the
   user's own logs ("why did my bench Auto drop?").
5. **Postgres over Firestore** — Levels/aggregations become simple indexed SQL instead of
   client-side joins; also enables future coach re-addition without reshaping ownership.

---

## 7. Build sequence (phases, dependencies, definition-of-done)

Sizing: S ≈ half-session, M ≈ 1–2 sessions, L ≈ 3+ focused sessions (owner + agent pairing).

**Phase 0 — Foundations (S+M)** 
PWA shell: TabShell + 5 routes + FAB sheet skeleton; design tokens/CSS vars; Vitest scaffold;
`VITE_LEGACY_UI` flag. *DoD:* new shell navigable, legacy intact behind flag.

**Phase 1 — Catalog & profile data (M+L)** 
Migrations M1, M2 (+ seeds: muscles, equipment, ≥200 exercises incl. migrated presets);
Units util; Exercise picker modal. *DoD:* picker browsable against real gym equipment set.

**Phase 2 — Onboarding funnel (L)** 
M1 profile fields + onboarding state machine; all 20 wizard screens; gym profiles CRUD;
generator interview collects everything; guest-mode support. *DoD:* fresh email → finished
interview with persisted answers.

**Phase 3 — Generator (L)** 
`engines/generator.ts` + volume landmarks + templates; preview screen; persistence to
programme tables (M3). *DoD:* given 5 different input combos, produces sane, equipment-valid,
non-duplicated programs; unit tests pass.

**Phase 4 — Live session player (L)** 
M4 logging columns; SessionPlayer with timers/Auto/RIR/unilateral/set-types; finish flow;
habits seeding; history detail. *DoD:* complete a logged session end-to-end on mobile viewport;
offline completion queues and flushes.

**Phase 5 — Intelligence loops (M+L each)** 
5a Progression engine + warm-ups + PR detection + Swap suggestions. 5b Expenditure engine +
food entries UI + Calorie Bank rewiring + macro chips (M5). *DoD:* scripted 3-week simulated
history yields correct Auto changes and an expenditure estimate within expected band; bank
deposit switches source automatically.

**Phase 6 — Analytics surfaces (M+L)** 
Levels SQL view + BodyMap + drill-ins; Dashboard widget framework + v1 widget set +
Customize editor; weigh-in flow; progress photos (storage bucket + capture UI). *DoD:*
dashboard renders personalized widgets reorderably; body map fills from real logged sets.

**Phase 7 — More/settings, paywall structure, cutover (M)** 
M6; More hub subpages; export + deletion flows; trial/entitlement screens (no billing);
disclaimer/versioned consent; polish pass; flip default route to new IA; archive legacy
routes (keep code 1 release). *DoD:* clean-device walkthrough matches MF flow parity
checklist; Lighthouse PWA install passes; RLS audit green.

Dependency note: Phases strictly gate 0→1→2→{3,4}→5→6→7; within-phase items parallelizable.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Scope creep toward "full MF clone" | Feature-freeze list §0/§6; anything not listed needs explicit owner approval |
| Schema churn breaking legacy pages | Additive-only migrations; views shim old shapes during transition |
| Generator output feels wrong | Ship "Everything can be customized" honestly: editor-first fallback; tune constants from owner's training knowledge |
| Offline complexity | v1: offline = completing an open session + viewing last program; broader sync deferred |
| Solo-owner bandwidth | Phase DoDs sized small; each phase lands usable value even if later phases slip |
| Legal/IP | No MF assets/copy/constants; disclaimer + consent versioned; our own maths documented |

## 9. QA checklist (per phase exit)

Mobile-viewport manual pass (360×800), keyboard pass, RLS probe (second test account cannot
read/write others' rows), empty-state pass (fresh user, zero data), Lighthouse ≥90 perf/a11y
targets on Today + Workout, Vitest green on engines, migration up/down reviewed.

---

*Companion docs: `MacroFactor_Workouts_Teardown.md` (source spec, root folder),
`docs/ARCHITECTURE.md` (legacy). This roadmap is the single source of truth for the rebuild.*
