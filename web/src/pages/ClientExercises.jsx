/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import AppShell from '../components/AppShell.jsx';
import BlockLibrary from '../components/BlockLibrary.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ClientExercises() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Exercises" title="Exercises"><div className="card">Loading…</div></AppShell>;
  return (
    <AppShell role="player" active="Exercises" title="Exercises">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Your workout blocks</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Build blocks like Legs, Push or Arms and fill them with exercises. Then add them to any day on your calendar.</div>
      </div>
      <BlockLibrary clientId={profile.id} />
    </AppShell>
  );
}
