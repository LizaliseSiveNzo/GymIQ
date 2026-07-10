/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';
import { useQrScanner } from '../lib/useQrScanner.js';

const isToday = (iso) => iso && new Date(iso).toDateString() === new Date().toDateString();
const whenLabel = (s) => s.starts_at ? new Date(s.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s.date || 'Session');

export default function CoachLogTraining() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionSel, setSessionSel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState([]);
  const [present, setPresent] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');

  const [scanOpen, setScanOpen] = useState(false);
  const [manual, setManual] = useState('');
  const [scanMsg, setScanMsg] = useState(''); const [scanErr, setScanErr] = useState('');
  const playersRef = useRef([]);
  useEffect(() => { playersRef.current = players; }, [players]);

  const { videoRef, scanning, error: camErr, start, stop } = useQrScanner((val) => markPresentByCode(val));

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); return stop; }, []);

  useEffect(() => { if (!teamId) return; (async () => {
    const p = await teamPlayers(teamId); setPlayers(p);
    const { data } = await supabase.from('training_sessions').select('id,starts_at,date,location,notes')
      .eq('team_id', teamId).order('starts_at', { ascending: false, nullsFirst: false }).limit(25);
    setSessions(data || []);
    setSessionSel('');
  })(); }, [teamId]);

  async function selectSession(sid, plist) {
    const ps = plist || players;
    setSessionSel(sid); setOk(''); setErr('');
    if (sid === 'new') { setPresent(Object.fromEntries(ps.map((x) => [x.id, true]))); return; }
    const { data } = await supabase.rpc('session_attendance', { p_session_id: sid });
    const map = {};
    ps.forEach((p) => { const r = (data || []).find((x) => x.player_id === p.id); map[p.id] = r ? !!r.present : false; });
    setPresent(map);
  }

  async function removeSession(sid, e) {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this training session and its attendance? This cannot be undone.')) return;
    setErr(''); setOk('');
    const { error } = await supabase.rpc('delete_training_session', { p_session_id: sid });
    if (error) { setErr(error.message); return; }
    const { data } = await supabase.from('training_sessions').select('id,starts_at,date,location,notes')
      .eq('team_id', teamId).order('starts_at', { ascending: false, nullsFirst: false }).limit(25);
    setSessions(data || []);
    if (sessionSel === sid) selectSession('new');
    setOk('Training session deleted.');
  }

  function markPresentByCode(raw) {
    const code = (raw || '').trim().toUpperCase();
    if (!code) return;
    const p = playersRef.current.find((x) => (x.code || '').trim().toUpperCase() === code);
    if (!p) { setScanErr(`No player with code ${code} on this team`); setScanMsg(''); try { navigator.vibrate?.(200); } catch (_e) {} return; }
    setPresent((s) => ({ ...s, [p.id]: true }));
    setScanErr(''); setScanMsg(`✓ ${p.name} marked present`);
    try { navigator.vibrate?.(60); } catch (_e) {}
  }
  function onManual(e) { e.preventDefault(); if (!manual.trim()) return; markPresentByCode(manual); setManual(''); }
  function toggleScanner() { const next = !scanOpen; setScanOpen(next); setScanMsg(''); setScanErr(''); if (next) start(); else stop(); }

  async function save(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      let sid = sessionSel;
      if (sessionSel === 'new') {
        const { data: ts, error } = await supabase.from('training_sessions')
          .insert({ team_id: teamId, coach_id: profile.id, date, notes }).select().single();
        if (error) { setErr(error.message); return; }
        sid = ts.id;
      }
      const rows = players.map((p) => ({ session_id: sid, player_id: p.id, attended: !!present[p.id] }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,player_id' });
        if (e2) { setErr(e2.message); return; }
      }
      await supabase.rpc('recompute_team_ranks', { p_team: teamId });
      stop(); setScanOpen(false);
      setOk(`Saved — ${rows.filter((r) => r.attended).length}/${rows.length} present. Ranks updated.`);
      const { data } = await supabase.from('training_sessions').select('id,starts_at,date,location,notes')
        .eq('team_id', teamId).order('starts_at', { ascending: false, nullsFirst: false }).limit(25);
      setSessions(data || []); setSessionSel(sid); setNotes('');
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Log Training" title="Log Training"><div className="card">Demo mode — sign in as a real coach to log training.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Log Training" title="Log Training"><div className="card">No teams assigned yet.</div></AppShell>;

  const presentCount = players.filter((p) => present[p.id]).length;

  return (
    <AppShell role="coach" active="Log Training" title="Log Training">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="field" style={{ margin: 0 }}><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => { stop(); setScanOpen(false); setTeamId(e.target.value); }}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>

          <div className="section-header" style={{ marginTop: 14 }}><h4 style={{ margin: 0 }}>Scheduled sessions</h4><span className="badge badge-neutral">{sessions.length}</span></div>
          <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>Tap the session that’s happening now to log its attendance.</p>
          <div className="stack" style={{ gap: 8 }}>
            <div onClick={() => selectSession('new')} role="button" tabIndex={0}
              style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: sessionSel === 'new' ? '2px solid var(--green-600)' : '1px solid var(--border)' }}>
              <strong>➕ New session (not scheduled)</strong>
            </div>
            {sessions.map((s) => {
              const sel = sessionSel === s.id; const today = isToday(s.starts_at);
              return (
                <div key={s.id} onClick={() => selectSession(s.id)} role="button" tabIndex={0}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    border: sel ? '2px solid var(--green-600)' : '1px solid var(--border)',
                    background: today ? 'var(--surface-2)' : 'var(--surface)' }}>
                  <div className="row between">
                    <div>
                      <strong>{s.notes || 'Training'}</strong>
                      <div className="subtle" style={{ fontSize: 12 }}>{whenLabel(s)}{s.location ? ` · ${s.location}` : ''}</div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {today && <span className="badge badge-warning">Today</span>}
                      <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px', color: 'var(--danger)' }}
                        onClick={(e) => removeSession(s.id, e)} title="Delete session">🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {sessionSel === 'new' && (
            <div className="field" style={{ marginTop: 12 }}><label className="label">Date (for the new session)</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          )}
        </div>

        {sessionSel ? (
        <form className="card" onSubmit={save}>
          <div className="section-header">
            <h4 style={{ margin: 0 }}>Attendance <span className="subtle" style={{ fontSize: 13, fontWeight: 400 }}>· {presentCount}/{players.length} present</span></h4>
            <button type="button" className="btn btn-primary" style={{ minHeight: 34, padding: '6px 12px' }} onClick={toggleScanner}>
              {scanOpen ? 'Close scanner' : '📷 Scan present'}
            </button>
          </div>

          {scanOpen && (
            <div className="card" style={{ background: 'var(--surface-2)', border: 0, marginBottom: 12 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Scan a player’s QR, or type their student code</strong>
                {scanning ? <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }} onClick={stop}>Stop camera</button>
                          : <button type="button" className="btn btn-secondary" style={{ minHeight: 30 }} onClick={start}>Start camera</button>}
              </div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', display: scanning ? 'block' : 'none' }}>
                <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: '18% 22%', border: '3px solid rgba(255,255,255,.9)', borderRadius: 12 }} />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Student code, e.g. PIQ-EAG3"
                  value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onManual(e); }} />
                <button type="button" className="btn btn-secondary" onClick={onManual} disabled={!manual.trim()}>Mark present</button>
              </div>
              {scanMsg && <p style={{ color: 'var(--green-700)', fontSize: 14, margin: '10px 0 0', fontWeight: 600 }}>{scanMsg}</p>}
              {(scanErr || camErr) && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0 0' }}>{scanErr || camErr}</p>}
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            {players.map((p) => (
              <label key={p.id} className="row between" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer' }}>
                <span className="row"><span className="avatar">{p.name.split(' ').map((w)=>w[0]).join('')}</span> {p.name}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className={`badge ${present[p.id] ? 'badge-success' : 'badge-danger'}`}>{present[p.id] ? 'Present' : 'Absent'}</span>
                  <input type="checkbox" checked={!!present[p.id]} onChange={(e) => setPresent((s) => ({ ...s, [p.id]: e.target.checked }))} />
                </span>
              </label>
            ))}
            {players.length === 0 && <p className="subtle">No players on this team yet.</p>}
          </div>

          {sessionSel === 'new' && (
            <div className="field" style={{ marginTop: 12 }}><label className="label">Session note (optional)</label>
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          )}

          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          {ok &&  <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{ok}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !players.length}>{busy ? 'Saving…' : 'Save attendance'}</button>
        </form>
        ) : (
          <div className="card"><p className="subtle" style={{ margin: 0 }}>Select a session above (or “New session”) to log attendance.</p></div>
        )}
      </div>
    </AppShell>
  );
}
