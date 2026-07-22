/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { initials } from '../lib/format.js';

export default function AdminCoaches() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  function load() { supabase.rpc('admin_coaches').then(({ data }) => setRows(data || [])); }
  useEffect(() => { load(); }, []);

  async function promote(e) {
    e.preventDefault(); setBusy(true); setMsg(''); setErr('');
    try {
      const { data, error } = await supabase.rpc('admin_set_role_by_email', { p_email: email, p_role: 'coach' });
      if (error) { setErr(error.message); return; }
      if (!data?.ok) { setErr(data?.error || 'Could not grant the coach role.'); return; }
      setMsg(`${data.name || email} is now a coach.`); setEmail(''); load();
    } finally { setBusy(false); }
  }

  return (
    <AppShell role="admin" active="Coaches" title="Coaches">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Grant coach access</h4></div>
        <p className="subtle" style={{ fontSize: 13, marginTop: 0 }}>
          Everyone who signs up starts as a player — nobody can make themselves a coach. Ask the coach to register,
          then enter their email here to upgrade them.
        </p>
        <form className="row" style={{ gap: 8, flexWrap: 'wrap' }} onSubmit={promote}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} type="email" placeholder="coach@academy.co.za"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !email.trim()}>{busy ? 'Granting…' : 'Make coach'}</button>
        </form>
        {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>

      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Coach directory</h4><span className="badge badge-neutral">{rows.length}</span></div>
        {rows.length === 0 ? <p className="subtle">No coaches yet.</p> : (
          <div className="stack" style={{ gap: 10 }}>
            {rows.map((c) => (
              <div key={c.coach_id} className="row between" style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap', gap: 10 }}>
                <Link to={`/admin/coach/${c.coach_id}`} className="row" style={{ minWidth: 220, color: 'inherit', textDecoration: 'none' }}>
                  <span className="avatar">{initials(c.name)}</span>
                  <div>
                    <strong style={{ textDecoration: 'underline' }}>{c.name}</strong>
                    <div className="subtle" style={{ fontSize: 12 }}>{c.email}</div>
                    <div className="subtle" style={{ fontSize: 12 }}>Joined {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</div>
                  </div>
                </Link>
                <div style={{ textAlign: 'right' }}>
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    <span className="badge badge-neutral">{c.team_count} team{c.team_count === 1 ? '' : 's'}</span>
                    <span className="badge badge-success">{c.player_count} players</span>
                  </div>
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{(c.teams && c.teams.length) ? c.teams.join(', ') : 'No teams'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
