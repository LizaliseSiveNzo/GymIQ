/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function AdminBroadcast() {
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');

  async function send(e) {
    e.preventDefault(); setBusy(true); setOk(''); setErr('');
    try {
      const { data, error } = await supabase.rpc('admin_broadcast', { p_audience: audience, p_title: title, p_message: message });
      if (error) { setErr(error.message); return; }
      setOk(`Sent to ${data} ${data === 1 ? 'person' : 'people'}.`);
      setTitle(''); setMessage('');
    } finally { setBusy(false); }
  }

  const who = audience === 'players' ? 'all players' : audience === 'coaches' ? 'all coaches' : 'all players & coaches';

  return (
    <AppShell role="admin" active="Broadcast" title="Send Announcement">
      <div className="container" style={{ maxWidth: 560, padding: 0 }}>
        <form className="card" onSubmit={send}>
          <h4 style={{ marginTop: 0 }}>Bulk announcement</h4>
          <p className="subtle" style={{ marginTop: 0 }}>Sends an in-app notification to everyone in the selected audience.</p>
          <div className="field"><label className="label">Send to</label>
            <select className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">Everyone (players &amp; coaches)</option>
              <option value="players">Players only</option>
              <option value="coaches">Coaches only</option>
            </select></div>
          <div className="field"><label className="label">Title (optional)</label>
            <input className="input" placeholder="e.g. Kit collection this Friday" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label className="label">Message</label>
            <textarea className="textarea" rows={4} placeholder="Write your announcement…" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          {ok && <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{ok}</p>}
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !message.trim()}>{busy ? 'Sending…' : `Send to ${who}`}</button>
        </form>
      </div>
    </AppShell>
  );
}
