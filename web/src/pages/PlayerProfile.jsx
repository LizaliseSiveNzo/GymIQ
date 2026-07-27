/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import WorkoutCalendar from '../components/WorkoutCalendar.jsx';
import ProgrammeBuilder from '../components/ProgrammeBuilder.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Client home — Calendar and My plan. Everything else lives on its own page in
// the menu (Log session, Progress, Nutrition, Form AI, Journal).
export default function PlayerProfile() {
  const { session, profile } = useAuth();
  const [tab, setTab] = useState('Calendar');

  if (session?.demo)
    return <AppShell role="player" active="Home" title="Home"><div className="card">Demo mode — sign in as a client to see your plan.</div></AppShell>;
  if (!profile) return <AppShell role="player" active="Home" title="Home"><div className="card">Loading…</div></AppShell>;

  const cid = profile.id;
  return (
    <AppShell role="player" active="Home" title="Home">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 18 }}>Hi, {profile.name?.split(' ')[0] || 'there'} 👋</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Plan your week on the calendar, and check your programme.</div>
        <div className="segmented" style={{ marginTop: 14 }}>
          {['Calendar', 'My plan'].map((t) => (
            <button key={t} type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'Calendar' && <WorkoutCalendar clientId={cid} />}
      {tab === 'My plan'  && <ProgrammeBuilder clientId={cid} />}
    </AppShell>
  );
}
