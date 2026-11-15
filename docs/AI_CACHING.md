# AI response caching (public FAQs)

Conservative, exact-match caching for genuinely generic public FAQs in the
Personal AI coach. It reuses vetted public answers instead of making a new
DeepSeek generation request.

## What is cached

Only **vetted public product information**, stored in the `public.faq_cache`
table and seeded by migration `20261116000000_faq_cache.sql`:

- App navigation ("where is the Calorie Bank", "how do I change my workout style")
- Account basics ("how do I export/delete my data", "reset password", "contact support")
- Public billing info ("how much does premium cost", "how do I cancel premium")
- Stable product info ("what does premium include")

## What is never cached

Personalized fitness or nutrition advice, workout recommendations, meal plans,
food logs, progress, injuries, medical questions, account status, subscriptions,
payments, private data, conversation-dependent or tool-dependent answers, and
anything that changes data. These always bypass the cache and use the normal
generation flow. Ambiguous eligibility bypasses.

## How it works

1. Server-side eligibility check (`isPublicFaqEligible`) — a conservative
   deny-list that rejects medical, fitness/nutrition and personalized requests.
2. Exact-match lookup (`lookupFaq`) against `faq_cache`, keyed by
   normalized query + `content_version` + `language` + `prompt_version`, with
   `expires_at` honoured.
3. On a hit, the cached answer is saved to the coach turn and returned (zero
   generation). On a miss or an ineligible query, the normal DeepSeek flow runs.

Normalization only lowercases, trims, collapses whitespace and strips trailing
punctuation — negation, quantities, units and wording are preserved.

## What is not implemented

- **Semantic (embedding) caching is disabled** — GymIQ has no configured
  embedding provider. Adding it would introduce per-query embedding cost and a
  wider matching surface, so it is intentionally out of scope for now.
- **Private per-user response caching** — not implemented.
- **Prompt-prefix caching** — DeepSeek applies automatic context caching to
  repeated input prefixes, but the coach's system message includes per-user
  context, so no additional configuration is applied here.

## Configuration

- **Feature flag:** set the edge-function secret `GYMIQ_FAQ_CACHE=off` to
  disable caching instantly. Any other value (or unset) leaves it on.
- **Invalidation:** bump `FAQ_CONTENT_VERSION` (or `FAQ_PROMPT_VERSION`) in
  `supabase/functions/_shared/faqCache.js`, or update/delete rows in
  `public.faq_cache`. Expired rows are ignored automatically.

## Deployment

1. Run migration `20261116000000_faq_cache.sql` (SQL Editor).
2. Redeploy the `gymiq-coach` edge function (it now imports `faqCache.js`).
3. No new secrets are required.

## Metrics

The coach logs `faq-cache: hit:<topic>` / `miss` to edge-function logs, with no
query text or user identifiers, so only aggregate hit/miss rates are observable.
