# GymIQ

Personal workout programmes and Calorie Bank. Workouts lead the experience; nutrition supports the same training journey.

React + Vite, Supabase Auth/Postgres/Edge Functions, Yoco hosted checkout, and Resend transactional email.

## Development

```powershell
npm install
npm run dev:web
npm run build:web
npm test --workspace web
```

The current frontend targets the GymIQ Supabase project. Use a separate project and update `web/src/lib/supabaseClient.js` before working against staging data.

## Membership

R100 for 30 days, renewed manually through Yoco. New customers receive a one-time 7-day trial. Access is confirmed by signed payment webhooks; the browser cannot write paid membership records.

## Release

Read [docs/LAUNCH.md](docs/LAUNCH.md) for deployed backend changes, required secrets, verification results and remaining release gates. Historical architecture and rebuild notes are retained in `docs/` as reference.

Copyright © 2026 Lizalise Nzo. Proprietary; see LICENSE.
