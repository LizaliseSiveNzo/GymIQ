/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO = [
  { id: 1, author_name: 'Thabo Mokoena', author_role: 'player', message: 'Tweaked my right ankle at training — a bit swollen today.', created_at: new Date(Date.now() - 2 * 86400e3).toISOString() },
  { id: 2, author_name: 'Coach Dlamini', author_role: 'coach', message: 'Rest it 3 days, ice 20 min x3/day, keep it elevated. No sprinting until it is pain-free. Update me Friday.', created_at: new Date(Date.now() - 86400e3).toISOString() },
];

// Two-way injury & recovery discussion between a player and their coach.
// Pass playerId for the coach view; omit it on the player's own profile (resolves self).
export default function InjuryThread({ playerId, title = 'Injury & Recovery' }) {
  const { profile, session } = useAuth();
  const [pid, setPid] = useState(playerId || null);
  const [items, setItems] = useState(session?.demo ? DEMO : []);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    let id = playerId;
    if (!id) { const { data } = await supabase.from('players').select('id').limit(1); id = data?.[0]?.id; }
    setPid(id);
    if (id) load(id);
  })(); }, [playerId]);

  async function load(id) {
    const { data } = await supabase.from('medical_notes').select('*').eq('player_id', id).order('created_at', { ascending: true });
    setItems(data || []);
  }

  async function post(e) {
    e.preventDefault();
    if (!msg.trim() || !pid) return;
    setErr(''); setBusy(true);
    try {
      const { error } = await supabase.from('medical_notes').insert({
        player_id: pid, author_id: profile.id, author_name: profile.name, author_role: profile.role, message: msg.trim(),
      });
      if (error) { setErr(error.message); return; }
      setMsg(''); load(pid);
    } finally { setBusy(false); }
  }

  const mine = (m) => m.author_id === profile?.id;

  return (
    <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0 }}>
      <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        🩹 {title}
      </strong>
      {items.length === 0
        ? <p className="subtle" style={{ margin: '10px 0 0' }}>No injury notes yet. Start a conversation about an injury and the steps to recover.</p>
        : (
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
            {items.map((m) => (
              <div key={m.id} style={{
                background: mine(m) ? 'var(--green-100)' : 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 10, padding: 10,
              }}>
                <div className="row between">
                  <strong style={{ fontSize: 13 }}>
                    {m.author_name || 'User'} <span className="badge badge-neutral" style={{ fontSize: 10 }}>{m.author_role}</span>
                  </strong>
                  <span className="subtle" style={{ fontSize: 11 }}>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>{m.message}</p>
              </div>
            ))}
          </div>
        )}
      {!session?.demo && (
        <form onSubmit={post} style={{ marginTop: 12 }}>
          <textarea className="input" rows={3} placeholder="Describe the injury, or reply with recovery steps…"
            value={msg} onChange={(e) => setMsg(e.target.value)} />
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy || !msg.trim()}>
            {busy ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </div>
  );
}
