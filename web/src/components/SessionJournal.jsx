/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Coaching journal for one training session (item 10):
// objectives, exercises, observations, reflection + standout players.
export default function SessionJournal({ sessionId, players = [] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ objectives: '', exercises: '', observations: '', reflection: '' });
  const [standouts, setStandouts] = useState([]);   // [{player_id, reason}]
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { if (open && !loaded) load(); /* eslint-disable-next-line */ }, [open, sessionId]);
  useEffect(() => { setLoaded(false); setOpen(false); }, [sessionId]);

  async function load() {
    const [{ data: s }, { data: so }] = await Promise.all([
      supabase.from('training_sessions').select('objectives,exercises,observations,reflection').eq('id', sessionId).single(),
      supabase.from('training_standouts').select('player_id,reason').eq('session_id', sessionId),
    ]);
    setF({ objectives: s?.objectives || '', exercises: s?.exercises || '', observations: s?.observations || '', reflection: s?.reflection || '' });
    setStandouts(so || []);
    setLoaded(true);
  }

  async function save() {
    setBusy(true); setMsg('');
    try {
      const { error } = await supabase.from('training_sessions').update({
        objectives: f.objectives.trim() || null,
        exercises: f.exercises.trim() || null,
        observations: f.observations.trim() || null,
        reflection: f.reflection.trim() || null,
      }).eq('id', sessionId);
      if (error) { setMsg(error.message); return; }
      setMsg('Session journal saved.');
    } finally { setBusy(false); }
  }

  async function toggleStandout(playerId) {
    const has = standouts.some((s) => s.player_id === playerId);
    if (has) {
      setStandouts((l) => l.filter((s) => s.player_id !== playerId));
      await supabase.from('training_standouts').delete().eq('session_id', sessionId).eq('player_id', playerId);
    } else {
      setStandouts((l) => [...l, { player_id: playerId, reason: null }]);
      await supabase.from('training_standouts').insert({ session_id: sessionId, player_id: playerId });
    }
  }

  if (!sessionId || sessionId === 'new') return null;

  return (
    <div className="card" style={{ marginBottom: 16, background: 'var(--surface-2)', border: 0 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
        <div className="row between" style={{ width: '100%' }}>
          <strong>📓 Session detail &amp; coaching journal</strong>
          <span className="subtle">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {!loaded ? <p className="subtle" style={{ margin: 0 }}>Loading…</p> : (
            <>
              <div className="field" style={{ marginTop: 0 }}><label className="label">🎯 Session objectives</label>
                <textarea className="textarea" rows={2} placeholder="What is this session meant to achieve?"
                  value={f.objectives} onChange={(e) => set('objectives', e.target.value)} /></div>

              <div className="field"><label className="label">🏋️ Exercises &amp; drills</label>
                <textarea className="textarea" rows={3} placeholder={'e.g.\nRondo 6v2 — 15 min\nFinishing from cut-backs — 20 min'}
                  value={f.exercises} onChange={(e) => set('exercises', e.target.value)} /></div>

              <div className="field"><label className="label">👀 Key observations</label>
                <textarea className="textarea" rows={2} placeholder="What did you notice about the group?"
                  value={f.observations} onChange={(e) => set('observations', e.target.value)} /></div>

              <div className="field"><label className="label">⭐ Players who stood out</label>
                <p className="subtle" style={{ fontSize: 12, margin: '0 0 6px' }}>Tap to mark — this shows on the player’s profile.</p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {players.length === 0 ? <span className="subtle" style={{ fontSize: 13 }}>No players on this team.</span>
                   : players.map((p) => {
                    const on = standouts.some((s) => s.player_id === p.id);
                    return (
                      <button type="button" key={p.id} onClick={() => toggleStandout(p.id)} className="badge"
                        style={{ cursor: 'pointer', background: on ? 'var(--green-600)' : 'transparent',
                          color: on ? '#fff' : 'inherit', border: `1px solid ${on ? 'var(--green-600)' : 'var(--border)'}` }}>
                        {on ? '⭐ ' : ''}{p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field"><label className="label">💭 Coach reflection</label>
                <textarea className="textarea" rows={3} placeholder="How did it go? What would you change next time?"
                  value={f.reflection} onChange={(e) => set('reflection', e.target.value)} /></div>

              {msg && <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{msg}</p>}
              <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save session journal'}</button>
              <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>
                This appears in your <a href="/coach/journal">coaching journal</a>.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
