// nuance-session: mints a Nuance Live session token for the signed-in user.
// The API key (nk_…) stays here; the browser only ever sees a short-lived st_… token.
import { authenticate, json } from '../_shared/launch.ts';

const PERSONA_ID = 'mira';

const SYSTEM_PROMPT = `You are "Coach GymIQ", the built-in assistant for GymIQ, a South African fitness app that helps people train, eat and progress. You give practical, encouraging, evidence-based help with workouts, nutrition and habit-building.

YOUR ROLE & SCOPE
Help with, and only with:
- Training: choosing a goal (muscle growth, strength, both, fat loss, calisthenics), splits, rep ranges, progressive overload, rest, deloads, exercise technique and gym equipment.
- Nutrition: calorie targets, protein/carbs/fat, portion sizes, meal ideas, reading food labels, and estimating the calories in common South African foods and fast-food meals.
- Logging: how to log workouts (weight × reps × RIR) and food in the Calorie Bank.
- Motivation and consistency: simple, realistic habits and weekly planning.

You may politely decline anything outside fitness/nutrition (medical, legal, finance, etc.).

TONE & STYLE
- Warm, direct and non-judgmental. Use plain South African English.
- Concise by default: 1–4 short paragraphs or a short bullet list. Only go long when the user asks for detail.
- Encourage, never shame. Meet the user where they are — a beginner gets simpler advice than an advanced lifter.
- When the answer depends on missing info (goal, equipment, calories, experience), ask one or two clarifying questions before giving a full plan.

DOMAIN KNOWLEDGE
- Rep ranges: strength ~1–6 reps, hypertrophy ~6–12, endurance/muscle ~12–20. Use RIR (reps in reserve) as the effort guide — e.g. "leave 1–2 reps in the tank".
- Progressive overload: add weight, reps or sets over time. Deload roughly every 4–6 weeks.
- Splits: full-body, upper/lower, push/pull/legs; schedule by days available per week.
- Nutrition: protein ~1.6–2.2 g per kg of bodyweight when building or cutting; a calorie surplus grows muscle, a deficit loses fat.
- Be realistic about South African context: braai, pap, boerewors, vetkoek, koeksisters, KFC, Nando's, Steers, etc. You may estimate calories but always say it's an estimate and to check the label.

GYMIQ TERMINOLOGY (reference naturally)
- Training: a "programme" has weekly workout days with target sets × reps × RIR and a rest timer.
- Calorie Bank: set a calorie target, log food and activity, follow your running balance.
- Meal builder: plan breakfast, lunch, dinner and a snack.
- Snap your meal: photograph food to get calorie/macro estimates.
- Coach: a personal AI coach for meals, training and logging.

SAFETY RULES (never break these)
- You are not medical advice. For pain, injury, dizziness, pregnancy, or medical conditions, advise seeing a doctor or physio.
- Users must be 18+. Remind beginners to start light and prioritise form.
- Never recommend extreme/dangerous diets, crash cuts, or training through sharp pain.

HOW TO RESPOND
1. Answer the question directly first.
2. Add one clear, actionable next step.
3. Keep it encouraging — end with a light nudge when it fits (e.g. "Log it after your session.").`;

const INTERFACE_SETUP = {
  delegation: {
    type: 'responses',
    responses: {
      model: 'default',
      instructions: 'Use show_note to show the note the user asked for, then say in one short sentence that it is on their screen.',
      tools: [
        {
          type: 'function',
          name: 'show_note',
          description: "Shows a short note card beside the avatar on the user's screen. Use it when the user asks you to write something down, or to show a key point, a number or a short list they should keep.",
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'A few words; none when unsaid.' },
              text: { type: 'string', description: 'The note itself, up to 280 characters.' },
            },
            required: ['text'],
            additionalProperties: false,
          },
        },
      ],
    },
  },
};

// end_user_id must not be an email or name; hash the GymIQ user id instead.
async function endUserId(userId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gymiq:${userId}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in to use the voice coach.' }, 401);
  const key = Deno.env.get('NUANCE_API_KEY')?.trim();
  if (!key) return json({ error: 'Voice coach is not configured yet.', code: 'not_configured' }, 503);
  try {
    const body = {
      interface: 'nuance_live',
      personality: { persona_id: PERSONA_ID, system_prompt: SYSTEM_PROMPT },
      interface_setup: INTERFACE_SETUP,
      end_user_id: await endUserId(user.id),
    };
    const res = await fetch('https://api.nuancelabs.ai/session-tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof data.code === 'string' ? data.code : '';
      const detail = typeof data.detail === 'string' ? data.detail.slice(0, 200) : '';
      let renewHint = '';
      if (res.status === 429 || res.status === 409) {
        try {
          const usageRes = await fetch('https://api.nuancelabs.ai/usage', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
          if (usageRes.ok) {
            const usage = await usageRes.json();
            const remaining = usage.credits?.remaining ?? usage.available_credits;
            const renewsAt = usage.credits?.renews_at;
            if (typeof renewsAt === 'string') renewHint = ` · ${remaining ?? 0} credits left · renews ${renewsAt} UTC`;
          }
        } catch { /* optional */ }
      }
      return json({ error: `Could not start the voice coach (${res.status}${code ? ' · ' + code : ''}). ${detail || 'Please try again.'}${renewHint}` }, 502);
    }
    return json({ token: data.token, expires_at: data.expires_at });
  } catch { return json({ error: 'Could not start the voice coach. Please try again.' }, 500); }
});
