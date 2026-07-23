/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../lib/format.js';

// Trainer home. Reads the fitness model only — no teams/matches.
export default function CoachDashboard() {
  const { session, profile } = useAuth();
  const [clients, setClients] = useState(null);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({ withProgramme: 0, loggedThisWeek: 0 });

  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { data: links } = await supabase
      .from('trainer_clients')
      .select('client:client_id ( id, name, email )')
      .eq('status', 'active');
    const cs = (links || []).map((r) => r.client).filter(Boolean);
    setClients(cs);
    const ids = cs.map((c) => c.id);
    if (ids.length === 0) { setRecent([]); return; }

    // recent logged sessions across all clients
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id, client_id, log_date, logged_sets(id)')
      .in('client_id', ids)
      .order('log_date', { ascending: false })
      .limit(8);
    const byId = Object.fromEntries(cs.map((c) => [c.id, c]));
    setRecent((logs || []).map((l) => ({ ...l, client: byId[l.client_id] })));

    // quick stats
    const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
    const [{ count: progCount }, { count: weekCount }] = await Promise.all([
      supabase.from('workout_programmes').select('client_id', { count: 'exact', head: true }).in('client_id', ids).eq('is_active', true),
      supabase.from('workout_logs').select('id', { count: 'exact', head: true }).in('client_id', ids).gte('log_date', weekAgo),
    ]);
    setStats({ withProgramme: progCount || 0, loggedThisWeek: weekCount || 0 });
  })(); }, [profile]);

  if (session?.demo) return <AppShell role="coach" active="Dashboard" title="Dashboard"><div className="card">Demo mode.</div></AppShell>;

  const name = profile?.name?.split(' ')[0] || 'there';
  return (
    <AppShell role="coach" active="Dashboard" title="Dashboard">
      <div className="card" style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 20 }}>Hi, {name} 👋</strong>
        <div className="subtle" style={{ fontSize: 13 }}>Here's how your clients are doing.</div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Active clients</div>
          <div className="kpi-value">{clients?.length ?? '—'}</div></div>
        <div className="kpi"><div className="kpi-label">On a programme</div>
          <div className="kpi-value">{stats.withProgramme}</div></div>
        <div className="kpi"><div className="kpi-label">Sessions this week</div>
          <div className="kpi-value">{stats.loggedThisWeek}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Recent client activity</h4>
          <Link to="/coach/squad" className="btn btn-ghost" style={{ minHeight: 30 }}>All clients</Link>
        </div>
        {clients === null ? <p className="subtle" style={{ margin: 0 }}>Loading…</p>
         : recent.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No sessions logged yet. Once your clients log a workout, it shows here.</p>
         : (
          <div className="stack" style={{ gap: 8 }}>
            {recent.map((l) => (
              <Link key={l.id} to={`/coach/player/${l.client_id}`}
                style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', display: 'block' }}>
                <div className="row between">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{initials(l.client?.name)}</span>
                    <div>
                      <strong>{l.client?.name || 'Client'}</strong>
                      <div className="subtle" style={{ fontSize: 12 }}>logged a session · {l.log_date}</div>
                    </div>
                  </div>
                  <span className="badge badge-neutral">{l.logged_sets?.length || 0} sets</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {clients && clients.length === 0 && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Add your first client</h4>
          <p className="subtle">Once a client signs up, add them by email to start building programmes and tracking progress.</p>
          <Link to="/coach/squad" className="btn btn-primary">Go to Clients</Link>
        </div>
      )}
    </AppShell>
  );
}
