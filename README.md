# GymIQ

**Sports academy management platform** — track players, communicate with parents, manage trials, and measure performance. Soccer first, then rugby, cricket, chess. One subscription per school.

Built with React, Node.js, Supabase, and the Claude API. _Built with Claude · RevidArch._

## Monorepo layout

```
gymiq/
├── backend/    Node.js + Express REST API (Supabase + Claude API)
├── web/        React (Vite) web app — dark theme, green accent (#00e676)
├── mobile/     React Native (Expo) — placeholder for Phase 4+
├── supabase/   SQL migrations (13 tables + RLS policies)
└── docs/       Architecture notes
```

## User roles

| Role | Access |
|------|--------|
| **Admin** | Full access · manage all teams · view all players · export reports · invite coaches |
| **Coach** | Own team · log training · rate players · notes & diet plans · mark bench reasons |
| **Parent** | Own child only · stats, comments, upcoming games, bench reasons, diet plan |
| **Player** | Own profile · rank/level · training history · upcoming fixtures |

## Core modules

Player profiles · stats & attendance tracker · match/training schedule with push notifications · level/rank system (Rookie → Rising Star → Elite → Master → Grand Master) · QR trial management · coach–parent messaging · team leaderboards · multi-sport expansion.

## Getting started

```bash
# 1. Database — create a free project at https://supabase.com,
#    then run supabase/migrations/0001_initial_schema.sql in the SQL editor.

# 2. Backend
cd backend && cp .env.example .env   # add Supabase + Anthropic keys
npm install && npm run dev           # http://localhost:4000

# 3. Web
cd web && cp .env.example .env        # add Supabase URL + anon key
npm install && npm run dev            # http://localhost:5173
```

## Tech stack

React · React Native · Node.js/Express · Supabase (DB + auth + storage) · Claude API (`claude-sonnet-4-6`) · Vercel/Railway hosting.

## Build sequence

1. Auth system 2. Player profiles 3. Stats logging 4. Schedule + notifications 5. Ranking 6. Trial QR check-in 7. AI coach summaries 8. Multi-sport expansion

See `docs/ARCHITECTURE.md` and `GymIQ_Blueprint.pdf` for full detail.
