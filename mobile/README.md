# GymIQ — Mobile (React Native)

Coaches log training/matches on a phone; parents & players check in on the go.
Placeholder structure — scaffold with Expo when Phase 4 (notifications) begins.

## Suggested init
```bash
npx create-expo-app@latest . --template
```

## Structure (planned)
- `src/screens/` — Login, CoachLog, PlayerProfile, ParentView, TrialScan
- `src/navigation/` — role-based stack/tab navigators
- `src/components/` — shared UI (RankBadge, StatCard)
- `src/lib/` — supabaseClient, api wrapper (mirror the web app)

Push notifications: Expo Notifications for fixtures/lineups (Blueprint module 3).
