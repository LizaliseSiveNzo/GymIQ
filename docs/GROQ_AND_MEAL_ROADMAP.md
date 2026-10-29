# GymIQ: staged AI and calorie tracking work

## Stage 1: Groq reviews

Implemented an opt-in training review in Exercise stats and a food-logging review
in Calorie Bank. The server prepares numerical summaries; no name, email, date
of birth, raw meal notes or exercise names are sent to Groq. Reviews are advisory
and cannot edit records, targets or transactions. Basic reviews send nothing to
Groq. Privacy terms include optional AI processing and saved reviews.

Supabase Edge Function: `gymiq-review`. Secret: `GROQ_API_KEY` (server only).
Optional `GROQ_MODEL`: `openai/gpt-oss-120b` (default) or `openai/gpt-oss-20b`.
Enable Zero Data Retention in Groq's Data Controls before real customer use.
No API keys belong in Vite variables, repository files or chat.

Fresh provider requests are capped at two per user per review type per UTC day,
50 across GymIQ per UTC day, and two across the app per minute. Failed provider
attempts also count. Identical snapshots reuse cached, validated commentary.
Groq's own account-wide quotas still apply. Provider calls have an 18-second
timeout and bounded output. Unavailable or invalid responses use a labelled
rules-based review. No retry loops, tools, arbitrary prompts or automatic writes.

`ai_review_cache` and `ai_review_attempts` use owner-only read policies; only the
authenticated server can store AI responses or reserve usage. Account exports
include these tables and account deletion cascades their rows.
The shared cap uses `ai_provider_requests`, which holds request timestamps with
no account identifiers. It survives deletion of owned data so the budget cannot
be reset by deleting accounts. This table intentionally has no browser grants or
RLS policies; only the service role can access it. An RLS-without-policies
informational advisory is expected for this server-only table.

## Stage 2: meal builder (next stage, not part of Stage 1)

- Breakfast, lunch, snack and dinner slots.
- Ingredient/portion-based calorie totals from traceable food composition data.
- Save custom meal templates and offer familiar balanced preset meals.
- Show portion and preparation assumptions; estimates are not exact intake.
- Snapshot logged meal quantities and nutrition so later template edits cannot
  silently rewrite past food transactions.
- AI may explain or suggest choices; it must not invent food calorie values.

## Stage 3: manual steps in Workouts (after meal builder)

- Input and edit a day's step total from the Workouts section.
- Label step energy as an estimate and explain the calculation assumptions.
- Update a single linked Calorie Bank credit when steps change; never add the
  whole day's credit again on every save.
- Account for activity already included in the calorie target to avoid counting
  the same activity twice. Preserve a clear transaction trail and undo behaviour.
