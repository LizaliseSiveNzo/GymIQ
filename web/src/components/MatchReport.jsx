/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Post-match reporting (item 11): substitutions, per-player ratings & stats,
// and a coach reflection. Stats are written to player_match_stats so they feed
// the player summary card and the leaderboard.
const STAT_FIELDS = [
  ['minutes_played', 'Mins'],
  ['goals',          'Goals'],
  ['assists',        'Assists'],
  ['shots',          'Shots'],
  ['yellow_cards',   'YC'],
  ['red_cards',      'RC'],
];

export default function MatchReport({ matchId, players = [], lineup = {} }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState({});      // player_id -> row
  const [subs, setSubs] = useState([]);
  const [reflection, setReflection] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // new sub form
  const [off, setOff] = useState('');
  const [on, setOn] = useState('');
  const [minute, setMinute] = useState('');

  useEffect(() => { if (open && !loaded) load(); /* eslint-disable-next-line */ }, [open, matchId]);
  useEffect(() => { setLoaded(false); setOpen(false); }, [matchId]);

  async function load() {
    const [{ data: ms }, { data: sb }, { data: m }] = await Promise.all([
      supabase.from('player_match_stats').select('player_id,minutes_played,goals,assists,shots,yellow_cards,red_cards,rating,note').eq('match_id', matchId),
      supabase.from('match_substitutions').select('id,player_off,player_on,minute').eq('match_id', matchId).order('minute'),
      supabase.from('matches').select('reflection').eq('id', matchId).single(),
    ]);
    const map = {}; (ms || []).forEach((r) => { map[r.player_id] = r; });
    setStats(map); setSubs(sb || []); setReflection(m?.reflection || '');
    setLoaded(true);
  }

  const val = (pid, k) => stats[pid]?.[k] ?? '';
  const setVal = (pid, k, v) => setStats((s) => ({ ...s, [pid]: { ...(s[pid] || { player_id: pid }), [k]: v } }));

  async function addSub() {
    if (!off && !on) return;
    const { data, error } = await supabase.from('match_substitutions')
      .insert({ match_id: matchId, player_off: off || null, player_on: on || null, minute: minute ? parseInt(minute, 10) : null })
      .select('id,player_off,player_on,minute').single();
    if (!error && data) { setSubs((l) => [...l, data].sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999))); setOff(''); setOn(''); setMinute(''); }
  }
  async function removeSub(id) {
    await supabase.from('match_substitutions').delete().eq('id', id);
    setSubs((l) => l.filter((s) => s.id !== id));
  }

  async function save() {
    setBusy(true); setMsg('');
    try {
      const rows = Object.values(stats)
        .filter((r) => r && Object.keys(r).some((k) => k !== 'player_id' && r[k] !== '' && r[k] != null))
        .map((r) => {
          const out = { match_id: matchId, player_id: r.player_id };
          [...STAT_FIELDS.map(([k]) => k), 'rating'].forEach((k) => {
            const v = r[k];
            out[k] = (v === '' || v == null) ? null : Number(v);
          });
          if (r.note != null) out.note = r.note || null;
          return out;
        });
      if (rows.length) {
        const { error } = await supabase.from('player_match_stats').upsert(rows, { onConflict: 'player_id,match_id' });
        if (error) { setMsg(error.message); return; }
      }
      const { error: e2 } = await supabase.from('matches').update({ reflection: reflection.trim() || null }).eq('id', matchId);
      if (e2) { setMsg(e2.message); return; }
      setMsg('Match report saved.');
    } finally { setBusy(false); }
  }

  if (!matchId) return null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name || '—';
  // squad members involved: starters + bench first, then everyone else
  const involved = [...players].sort((a, b) => {
    const rank = (p) => lineup[p.id]?.status === 'starter' ? 0 : lineup[p.id]?.status === 'bench' ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
        <div className="row between" style={{ width: '100%' }}>
          <strong>🏁 Match report — subs, ratings &amp; stats</strong>
          <span className="subtle">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {!loaded ? <p className="subtle" style={{ margin: 0 }}>Loading…</p> : (
            <>
              {/* ---- substitutions ---- */}
              <h4 style={{ margin: '0 0 6px' }}>🔄 Substitutions</h4>
              {subs.length > 0 && (
                <div className="stack" style={{ gap: 6, marginBottom: 8 }}>
                  {subs.map((s) => (
                    <div key={s.id} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}>
                      <span style={{ fontSize: 13 }}>
                        {s.minute != null && <strong>{s.minute}'&nbsp;</strong>}
                        <span style={{ color: 'var(--danger)' }}>↓ {nameOf(s.player_off)}</span>
                        {' '}<span style={{ color: 'var(--green-700)' }}>↑ {nameOf(s.player_on)}</span>
                      </span>
                      <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px', color: 'var(--danger)' }} onClick={() => removeSub(s.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                <select className="select" style={{ flex: 1, minWidth: 120 }} value={off} onChange={(e) => setOff(e.target.value)}>
                  <option value="">Player off…</option>{involved.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="select" style={{ flex: 1, minWidth: 120 }} value={on} onChange={(e) => setOn(e.target.value)}>
                  <option value="">Player on…</option>{involved.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input" style={{ maxWidth: 80 }} type="number" placeholder="min" value={minute} onChange={(e) => setMinute(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={addSub} disabled={!off && !on}>Add</button>
              </div>

              {/* ---- per-player ratings & stats ---- */}
              <h4 style={{ margin: '0 0 6px' }}>⭐ Player ratings &amp; stats</h4>
              <p className="subtle" style={{ fontSize: 12, marginTop: 0 }}>Leave blank for players who didn’t feature. Ratings are out of 5.</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: 520 }}>
                  <thead><tr><th>Player</th><th>Rating</th>{STAT_FIELDS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
                  <tbody>
                    {involved.map((p) => {
                      const st = lineup[p.id]?.status;
                      return (
                        <tr key={p.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {p.name}
                            {st && <span className="subtle" style={{ fontSize: 11 }}> · {st === 'starter' ? 'XI' : 'bench'}</span>}
                          </td>
                          <td>
                            <input className="input" style={{ minHeight: 30, width: 62, padding: '2px 6px' }} type="number" min="0" max="5" step="0.5"
                              value={val(p.id, 'rating')} onChange={(e) => setVal(p.id, 'rating', e.target.value)} />
                          </td>
                          {STAT_FIELDS.map(([k]) => (
                            <td key={k}>
                              <input className="input" style={{ minHeight: 30, width: 58, padding: '2px 6px' }} type="number" min="0"
                                value={val(p.id, k)} onChange={(e) => setVal(p.id, k, e.target.value)} />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ---- reflection ---- */}
              <div className="field" style={{ marginTop: 14 }}>
                <label className="label">💭 Post-match reflection</label>
                <textarea className="textarea" rows={3} placeholder="How did the game go? What worked, what needs work?"
                  value={reflection} onChange={(e) => setReflection(e.target.value)} />
              </div>

              {msg && <p style={{ color: msg.includes('saved') ? 'var(--green-700)' : 'var(--danger)', fontSize: 13 }}>{msg}</p>}
              <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save match report'}</button>
              <p className="subtle" style={{ fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>
                Your reflection appears in the <a href="/coach/journal">coaching journal</a>.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
