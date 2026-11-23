/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { initials } from '../lib/format.js';

// Trainer's client list. Reads trainer_clients joined to the client's user row.
export default function CoachSquad() {
  const { session } = useAuth();
  const [clients, setClients] = useState(null);
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const { data, error } = await supabase
      .from('trainer_clients')
      .select('status, client:client_id ( id, name, email )')
      .eq('status', 'active');
    if (error) { setErr(error.message); setClients([]); return; }
    setClients((data || []).map((r) => r.client).filter(Boolean));
  }

  useEffect(() => { if (!session?.demo) load(); }, []);

  async function addClient(e) {
    e.preventDefault();
    setBusy(true); setMsg(''); setErr('');
    try {
      const { data, error } = await supabase.rpc('trainer_add_client_by_email', { p_email: email.trim() });
      if (error) { setErr(error.message); return; }
      if (!data?.ok) { setErr(data?.error || 'Could not add client.'); return; }
      setMsg(`${data.name} added.`);
      setEmail('');
      load();
    } finally { setBusy(false); }
  }

  if (session?.demo)
    return <AppShell role="coach" active="Clients" title="Clients"><div className="card">Demo mode — sign in as a trainer to see your clients.</div></AppShell>;

  const list = (clients || []).filter((c) =>
    (c.name || '').toLowerCase().includes(q.trim().toLowerCase()) ||
    (c.email || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <AppShell role="coach" active="Clients" title="Clients">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Add a client</h4>
          <span className="badge badge-neutral">{clients?.length ?? 0} active</span>
        </div>
        <form onSubmit={addClient} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 220 }} type="email"
            placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !email.trim()}>{busy ? 'Adding…' : 'Add client'}</button>
        </form>
        <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0' }}>
          The client signs up as a Client first, then you add them by their email.
        </p>
        {msg && <p style={{ color: 'var(--success)', fontSize: 13, margin: '8px 0 0' }}>{msg}</p>}
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ margin: 0 }}>Your clients</h4>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Search…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {clients === null ? <p className="subtle" style={{ margin: 0 }}>Loading…</p>
         : clients.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No clients yet. Add one above once they've created a Client account.</p>
         : list.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No clients match “{q}”.</p>
         : (
          <div className="stack" style={{ gap: 8 }}>
            {list.map((c) => (
              <Link key={c.id} to={`/coach/player/${c.id}`}
                style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'block' }}>
                <div className="row between">
                  <div className="row" style={{ gap: 12 }}>
                    <span className="avatar">{initials(c.name)}</span>
                    <div>
                      <strong>{c.name}</strong>
                      <div className="subtle" style={{ fontSize: 12 }}>{c.email}</div>
                    </div>
                  </div>
                  <span className="subtle" style={{ fontSize: 18 }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
