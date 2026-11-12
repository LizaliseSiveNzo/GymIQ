# GymIQ AI handover

**Last updated:** 11 November 2026 (Africa/Johannesburg)  
**Current release:** `0e6b820` — `Launch free logging, premium paywalls and owner access codes`  
**Production web app:** `https://www.gym-iq.co.za`  
**Repository:** `LizaliseSiveNzo/GymIQ`

This document is the starting point for an AI continuing work on GymIQ. It describes the live product and the most important implementation decisions. Do not place credentials, API keys, service-role keys or payment secrets in code, Git, browser-visible variables or chat.

## Product in one paragraph

GymIQ is a mobile-first personal fitness app. The main experience is **Workouts**, with **Calorie Bank** as the second main section. Users can build or follow programmes, log sets/weights/reps, track rest, view exercise records and progress, and log food. The product is now a freemium web/PWA: free users retain useful daily logging; premium users receive structured training, planning and advanced coaching features.

## Product access model

| Access | What it includes |
| --- | --- |
| Free | Freestyle workouts, set/rest timers, session recovery, exercise library, workout history and records, meal builder, manual food diary/favourites, and manual weight check-ins. |
| Premium | Personalised programmes and programme sessions, calorie goals, daily meal plans, barcode lookup, training analytics, progress story, weekly check-ins, and nutrition AI reviews. |
| Trial | A one-time 7-day premium trial for each new account. |
| Paid | R100 for 30 days through manual Yoco checkout. No automatic debit. |
| Invited | Owner-issued access code grants time-limited premium access without recording revenue. |
| Owner | Server-managed owner access, independent of the owner’s customer membership. |

Important rules:

- Premium expiry must **never** remove a user’s saved records or block free logging.
- An in-progress workout must be resumable and finishable even if premium access expires mid-session.
- Payment extensions start after the later of current paid/trial/invited expiry.
- An access code does not grant owner/admin rights or the separate Personal AI Coach pilot.

## Main frontend areas

| Area | Route | Main files |
| --- | --- | --- |
| Workout home | `/workout` | `web/src/pages/mf/WorkoutTab.jsx` |
| Session player | `/workout/session/free`, `/workout/session/:dayId` | `web/src/pages/mf/SessionPlayer.jsx` |
| Food / Calorie Bank | `/bank` | `web/src/pages/mf/BankTab.jsx`, `web/src/components/NutritionHub.jsx` |
| Account and billing | `/more` | `web/src/pages/mf/MoreMenu.jsx` |
| Owner dashboard | `/owner` | `web/src/pages/mf/OwnerDashboard.jsx` |
| Personal coach pilot | `/coach` | `web/src/pages/mf/PersonalCoach.jsx` |
| Routes and premium route gate | all routes | `web/src/App.jsx`, `web/src/routes/ProtectedRoute.jsx` |
| Membership caching / checks | all signed-in views | `web/src/hooks/useMembership.js`, `web/src/lib/membership.js`, `web/src/lib/premium.js` |

The web application uses React 18, Vite, React Router and Supabase JS. All main routes are lazy-loaded. The PWA/service-worker and device snapshots are deliberate performance features; do not make authentication, payments or AI responses cacheable.

## Backend and security model

Supabase project reference: `brnshmmsyfitmotauaud`.

The app has no separate traditional API server. It uses:

- Supabase Auth for accounts.
- Postgres with row-level security for user-owned data.
- Postgres RPCs for sensitive/atomic actions.
- Supabase Edge Functions for third-party integrations and privileged workflows.

Keep authorization server-side. The browser must not be trusted to decide premium, owner or AI access. Do not grant broad access to the Auth schema, expose service keys, or use editable user metadata as an authorization signal.

### Entitlements

- `memberships` stores trial/paid expiry.
- `owner_dashboard_access` is the owner allowlist.
- `premium_access_codes` stores **only SHA-256 code hashes** plus safe metadata.
- `premium_access_grants` links a redeemed code to a user and its premium expiry.
- `ensure_membership()` returns a UI membership snapshot, including virtual `owner`, `invite` and `free` states.
- `has_active_membership()` is the server authority for premium operations.
- The `premium_programme_session` trigger blocks direct starts of new programme sessions by free users.

Key migrations:

- `20261106100150_owner_app_access.sql`
- `20261106111952_premium_access_codes_and_free_tier.sql`
- `20261106114136_free_session_plan_and_set_undo.sql`

Do not loosen RLS simply to fix a screen. Free logging was intentionally enabled only for user-owned core logs; programme creation and other premium actions remain server-enforced.

## Access-code operation

The owner creates codes at **Account → Owner dashboard → Premium access codes**. Each code can set:

- label;
- premium duration: 1–365 days;
- maximum redemptions: 1–100;
- redemption deadline: 1–90 days;
- optional recipient email restriction.

The full code is shown once. The dashboard only retains a four-character hint. Recipients redeem at Account or a premium paywall. Codes are server-generated, rate-limited to ten attempts per account per hour, idempotent per recipient and revocable. Revoking a code removes the premium access that code granted but does not cancel separately paid access.

Relevant code:

- `supabase/functions/premium-access/index.ts`
- `supabase/functions/owner-dashboard/index.ts`
- `supabase/functions/_shared/accessCodes.ts`
- `web/src/components/ui/OwnerAccessCodes.jsx`
- `web/src/components/ui/PremiumPaywall.jsx`
- `docs/premium-access.md`

## Payments, email and external services

