// meal-analyze: estimates a meal's foods and macros from a photo using Gemini
// Flash (vision). The model identifies foods and portions; macros are then
// computed deterministically from the vetted food library, never from the
// model's guessed numbers. Unmatched foods are returned as estimated-only.
// Requires secret GEMINI_API_KEY. Nothing personalized is cached.

import { authenticate, cors, json } from '../_shared/launch.ts';
import foods from '../_shared/nutrition/foods.json' with { type: 'json' };
import { mealTotals } from '../_shared/nutrition/planner.js';

const MAX_BYTES = 4_000_000; // ~3MB base64 cap; frontend downscales to ~200KB anyway.

function matchFood(name: string) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return null;
  const exact = foods.find((f) => f.name.toLowerCase() === n);
  if (exact) return exact;
  const core = n.replace(/·.*$/, '').trim();
  const coreMatch = foods.find((f) => f.name.toLowerCase().replace(/·.*$/, '').trim() === core);
  if (coreMatch) return coreMatch;
  const substring = foods.find((f) => { const fn = f.name.toLowerCase(); return fn.includes(n) || n.includes(fn); });
  if (substring) return substring;
  for (const w of core.split(/[^a-z]+/).filter((x) => x.length > 2)) {
    const m = foods.find((f) => f.name.toLowerCase().includes(w));
    if (m) return m;
  }
  return null;
}

function gramsOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 2000 ? Math.round(n) : 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'Photo analysis is not configured yet.' });
    const user = await authenticate(req);
    if (!user) return json({ error: 'Sign in to analyse a meal.' });

    const { image } = await req.json();
    if (typeof image !== 'string' || !image) return json({ error: 'Choose a photo first.' });
    if (image.length > MAX_BYTES) return json({ error: 'That photo is too large. Use a smaller one.' });

    const prompt = 'Identify the foods in this meal photo. For each food estimate the grams on the plate.'
      + ' Return ONLY a JSON object in the shape {"foods":[{"name":"...","grams":120}]}.'
      + ' Use common food names (e.g. "chicken breast", "brown rice", "broccoli").'
      + ' Ignore plates, cutlery, packaging, hands and background. Do not invent foods.';

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: image } }, { text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' },
      }),
    });
    const j = await r.json();
    if (!r.ok || j?.error) {
      return json({ error: 'Photo analysis is unavailable right now.', detail: j?.error?.message || `Gemini returned ${r.status}` });
    }
    const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: { foods?: Array<{ name?: string; grams?: unknown }> } = {};
    try { parsed = JSON.parse(raw); } catch { /* fall through to empty */ }

    const detected = Array.isArray(parsed?.foods) ? parsed.foods : [];
    const outFoods = [];
    const items: Array<{ food_id: string; grams: number }> = [];
    for (const d of detected) {
      const name = String(d?.name || '').trim();
      const grams = gramsOf(d?.grams);
      if (!name || !grams) continue;
      const food = matchFood(name);
      if (food) {
        outFoods.push({ name: food.name, food_id: food.id, grams, estimated: false });
        items.push({ food_id: food.id, grams });
      } else {
        outFoods.push({ name, food_id: null, grams, estimated: true });
      }
    }

    let totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    if (items.length) {
      try { totals = mealTotals(items, foods); } catch { /* keep zeros */ }
    }
    return json({ foods: outFoods, totals, matched: items.length, unmatched: outFoods.length - items.length });
  } catch (e) {
    return json({ error: 'Could not analyse that photo. Try again or log it manually.', detail: String(e) });
  }
});
