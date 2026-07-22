# GymIQ — Web (React + Vite)

Dark theme, green accent (#00e676), mobile-responsive.

## Run
```bash
cp .env.example .env   # fill in Supabase URL + anon key + API URL
npm install
npm run dev            # http://localhost:5173
```

## Structure
- `src/context/AuthContext.jsx` — session + profile/role
- `src/routes/ProtectedRoute.jsx` — role-gated routes
- `src/lib/` — `supabaseClient`, `api` fetch wrapper
- `src/pages/` — Login, Admin/Coach/Parent dashboards, PlayerProfile, TrialRegister
- `src/components/` — RankBadge, StatCard, Placeholder
- `src/theme.js` / `src/styles/global.css` — design tokens
