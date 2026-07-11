/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const SPORTS = ['soccer', 'rugby', 'cricket', 'chess'];

export default function AdminSettings() {
  const { profile, session, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.org || '');
  const [sports, setSports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');

  useEffect(() => { if (session?.demo) { setSports(['soccer','rugby']); return; } (async () => {
    if (profile?.org_id) {
      const { data: org } = await supabase.from('organisations').select('name').eq('id', profile.org_id).single();
      if (org) setName(org.name);
    }
    const { data: teams } = await supabase.from('teams').select('sport');
    setSports([...new Set((teams || []).map((t) => t.sport))]);
  })(); }, []);

  async function saveOrg(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      const { error } = await supabase.from('organisations').update({ name }).eq('id', profile.org_id);
      if (error) { setErr(error.message); return; }
      await refreshProfile?.();
      setOk('Saved.');
    } finally { setBusy(false); }
  }

  const noOrg = !session?.demo && profile && !profile.org_id;

  return (
    <AppShell role="admin" active="Settings" title="Settings">
      {session?.demo && <div className="badge badge-success" style={{ marginBottom: 16 }}>Demo mode</div>}
      {noOrg && <div className="card" style={{ marginBottom: 16 }}>Create your academy on the Dashboard first.</div>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={saveOrg}>
          <h4>Academy</h4>
          <div className="field"><label className="label">Academy name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={noOrg} /></div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          {ok &&  <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{ok}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || noOrg || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
        </form>

        <div className="card">
          <h4>Sports</h4>
          <p className="subtle" style={{ marginTop: 0 }}>PitchIQ is multi-sport — each team picks its sport. Add a team in any sport to expand.</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {SPORTS.map((s) => (
              <span key={s} className={`badge ${sports.includes(s) ? 'badge-success' : 'badge-neutral'}`}>
                {s}{sports.includes(s) ? ' · active' : ''}
              </span>
            ))}
          </div>
          <p className="subtle" style={{ margin: 0, fontSize: 13 }}>Sports currently in use: {sports.length ? sports.join(', ') : 'none yet'}.</p>
        </div>
      </div>
    </AppShell>
  );
}
