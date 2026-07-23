/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

// Trainer posts announcements; all their active clients see them.
export default function CoachAnnouncements() {
  const { session, profile } = useAuth();
  const [posts, setPosts] = useState(null);
  const [clientCount, setClientCount] = useState(0);
  const [form, setForm] = useState({ title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase.from('trainer_announcements')
      .select('*').order('created_at', { ascending: false });
    setPosts(data || []);
  }
  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { count } = await supabase.from('trainer_clients')
      .select('id', { count: 'exact', head: true }).eq('status', 'active');
    setClientCount(count || 0);
    load();
  })(); }, [profile]);

  async function post(e) {
    e.preventDefault();
    setErr('');
    if (!form.body.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('trainer_announcements').insert({
        trainer_id: profile.id, title: form.title.trim() || null, body: form.body.trim(),
      });
      if (error) { setErr(error.message); return; }
      setForm({ title: '', body: '' });
      load();
    } finally { setBusy(false); }
  }
  async function remove(id) { await supabase.from('trainer_announcements').delete().eq('id', id); load(); }

  if (session?.demo) return <AppShell role="coach" active="Announcements" title="Announcements"><div className="card">Demo mode.</div></AppShell>;

  return (
    <AppShell role="coach" active="Announcements" title="Announcements">
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Post to your clients</h4>
        <form onSubmit={post}>
          <input className="input" placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="textarea" style={{ marginTop: 8 }} placeholder="Your message…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="row between" style={{ marginTop: 8 }}>
            <span className="subtle" style={{ fontSize: 12 }}>Goes to all {clientCount} active client{clientCount === 1 ? '' : 's'}.</span>
            <button className="btn btn-primary" disabled={busy || !form.body.trim()}>Post</button>
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
        </form>
      </div>

      {posts === null ? <div className="card">Loading…</div>
       : posts.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No announcements yet.</p></div>
       : (
        <div className="stack">
          {posts.map((p) => (
            <div className="card" key={p.id}>
              <div className="row between">
                <div>
                  {p.title && <strong>{p.title}</strong>}
                  <div className="subtle" style={{ fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <ConfirmButton className="btn btn-ghost" style={{ minHeight: 28 }} onConfirm={() => remove(p.id)} />
              </div>
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
