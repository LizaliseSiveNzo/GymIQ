/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ClientJournalPage() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Journal" title="Journal"><div className="card">Loading…</div></AppShell>;
  return <AppShell role="player" active="Journal" title="Journal"><MyJournal cid={profile.id} /></AppShell>;
}

function MyJournal({ cid }) {
  const [entries, setEntries] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('client_journal')
      .select('*').eq('client_id', cid).order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    setEntries(data || []);
  }
  useEffect(() => { load(); }, [cid]);

  async function add(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await supabase.from('client_journal').insert({ client_id: cid, body: body.trim() });
      setBody(''); load();
    } finally { setBusy(false); }
  }
  async function del(id) { await supabase.from('client_journal').delete().eq('id', id); load(); }

  return (
    <div className="stack">
      <div className="card">
        <h4 style={{ marginTop: 0 }}>Add a note</h4>
        <p className="subtle" style={{ fontSize: 12, marginTop: 0 }}>Jot down how you're feeling, cravings, energy, sleep — your trainer can see these.</p>
        <form onSubmit={add}>
          <textarea className="textarea" placeholder="What's on your mind today?" value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy || !body.trim()}>Save note</button>
        </form>
      </div>
      {entries === null ? <div className="card">Loading…</div>
       : entries.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No notes yet.</p></div>
       : entries.map((e) => (
        <div className="card" key={e.id}>
          <div className="row between">
            <span className="subtle" style={{ fontSize: 12 }}>{e.entry_date}</span>
            <button className="btn btn-ghost" style={{ minHeight: 26 }} onClick={() => del(e.id)}>Delete</button>
          </div>
          <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{e.body}</p>
        </div>
      ))}
    </div>
  );
}
