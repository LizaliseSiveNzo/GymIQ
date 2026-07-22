# GymIQ — Architecture

Monorepo (npm workspaces).

```
gymiq/
├── web/        React (Vite) — admin/coach/player + public trial page
├── supabase/   SQL migrations (schema + RLS) + edge functions
├── mobile/     React Native (Expo) — placeholder (web app is mobile-optimized; PWA planned)
└── docs/
```

The app talks directly to Supabase (auth + Postgres with RLS + edge functions).
There is no separate API server: authorization is enforced by RLS policies and
SECURITY DEFINER RPCs. Emails are sent by the `email-dispatch` edge function,
triggered automatically (pg_net) whenever notifications are inserted.

## Roles & access
| Role   | Scope                                                                          |
|--------|--------------------------------------------------------------------------------|
| Admin  | Full access, all teams/players, export, invite coaches                         |
| Coach  | Own team: schedule, announcements, ratings, notes, meal plans, bench, RSVPs    |
| Player | Own profile: rank, coach notes, meal plan, schedule + RSVP, announcements      |

Parents do NOT have their own role/profile — they sign in with their child's
Player account (shared family login). The old `parent` role was retired in
migration 0012; any legacy parent accounts were converted to `player`.

Access is enforced by Supabase RLS + security-definer RPCs.

## Build sequence (from blueprint)
1. Auth  2. Player profiles  3. Stats logging  4. Schedule + notifications
5. Ranking  6. Trial QR check-in  7. AI coach summaries  8. Multi-sport
