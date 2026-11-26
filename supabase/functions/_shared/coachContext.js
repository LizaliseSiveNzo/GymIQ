import { loadCoachHistory, loadCoachProgress, buildCoachHistory } from './coachHistory.js';
import { validateKitchen } from './coach.js';
import foods from './nutrition/foods.json' with { type: 'json' };

// Builds the full coaching context for a user: the validated food/equipment/exercise
// context (for tools), the facts summary (for the model), and the baseline (for apply checks).
export async function buildCoachContext(scoped, { userId, day, offset = 0 }) {
  const [queries, records] = await Promise.all([
    Promise.all([
      scoped.from('coach_settings').select('pantry,equipment').eq('user_id', userId).maybeSingle(),
      scoped.from('nutrition_goals').select('settings,result,updated_at').eq('user_id', userId).maybeSingle(),
      scoped.from('nutrition_meal_plans').select('created_at,day,plan,target,source').eq('user_id', userId).eq('day', day).maybeSingle(),
      scoped.from('equipment_items').select('id,name').order('sort_order'),
      scoped.from('exercises').select('id,name,equipment_ids,movement_pattern,primary_muscle_id,secondary_muscle_fraction,cue_text').eq('is_custom', false).order('sort_order').limit(250),
      scoped.from('workout_programmes').select('id,goal,days_per_week,session_minutes,programme_days(label,name,programme_exercises(exercise_id,name,target_sets,target_reps,target_rir))').eq('client_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1),
      loadCoachProgress(scoped),
    ]),
    loadCoachHistory(scoped, { userId, day, offset }),
  ]);
  if (queries.some((q) => q.error)) throw Error('Could not load your coach context. Please reload and try again.');
  const [settings, goal, plan, equipment, catalogue, programmes, progress, history] = queries.map((q) => q.data);
  const kitchen = validateKitchen(settings, foods, equipment);
  const exercises = catalogue.filter((e) => (e.equipment_ids || []).every((id) => id === 'bodyweight' || kitchen.equipment.includes(id)));
  const programme = programmes[0];
  const context = { foods, kitchen, exercises, day, target: goal?.result?.target, diet: goal?.settings?.diet || 'regular', excludes: goal?.settings?.excludes || [] };
  const baseline = { settings: kitchen, goal_updated_at: goal?.updated_at || null, plan_created_at: plan?.created_at || null, programme_id: programme?.id || null, offset };
  const facts = {
    day,
    daily_calorie_guide_estimate: context.target || null,
    diet: context.diet,
    excluded_allergens: context.excludes,
    available_ingredients: foods.filter((f) => kitchen.pantry.includes(f.id)).map(({ id, name, kcal, protein, carbs, fat, allergens, vegetarian, vegan }) => ({ id, name, kcal_per_100g: kcal, protein_per_100g: protein, carbs_per_100g: carbs, fat_per_100g: fat, allergens, vegetarian, vegan })),
    available_equipment: equipment.filter((e) => e.id === 'bodyweight' || kitchen.equipment.includes(e.id)),
    exercise_library: exercises,
    current_programme: programme ? { goal: programme.goal, days_per_week: programme.days_per_week, session_minutes: programme.session_minutes, days: programme.programme_days } : null,
    personal_history: buildCoachHistory({ day, offset, records, progress, goal, plan, catalogue, foods }),
  };
  return { context, facts, baseline, settings, goal, plan, equipment, catalogue, programme };
}
