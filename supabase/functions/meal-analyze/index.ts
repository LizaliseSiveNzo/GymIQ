// meal-analyze: estimates a meal's foods and macros from a photo using Gemini
// Flash (vision). The model identifies foods and portions; macros are then
// computed deterministically from the vetted food library, never from the
// model's guessed numbers. Unmatched foods are returned as estimated-only.
// Requires secret GEMINI_API_KEY. Nothing personalized is cached.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
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

    const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } }, auth: { persistSession: false } });
    const membership = await scoped.rpc('has_active_membership');
    const isPremium = membership.data === true;
    if (!isPremium) {
      const todaySA = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
      const dayStart = new Date(todaySA + 'T00:00:00+02:00').toISOString();
      const { count } = await scoped.from('photo_scan_log').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', dayStart);
      if ((count ?? 0) >= 3) return json({ error: 'You have used your 3 free photo scans today. Upgrade to premium for unlimited scans.' });
    }

    const { image, images } = await req.json();
    const imgs: string[] = Array.isArray(images) && images.length ? images : image ? [image] : [];
    if (!imgs.length) return json({ error: 'Choose a photo first.' });
    if (imgs.length > 3) return json({ error: 'You can upload up to 3 photos.' });
    if (imgs.some((img) => typeof img !== 'string' || !img || img.length > MAX_BYTES)) return json({ error: 'One of those photos is too large. Use smaller ones.' });

    const prompt = 'These are photos of the same meal (from different angles). Identify each distinct food across all photos, once each.'
      + ' For each food, estimate its portion weight in grams as accurately as you can (a typical serving amount).'
      + ' Return ONLY compact JSON with no extra spaces or line breaks, shaped exactly like {"foods":[{"name":"chicken breast","grams":150}]}.'
      + ' Use singular, specific food names ("carrot" not "carrots", "beef mince" not "mince meat").'
      + ' Ignore plates, cutlery, packaging, hands and background. Do not invent foods or repeat the same food twice.';

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [...imgs.map((img) => ({ inlineData: { mimeType: 'image/jpeg', data: img } })), { text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' },
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
      const estimated = d?.grams ? gramsOf(d.grams) : 0;
      const grams = estimated > 0 ? estimated : portionToGrams(d?.portion || d?.size, food);
      const portion = String(d?.portion || d?.size || 'medium').toLowerCase();
      if (food) {
        outFoods.push({ name: food.name, food_id: food.id, grams, estimated: false, portion });
        items.push({ food_id: food.id, grams });
      } else {
        outFoods.push({ name, food_id: null, grams, estimated: true, portion });
      }
    }

    if (!outFoods.length) {
      const fr = j?.candidates?.[0]?.finishReason;
      return json({ error: 'No foods were detected. Try a clearer, closer photo.', detail: `finishReason=${fr} raw=${raw.slice(0, 300)}` });
    }

    let totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    if (items.length) {
      try { totals = mealTotals(items, foods); } catch { /* keep zeros */ }
    }
    if (!isPremium) await scoped.from('photo_scan_log').insert({ user_id: user.id });
    return json({ foods: outFoods, totals, matched: items.length, unmatched: outFoods.length - items.length });
  } catch (e) {
    return json({ error: 'Could not analyse that photo. Try again or log it manually.', detail: String(e) });
  }
});
