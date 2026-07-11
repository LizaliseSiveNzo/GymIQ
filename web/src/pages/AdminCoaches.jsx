/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function AdminCoaches() {
  const [rows, setRows] = useState([]);
  useEffect(() => { supabase.rpc('admin_coaches').then(({ data }) => setRows(data || [])); }, []);
  return (
    <AppShell role="admin" active="Coaches" title="Coaches">
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
