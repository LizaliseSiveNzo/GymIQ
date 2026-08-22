/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import WorkoutCalendar from '../components/WorkoutCalendar.jsx';
import ProgrammeBuilder from '../components/ProgrammeBuilder.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = (iso) => new Date(iso).toLocaleString(undefined, {
  weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

// Schedule — plan your training. The workout calendar hub lives here (moved off
// Home). Upcoming trainer sessions show underneath (empty until coaching returns).
export default function ScheduleView() {
  const { session, profile, role } = useAuth();
  const [tab, setTab] = useState('Calendar');
  const [appts, setAppts] = useState(null);

  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { data } = await supabase.from('appointments')
      .select('*, trainer:trainer_id ( name )')
      .order('starts_at', { ascending: true });
    setAppts(data || []);
  })(); }, [profile]);

  const shellRole = role === 'coach' ? 'coach' : 'player';
  if (session?.demo) return <AppShell role={shellRole} active="Schedule" title="Schedule"><div className="card">Demo mode.</div></AppShell>;
  if (!profile) return <AppShell role={shellRole} active="Schedule" title="Schedule"><div className="card">Loading…</div></AppShell>;

  const now = Date.now();
  const upcoming = (appts || []).filter((a) => new Date(a.starts_at).getTime() >= now);

  return (
    <AppShell role={shellRole} active="Schedule" title="Schedule">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 18 }}>Your schedule</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Plan your week on the calendar and check your programme.</div>
        <div className="segmented" style={{ marginTop: 14 }}>
          {['Calendar', 'My plan'].map((t) => (
            <button key={t} type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'Calendar' && <WorkoutCalendar clientId={profile.id} />}
      {tab === 'My plan'  && <ProgrammeBuilder clientId={profile.id} />}

      {upcoming.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 20 }}><h4 style={{ margin: 0 }}>Upcoming sessions</h4></div>
          <div className="stack" style={{ gap: 10 }}>
            {upcoming.map((a) => (
              <div className="card" key={a.id}>
                <strong>{fmt(a.starts_at)}</strong>
                <div className="subtle" style={{ fontSize: 13, marginTop: 2 }}>
                  {a.duration_min} min{a.trainer?.name ? ` · with ${a.trainer.name}` : ''}{a.note ? ` · ${a.note}` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
