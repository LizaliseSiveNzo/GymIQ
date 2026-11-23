/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import AppShell from '../components/AppShell.jsx';
import CalorieBank from '../components/CalorieBank.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Home — the Calorie Bank is the heart of GymIQ. Your balance + monthly ring
// sit front and centre; the calendar/plan live on the Schedule page.
export default function PlayerProfile() {
  const { session, profile } = useAuth();

  if (session?.demo)
    return <AppShell role="player" active="Home" title="Home"><div className="card">Demo mode — sign in to see your bank.</div></AppShell>;
  if (!profile) return <AppShell role="player" active="Home" title="Home"><div className="card">Loading…</div></AppShell>;

  return (
    <AppShell role="player" active="Home" title="Home">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 18 }}>Hi, {profile.name?.split(' ')[0] || 'there'} 👋</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Here's your calorie bank for the month.</div>
      </div>
      <CalorieBank clientId={profile.id} />
    </AppShell>
  );
}
