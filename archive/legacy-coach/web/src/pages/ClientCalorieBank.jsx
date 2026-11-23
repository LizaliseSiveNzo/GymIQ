/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import AppShell from '../components/AppShell.jsx';
import CalorieBank from '../components/CalorieBank.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ClientCalorieBank() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Calorie Bank" title="Calorie Bank"><div className="card">Loading…</div></AppShell>;
  return (
    <AppShell role="player" active="Calorie Bank" title="Calorie Bank">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Your Calorie Bank</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Bank calories each month, spend them on food, and earn them back with exercise. Your balance rolls over.</div>
      </div>
      <CalorieBank clientId={profile.id} />
    </AppShell>
  );
}
