type Snapshot = Record<string, any>;
export function providerFacts(snapshot: Snapshot) {
  if (snapshot.domain === 'training') return {
    domain: 'training', sessions_recent7: snapshot.sessions_recent7, sessions_previous7: snapshot.sessions_previous7,
    working_sets_recent7: snapshot.working_sets_recent7,
    exercises: (snapshot.exercises || []).map((e: any, i: number) => ({
      label: `Exercise ${i+1}`, last_weight: e.last_weight, last_reps: e.last_reps,
      previous_weight: e.previous_weight, previous_reps: e.previous_reps, last_sets: e.last_sets,
    })),
  };
  return { domain: 'nutrition', daily_target_estimate: snapshot.daily_target,
    food_kcal_logged_today: snapshot.food_kcal_today, food_entries_today: snapshot.food_entries_today,
    food_days_logged_recent7: snapshot.food_days_recent7, food_kcal_logged_recent7: snapshot.food_kcal_recent7 };
}
export function basicReview(snapshot: Snapshot) {
  if (snapshot.domain === 'training') {
    const hasData = (snapshot.exercises || []).length > 0;
    return { summary: hasData ? 'Your finished working sets are ready to compare. Review the last performed load and reps together before choosing your next target.' : 'Finish a workout to build a reliable training review.',
      focus: hasData ? 'progression' : 'logging',
      suggestion: hasData ? 'Use your recent exercise history to review progress. Keep technique consistent and edit any incorrectly logged sets before changing targets.' : 'Record only sets you performed, then save and finish the workout. Cancelled sessions and removed exercises are excluded.' };
  }
  const hasFood = Number(snapshot.food_entries_today) > 0;
  return { summary: hasFood ? 'Your food entries provide a starting point for reviewing today’s intake. Logged food is a partial record, and calorie targets and activity credits are estimates.' : 'No food is logged for today yet. Missing entries do not mean you have eaten nothing.',
    focus: 'logging', suggestion: 'Log portions, drinks, cooking oil and sauces consistently. Keep regular, balanced meals; do not skip meals or use exercise to compensate for a calorie balance.' };
}
export function canReview(snapshot: Snapshot) {
  return snapshot.domain === 'training' ? (snapshot.exercises || []).length > 0 : Number(snapshot.daily_target)>0 && Number(snapshot.food_entries_today)>0;
}
export const reviewSchema = {
  type: 'object', additionalProperties: false,
  properties: { summary: { type: 'string' }, focus: { type: 'string', enum: ['progression','consistency','logging','portions','balance'] }, suggestion: { type: 'string' } },
  required: ['summary','focus','suggestion'],
};
export function validReview(value: any, domain: string) {
  if (!value || typeof value !== 'object' || Object.keys(value).some(k => !['summary','focus','suggestion'].includes(k))) return false;
  if (!['progression','consistency','logging','portions','balance'].includes(value.focus)) return false;
  if (domain === 'nutrition' && !['logging','portions','balance'].includes(value.focus)) return false;
  if (domain === 'training' && !['progression','consistency','logging'].includes(value.focus)) return false;
  for (const key of ['summary','suggestion']) {
    if (typeof value[key] !== 'string' || value[key].length<15 || value[key].length>420) return false;
    // Numbers stay in the verified facts, never in model-created prescriptions.
    if (/[0-9<>]|https?:|\b(diagnos\w*|cure|medication|starv\w*|fasting|detox|double|triple|guarantee\w*)\b|skip (your )?meals|push through pain|ignore pain|burn off|earn (your )?food/i.test(value[key])) return false;
    if (domain==='nutrition' && /\b(activity|exercise|training|workouts?|strength|deficit|surplus|under.?eat\w*|over.?eat\w*|under.?fuel\w*)\b|low intake|too (few|many) calories|below (your )?target|above (your )?target/i.test(value[key])) return false;
  }
  return true;
}
export function groqRequest(snapshot: Snapshot, model: string) {
  return { model, reasoning_effort: 'low', max_completion_tokens: 768, include_reasoning: false, stream: false,
    messages: [
      { role: 'system', content: 'You write brief, cautious general fitness commentary for GymIQ adults. Use only the supplied calculated facts; never invent progress, complete missing logs, or diagnose. Return short plain English JSON. Put no numbers, numerical targets, weight changes, calorie prescriptions or links in your text: the app shows verified figures separately. Workout names are anonymised. Training: compare performed load and reps as a pair; volume or more sessions alone is not proof of strength gain. Nutrition: logging days describe logging, NOT activity or exercise. Do not discuss training or activity in a nutrition review. Food logs may be incomplete and do not reveal actual intake or nutrient adequacy. Never claim a calorie deficit, surplus, overeating or undereating. Never recommend restriction, fasting, compensation, skipping meals, or treatment. Suggest consistent food logging, portion awareness and regular balanced meals. Never change records. Use a training focus of progression/consistency/logging or nutrition focus logging/portions/balance.' },
      { role: 'user', content: JSON.stringify(providerFacts(snapshot)) },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'gymiq_review', strict: true, schema: reviewSchema } },
  };
}
