/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = (iso) => new Date(iso).toLocaleString(undefined, {
  weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

// Client's schedule — their upcoming sessions with their trainer.
export default function ScheduleView() {
  const { session, profile, role } = useAuth();
  const [appts, setAppts] = useState(null);

  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { data } = await supabase.from('appointments')
      .select('*, trainer:trainer_id ( name )')
      .order('starts_at', { ascending: true });
    setAppts(data || []);
  })(); }, [profile]);

  const shellRole = role === 'coach' ? 'coach' : 'player';
  if (session?.demo) return <AppShell role={shellRole} active="Schedule" title="Schedule"><div className="card">Demo mode.</div></AppShell>;

  const now = Date.now();
  const upcoming = (appts || []).filter((a) => new Date(a.starts_at).getTime() >= now);

  return (
    <AppShell role={shellRole} active="Schedule" title="Schedule">
      <div className="section-header"><h4 style={{ margin: 0 }}>Upcoming sessions</h4></div>
      {appts === null ? <div className="card"><p className="subtle" style={{ margin: 0 }}>Loading…</p></div>
       : upcoming.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No sessions booked. Your trainer will schedule these.</p></div>
       : (
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
      )}
    </AppShell>
  );
}
