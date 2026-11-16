// Conservative public-FAQ response cache.
// Exact-match only. Vetted public content lives in the `faq_cache` table.
// Semantic caching is intentionally NOT implemented here: GymIQ has no
// configured embedding provider, and this keeps shared caching narrow and safe.

export const FAQ_CONTENT_VERSION = '2026-11-16-v1';
export const FAQ_PROMPT_VERSION = 'faq-v1';
export const FAQ_LANGUAGE = 'en';

// Normalize only harmless formatting: lowercase, trim, collapse whitespace,
// strip trailing punctuation. Negation, quantities, units and wording are
// preserved so closely-worded-but-different questions never collide.
export function normalizeQuery(text) {
  return String(text || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
}

// Categories that must always bypass the shared cache. This deny-list is a
// conservative first pass; the exact-match lookup against vetted keys is the
// real gate. Anything ambiguous bypasses.
const FAQ_DENY = [
  // Medical / injury — always bypass.
  /\b(injur|pain|hurt|ache|sore|medical|doctor|diagnos|condition|symptom|disease|pregnant|breastfeed|allerg)\w*/i,
  // Fitness / nutrition advice terms (feature names like "Calorie Bank" are not advice).
  /\b(protein|carb|macros?|muscle|workout|exercise|train|routine|meal|diet|nutrition|supplement|reps|sets|bulk)\w*/i,
  // Recommendations / personalized advice requests.
  /\b(recommend|suggest|advise|prescribe|should i|how should|give me)\b/i,
];

export function isPublicFaqEligible(text) {
  const t = normalizeQuery(text);
  if (!t || t.length > 200) return false;
  return !FAQ_DENY.some((re) => re.test(t));
}

// Exact-match lookup against the shared vetted FAQ store. Returns
// { answer, topic } or null. The caller (server) supplies the service-role
// Supabase client; identity is never taken from the client.
export async function lookupFaq(db, text) {
  const key = normalizeQuery(text);
  if (!key) return null;
  const { data, error } = await db.from('faq_cache')
    .select('answer,topic')
    .eq('query_key', key)
    .eq('content_version', FAQ_CONTENT_VERSION)
    .eq('language', FAQ_LANGUAGE)
    .eq('prompt_version', FAQ_PROMPT_VERSION)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