| Service | Use | Configuration / notes |
| --- | --- | --- |
| Yoco | Hosted manual R100 checkout and signed payment webhooks | Edge functions: `yoco-checkout`, `yoco-webhook`. Never treat a redirect as proof of payment. |
| DeepSeek | Personal Coach and selected AI features | Server secret `DEEPSEEK_API_KEY`; see `docs/DEEPSEEK_COACH.md`. |
| Resend | Transactional/support email | Server secrets only. Support recipient is `Lizalisenzo@gmail.com`. |
| Vercel | Production hosting and analytics | Production domain is `www.gym-iq.co.za`. |
| Supabase | Auth, Postgres, storage and Edge Functions | Project ref above. |

Expected Edge Function secrets include `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`, `GYMIQ_APP_URL`, `RESEND_API_KEY`, `GYMIQ_EMAIL_FROM` and `DEEPSEEK_API_KEY`. Their values must never be committed or repeated in documentation.

## AI boundaries

- The Personal Coach is a controlled pilot, not a general entitlement. It has a separate server allowlist (`personal_coach_access`).
- AI creates proposals/drafts; it does not directly write arbitrary historical data or execute raw SQL.
- Speech input is browser speech recognition with explicit user action; read-aloud is browser speech synthesis.
- Nutrition calculations, food validation and safety guards remain inside GymIQ. AI is not the source of truth for calorie arithmetic.
- The normal meal-plan experience should default to mixed, high-protein meals. Vegetarian/vegan plans should only appear when a user has explicitly selected that preference.

Read `docs/DEEPSEEK_COACH.md`, `docs/MEAL_PLANNING.md` and `docs/MICROSOFT_SPEECH.md` before changing these areas.

## Data, workout and nutrition behaviour

- Workout timers use active elapsed time and should not pause merely because the app/background state changes; explicit pause remains available.
- Rest timer default is 90 seconds and uses a short, noticeable bell.
- Workout recovery persists unfinished logs and prompts a returning user to resume.
- Set entry must be robust: local queueing, sync receipts/idempotency, set undo, editable inputs and recovery are intentional safeguards.
- Previous-session weights/reps populate exercise defaults to support progressive overload.
- The nutrition catalogue contains 52 curated USDA generic foods, including added meat sources. It is not a source for exact branded-product nutrition; use packaging/barcode data when appropriate.
- Food logs are dated intake records, not a “calorie debt” system. Avoid punitive fasting/compensation messaging.

## Owner dashboard and customer data

The owner dashboard is available only after the Edge Function confirms that the signed-in user appears in the server-managed owner registry. It reports limited business data such as sign-ups, activity, paid membership/revenue and referrals. It intentionally does not expose raw meals, weights, detailed sets or chat messages.

Business totals exclude the owner, marked test accounts and known mock history. Read `docs/OWNER_DASHBOARD.md` before changing dashboard metrics, privacy behaviour or owner permissions.

## Development and verification

From the repository root:

```powershell
npm run dev:web
npm run build:web
npm test --workspace web
```

Direct web equivalents:

```powershell
npm --prefix web run dev
npm --prefix web run build
npm --prefix web test
```

Current release verification included 263 frontend tests plus transaction-scoped SQL tests. Useful SQL checks:

- `scripts/verification/premium-access.sql`
- `scripts/verification/owner-app-access.sql`
- `scripts/verification/owner-dashboard.sql`

Run migrations through the normal Supabase migration workflow. Do not manually edit an already-applied migration; add a new timestamped migration instead.

## Release workflow

1. Make a focused change and preserve unrelated untracked `artifacts/` files.
2. Run relevant unit tests and `npm --prefix web run build`.
3. For database/access changes, add or update rollback-only SQL verification.
4. Deploy changed Edge Functions with JWT verification when appropriate.
5. Apply migrations before deploying frontend code that depends on them.
6. Publish the tested commit to `main`; Vercel deploys production.
7. Check the production build and service worker after deployment, especially for auth, payments, session save/finish and offline changes.

## Documentation map

Start here, then use the focused documents rather than guessing:

- `docs/premium-access.md` — current free/premium and access code rules.
- `docs/LAUNCH.md` — Yoco, email and broader launch context; some earlier wording predates freemium, so prefer `premium-access.md` for current entitlement behaviour.
- `docs/OFFLINE_STARTUP.md` — PWA cache, account-scoped device snapshots and offline constraints.
- `docs/WORKOUT_RECOVERY.md` — reopening unfinished sessions safely.
- `docs/RELIABLE_SET_ENTRY.md` — logging/queue safeguards.
- `docs/WORKOUT_WEEKS.md`, `docs/PROGRESSION_COACH.md`, `docs/TRAINING_ANALYTICS.md`, `docs/PROGRESS_STORY.md`, `docs/WEEKLY_CHECK_IN.md` — training features.
- `docs/MEAL_PLANNING.md`, `docs/DEEPSEEK_COACH.md` — nutrition and AI features.
- `docs/OWNER_DASHBOARD.md` — business reporting and owner controls.

`docs/ARCHITECTURE.md` retains old academy-era material and is **not** a reliable description of the current GymIQ product. Do not revive those roles/routes unless the owner explicitly asks.

## Current priorities and cautions

- GymIQ is launch-oriented and personal-use-first. Favour reliability in workouts, nutrition logging and payments over feature breadth.
- The product should feel polished and simple on a phone. Keep Training uncluttered, using menus for secondary tools.
- Keep existing exercise illustrations local and on-demand; do not make them block the workout flow.
- Maintain privacy boundaries around customer data, AI context and owner reporting.
- Do not generate mock data in a real customer account without explicit instruction; historical fixtures must be clearly marked and excluded from business metrics.
- Do not include or reuse old exposed credentials. Rotate a credential if it is ever pasted into chat or committed.

