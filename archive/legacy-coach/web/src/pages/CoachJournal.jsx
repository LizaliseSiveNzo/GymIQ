/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

// Trainer's private journal. Optional link to one of their clients.
export default function CoachJournal() {
  const { session, profile } = useAuth();
  const [entries, setEntries] = useState(null);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', client_id: '', entry_date: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  async function load() {
    const { data } = await supabase.from('journal_entries')
      .select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    setEntries(data || []);
  }
  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { data: links } = await supabase.from('trainer_clients')
      .select('client:client_id ( id, name )').eq('status', 'active');
    setClients((links || []).map((r) => r.client).filter(Boolean));
    load();
  })(); }, [profile]);

  async function add(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await supabase.from('journal_entries').insert({
        trainer_id: profile.id,
        client_id: form.client_id || null,
        entry_date: form.entry_date,
        title: form.title.trim(),
        body: form.body.trim() || null,
      });
      setForm({ title: '', body: '', client_id: '', entry_date: new Date().toISOString().slice(0, 10) });
      load();
    } finally { setBusy(false); }
  }
  async function remove(id) { await supabase.from('journal_entries').delete().eq('id', id); load(); }

  if (session?.demo) return <AppShell role="coach" active="Journal" title="Journal"><div className="card">Demo mode.</div></AppShell>;

  const nameOf = (id) => clients.find((c) => c.id === id)?.name;
  const shown = (entries || []).filter((e) => filter === 'all' || e.client_id === filter);

  return (
    <AppShell role="coach" active="Journal" title="Journal">
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>New entry</h4>
        <form onSubmit={add}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 2, minWidth: 200 }} placeholder="Title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input" style={{ width: 150 }} type="date" value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
            <select className="select" style={{ width: 180 }} value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">No client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <textarea className="textarea" style={{ marginTop: 8 }} placeholder="Notes (optional)" value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy || !form.title.trim()}>Save entry</button>
        </form>
      </div>

      {clients.length > 0 && (
        <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${filter === 'all' ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer' }} onClick={() => setFilter('all')}>All</span>
          {clients.map((c) => (
            <span key={c.id} className={`badge ${filter === c.id ? 'badge-info' : 'badge-neutral'}`} style={{ cursor: 'pointer' }} onClick={() => setFilter(c.id)}>{c.name}</span>
          ))}
        </div>
      )}

      {entries === null ? <div className="card">Loading…</div>
       : shown.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No entries yet.</p></div>
       : (
        <div className="stack">
          {shown.map((e) => (
            <div className="card" key={e.id}>
              <div className="row between">
                <div>
                  <strong>{e.title}</strong>
                  <div className="subtle" style={{ fontSize: 12 }}>
                    {e.entry_date}{e.client_id && nameOf(e.client_id) ? ` · ${nameOf(e.client_id)}` : ''}
                  </div>
                </div>
                <ConfirmButton className="btn btn-ghost" style={{ minHeight: 28 }} onConfirm={() => remove(e.id)} />
              </div>
              {e.body && <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{e.body}</p>}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
