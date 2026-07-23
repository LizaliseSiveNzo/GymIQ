/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Trainer schedule — book and manage sessions with clients.
export default function CoachSchedule() {
  const { session, profile } = useAuth();
  const [appts, setAppts] = useState(null);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ client_id: '', date: '', time: '', duration_min: 60, note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showPast, setShowPast] = useState(false);

  async function load() {
    const { data } = await supabase.from('appointments')
      .select('*, client:client_id ( id, name )')
      .order('starts_at', { ascending: true });
    setAppts(data || []);
  }
  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { data: links } = await supabase.from('trainer_clients')
      .select('client:client_id ( id, name )').eq('status', 'active');
    setClients((links || []).map((r) => r.client).filter(Boolean));
    load();
  })(); }, [profile]);

  async function book(e) {
    e.preventDefault();
    setErr('');
    if (!form.client_id || !form.date || !form.time) { setErr('Pick a client, date and time.'); return; }
    setBusy(true);
    try {
      const starts_at = new Date(`${form.date}T${form.time}`).toISOString();
      const { error } = await supabase.from('appointments').insert({
        trainer_id: profile.id, client_id: form.client_id, starts_at,
        duration_min: parseInt(form.duration_min, 10) || 60, note: form.note.trim() || null,
      });
      if (error) { setErr(error.message); return; }
      setForm({ client_id: '', date: '', time: '', duration_min: 60, note: '' });
      load();
    } finally { setBusy(false); }
  }
  async function cancel(id) { await supabase.from('appointments').delete().eq('id', id); load(); }

  if (session?.demo) return <AppShell role="coach" active="Schedule" title="Schedule"><div className="card">Demo mode.</div></AppShell>;

  const now = Date.now();
  const upcoming = (appts || []).filter((a) => new Date(a.starts_at).getTime() >= now);
  const past = (appts || []).filter((a) => new Date(a.starts_at).getTime() < now).reverse();

  const Row = ({ a }) => (
    <div className="row between" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
      <div>
        <strong>{a.client?.name || 'Client'}</strong>
        <div className="subtle" style={{ fontSize: 12 }}>{fmt(a.starts_at)} · {a.duration_min} min{a.note ? ` · ${a.note}` : ''}</div>
      </div>
      <ConfirmButton className="btn btn-ghost" style={{ minHeight: 28 }} confirmLabel="Cancel?" onConfirm={() => cancel(a.id)}>Cancel</ConfirmButton>
    </div>
  );

  return (
    <AppShell role="coach" active="Schedule" title="Schedule">
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Book a session</h4>
        <form onSubmit={book}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <select className="select" style={{ minWidth: 170, flex: 1 }} value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">Choose client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input" style={{ width: 150 }} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="input" style={{ width: 120 }} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <input className="input" style={{ width: 90 }} type="number" placeholder="min" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
          </div>
          <input className="input" style={{ marginTop: 8 }} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy}>Book session</button>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
          {clients.length === 0 && <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0' }}>Add a client first to book sessions.</p>}
        </form>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Upcoming</h4>
        {appts === null ? <p className="subtle" style={{ margin: 0 }}>Loading…</p>
         : upcoming.length === 0 ? <p className="subtle" style={{ margin: 0 }}>Nothing booked yet.</p>
         : <div className="stack" style={{ gap: 8 }}>{upcoming.map((a) => <Row key={a.id} a={a} />)}</div>}

        {past.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setShowPast((v) => !v)}>{showPast ? 'Hide past' : `Show past (${past.length})`}</button>
            {showPast && <div className="stack" style={{ gap: 8, marginTop: 8, opacity: 0.7 }}>{past.map((a) => <Row key={a.id} a={a} />)}</div>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
