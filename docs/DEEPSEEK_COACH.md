# DeepSeek personal coach

DeepSeek replaces Groq in reviews and public-catalogue meal selection. `gymiq-coach` adds a personal coach at `/coach`, linked from the Training menu, Calorie Bank menu and Account. The initial enabled account is resolved from the owner-confirmed email during migration; the allowlist is server-managed, never user metadata.

## Configuration

- Supabase Edge Function secret `DEEPSEEK_API_KEY` is required. Keep it out of Vercel client variables and Git.
- Optional `DEEPSEEK_MODEL`: `deepseek-flash` (default) or `deepseek-v4-pro`.
- Direct API: `https://api.deepseek.com/chat/completions`. Non-thinking mode, bounded completions, validated JSON for old reviews/selection, allowlisted function tools for the coach. No Groq fallback.
- Deploy `gymiq-coach`, `gymiq-review`, `gymiq-meal-plan` with their shared files. Each authenticates the bearer token itself using Supabase Auth.

Current provider contracts: [DeepSeek models](https://api-docs.deepseek.com/quick_start/pricing/), [tool calls](https://api-docs.deepseek.com/guides/tool_calls/), [JSON output](https://api-docs.deepseek.com/guides/json_mode/).

## What the coach can do

1. Save selected available ingredients and equipment, or import the equipment selection from an owned gym profile. Availability does not track stock quantities.
2. Chat using an explicit opt-in. Context includes the message, recent conversation, selected foods/equipment, saved calorie guide and diet/exclusions, current programme and up to 60 recent performed sets. Account identity and measurements are omitted. User-written messages can themselves contain personal information.
3. `draft_meal`: assemble a custom recipe from supported available catalogue ingredients. Validate food IDs, amounts, allergies, diet, food states and portions; calculate nutrients in GymIQ. Save the approved meal to Meal builder, without logging intake.
4. `draft_meal_plan`: validate four custom meals and balance their portions to the existing saved guide. Applying replaces today’s planned meals, never food already logged.
5. `draft_workout`: build a replacement programme from library IDs that match all selected equipment. Bound sets/reps/rest and weekly training days; retain user load defaults and completed history. Applying requires no unfinished session. The programme includes eight weeks with every fourth week deloaded.

The initial food catalogue has 21 foods. Unsupported ingredients must be selected/added to the catalogue before the coach can use them with calculated nutrition. Mixed main meals are the default; vegetarian/vegan meals require the saved diet setting.

## Action boundary

- Tools prepare drafts only. The model cannot execute SQL, fetch arbitrary URLs, edit PRs or mutate historical food/sets.
- Up to three validated proposals per turn. Only the Edge Function/service role writes proposal payloads and baselines.
- Explicit Apply/Save uses `apply_coach_action`; Discard is available on each draft. Applied proposals are idempotent.
- Drafts expire after 24 hours. Ingredient/equipment and goal changes invalidate existing drafts; daily plans also check day and saved-plan version, workout proposals check the active programme ID. Application runs atomically and preserves old programmes/history.
- Personal coach requests: 50 per account/UTC day, six app-wide per minute, one in-flight response per account. Failed requests count. Existing review/recipe-selection quotas remain separate. Token use is recorded; these are request limits, not a guaranteed currency budget.
- Owner-scoped RLS/read grants on settings, turns and actions; service-only reservation/completion RPCs. No browser insert/update grant on generated actions.
- Account export includes the new owned tables; account deletion cascades. No hidden model reasoning is stored or shown.

## Voice

Speech input uses browser `SpeechRecognition` / `webkitSpeechRecognition`, where available, with an explicit opt-in and a typed fallback. The browser may transmit audio to its recognition service. Transcripts are editable and require Send; dictation never directly applies actions. Stop/abort on navigation or when the page becomes hidden. Read aloud uses browser speech synthesis. Microphone permission is requested only after a user presses Speak.

## Verification

- `npm test --workspace web`: provider contract, validated meals/plans, unavailable foods/equipment, allergies, mixed/vegetarian preferences, bounded workouts, voice transcript/abort and existing app tests.
- `npm run build:web`.
- `supabase/tests/personal_coach.sql`: authenticated-role, transactional application/idempotency and history protection; all fixtures roll back.
- Browser: isolated synthetic coach fixture checks phone layout and draft → applied display. Separate real authenticated QA account checks the server-side owner gate and the public meal-selection provider connection. Do not enable permanent personal-coach access on QA accounts to test the paid feature.
