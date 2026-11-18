// meal-analyze: estimates a meal's foods and macros from a photo using Gemini
// Flash (vision). The model identifies foods and portions; macros are then
// computed deterministically from the vetted food library, never from the
// model's guessed numbers. Unmatched foods are returned as estimated-only.
// Requires secret GEMINI_API_KEY. Nothing personalized is cached.

import { authenticate, cors, json } from '../_shared/launch.ts';
import foods from '../_shared/nutrition/foods.json' with { type: 'json' };
import { mealTotals } from '../_shared/nutrition/planner.js';

const MAX_BYTES = 4_000_000; // ~3MB base64 cap; frontend downscales to ~200KB anyway.

const SYNONYMS: Record<string, string> = {
  'ground beef': 'beef mince', 'mince meat': 'beef mince', 'minced beef': 'beef mince', 'minced meat': 'beef mince', 'ground meat': 'beef mince',
  'scallion': 'spring onion', 'scallions': 'spring onion', 'green onion': 'spring onion', 'spring onions': 'spring onion',
  'capsicum': 'pepper', 'bell pepper': 'pepper', 'bell peppers': 'pepper',
  'courgette': 'zucchini', 'courgettes': 'zucchini',
  'cilantro': 'coriander',
};

function normalizeName(name: string): string {
  return String(name || '').toLowerCase().replace(/·.*$/, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 3) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

function matchFood(name: string) {
  const n = normalizeName(name);
  if (!n) return null;
  const n2 = SYNONYMS[n] || n;
  const exact = foods.find((f) => normalizeName(f.name) === n2);
  if (exact) return exact;
  const sing = n2.split(' ').map(singularize).join(' ');
  const singMatch = foods.find((f) => normalizeName(f.name) === sing);
  if (singMatch) return singMatch;
  let best = null as (typeof foods)[number] | null, bestLen = 0;
  for (const f of foods) {
    const fn = normalizeName(f.name);
    if (fn.includes(n2) || n2.includes(fn)) {
      const len = Math.min(fn.length, n2.length);
      if (len > bestLen) { best = f; bestLen = len; }
    }
  }
  if (best) return best;
  const words = sing.split(' ').filter((w) => w.length > 2);
  let bestScore = 0, bestWord = null as (typeof foods)[number] | null;
  for (const f of foods) {
    const fn = normalizeName(f.name);
    const score = words.filter((w) => fn.includes(w)).length;
    if (score > bestScore) { bestScore = score; bestWord = f; }
  }
  return bestScore >= 1 ? bestWord : null;
}

function gramsOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 2000 ? Math.round(n) : 0;
}

const DEFAULT_PORTION = 100;
function portionToGrams(portion: unknown, food: { portion_grams?: number } | null): number {
  const base = Number(food?.portion_grams) || DEFAULT_PORTION;
  const p = String(portion || '').toLowerCase().trim();
  if (p === 'small' || p === 's') return Math.max(20, Math.round(base * 0.5));
  if (p === 'large' || p === 'l' || p === 'big' || p === 'xl') return Math.min(2000, Math.round(base * 1.5));
  return base;
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

    const prompt = 'Identify each distinct food on this plate separately (for example: chicken breast, white rice, broccoli, beef mince).'
      + ' For each food, estimate its portion size as "small", "medium", or "large" (a portion, not an exact weight).'
      + ' Return ONLY a JSON object in the shape {"foods":[{"name":"chicken breast","portion":"medium"}]}.'
      + ' Use singular, specific food names (e.g. "carrot" not "carrots", "beef mince" not "mince meat").'
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
    let raw = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('').trim();
    raw = String(raw).replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim();
    let parsed: any = {};
    try { parsed = JSON.parse(raw); }
    catch {
      const start = raw.search(/[{[]/);
      if (start >= 0) { try { parsed = JSON.parse(raw.slice(start)); } catch { parsed = {}; } }
    }

    const detected: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.foods) ? parsed.foods : Array.isArray(parsed?.items) ? parsed.items : [];

    const outFoods: any[] = [];
    const items: Array<{ food_id: string; grams: number }> = [];
    for (const d of detected) {
      const name = String(d?.name || d?.item || d?.food || '').trim();
      if (!name) continue;
      const food = matchFood(name);
      const grams = d?.grams ? gramsOf(d.grams) : portionToGrams(d?.portion || d?.size, food);
      const portion = String(d?.portion || d?.size || 'medium').toLowerCase();
      if (food) {
        outFoods.push({ name: food.name, food_id: food.id, grams, estimated: false, portion });
        items.push({ food_id: food.id, grams });
      } else {
        outFoods.push({ name, food_id: null, grams, estimated: true, portion });
      }
    }

    if (!outFoods.length) {
      return json({ error: 'No foods were detected. Try a clearer, closer photo.', detail: raw.slice(0, 400) });
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
