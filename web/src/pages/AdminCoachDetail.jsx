/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import StatCard from '../components/StatCard.jsx';
import { supabase } from '../lib/supabaseClient.js';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

function Meta({ label, value }) {
  return <div><div className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</div><div style={{ fontWeight: 600 }}>{value ?? '—'}</div></div>;
}

export default function AdminCoachDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [anns, setAnns] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => { (async () => {
    const [{ data: dossier }, { data: a }, { data: u }] = await Promise.all([
      supabase.rpc('admin_coach_dossier', { p_coach_id: id }),
      supabase.rpc('admin_coach_announcements', { p_coach_id: id }),
      supabase.rpc('admin_coach_upcoming', { p_coach_id: id }),
    ]);
    setD(dossier || false); setAnns(a || []); setUpcoming(u || []);
  })(); }, [id]);

  if (d === null) return <AppShell role="admin" active="Coaches" title="Coach"><div className="card">Loading…</div></AppShell>;
  if (d === false) return <AppShell role="admin" active="Coaches" title="Coach"><div className="card">Coach not found. <Link to="/admin/coaches">Back</Link></div></AppShell>;

  return (
    <AppShell role="admin" active="Coaches" title={d.name || 'Coach'}>
      <div style={{ marginBottom: 12 }}><Link to="/admin/coaches" className="subtle">← Back to coaches</Link></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row"><span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(d.name)}</span>
          <div><h3 style={{ margin: 0 }}>{d.name}</h3><div className="subtle">{d.email}</div></div></div>
        <div className="grid grid-3" style={{ marginTop: 16, gap: 14 }}>
          <Meta label="Joined" value={fmtDate(d.joined)} />
          <Meta label="Teams" value={(d.teams && d.teams.length) ? d.teams.join(', ') : 'None'} />
          <Meta label="Players managed" value={d.player_count} />
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Teams" value={d.team_count} />
        <StatCard label="Players" value={d.player_count} />
        <StatCard label="Sessions logged" value={d.sessions} />
        <StatCard label="Matches logged" value={d.matches} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>📣 Announcements</h4><span className="badge badge-neutral">{anns.length}</span></div>
          {anns.length === 0 ? <p className="subtle">None posted.</p> : (
            <div className="stack" style={{ gap: 12 }}>
              {anns.map((a) => (
                <div key={a.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <strong>{a.title || a.file_name || 'Attachment'}</strong>
                  {a.body && <p style={{ margin: '4px 0 0' }}>{a.body}</p>}
                  {a.file_name && <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>📎 {a.file_name}</div>}
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{a.team_name} · {new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>📅 Upcoming</h4><span className="badge badge-neutral">{upcoming.length}</span></div>
          {upcoming.length === 0 ? <p className="subtle">Nothing scheduled.</p> : (
            <div className="stack" style={{ gap: 8 }}>
              {upcoming.map((e, i) => (
                <div key={i} className="row between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.kind === 'match' ? 'var(--energy)' : 'var(--success)' }} />
                    <span><strong>{e.title}</strong><span className="subtle" style={{ fontSize: 12 }}> · {e.team_name}</span></span>
                  </span>
                  <span className="subtle" style={{ fontSize: 12 }}>{new Date(e.when_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
