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
import { primeAudio, successBeep, errorBeep } from '../lib/sound.js';
import SessionJournal from '../components/SessionJournal.jsx';

const isToday = (iso) => iso && new Date(iso).toDateString() === new Date().toDateString();
const whenLabel = (s) => s.starts_at ? new Date(s.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s.date ? new Date(s.date).toLocaleDateString() : 'Session');
const REASONS = ['Injury', 'Illness', 'Emergency', 'Family / personal', 'Fatigue', 'Other'];
const first = (n = '') => n.split(' ')[0];

export default function CoachLogTraining() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionSel, setSessionSel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState([]);
  const [present, setPresent] = useState({});
  const [locked, setLocked] = useState(new Set());
  const [leftEarly, setLeftEarly] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [showEarlier, setShowEarlier] = useState(false);

  // attendance list controls
  const [pQuery, setPQuery] = useState('');
  const [pSort, setPSort] = useState('name');   // 'name' | 'present'

  // per-player panel
  const [editFor, setEditFor] = useState('');
  const [leReason, setLeReason] = useState('Injury');
  const [leNote, setLeNote] = useState('');
  const [improve, setImprove] = useState('');
  const [panelMsg, setPanelMsg] = useState('');

  // scanner
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
    await reloadSessions();
    setSessionSel('');
  })(); }, [teamId]);

  async function reloadSessions() {
    const { data } = await supabase.from('training_sessions').select('id,starts_at,date,location,notes')
      .eq('team_id', teamId).order('starts_at', { ascending: false, nullsFirst: false }).limit(60);
    setSessions(data || []);
    return data || [];
  }

  async function selectSession(sid, plist) {
    const ps = plist || players;
    setSessionSel(sid); setOk(''); setErr(''); setEditFor(''); setPQuery('');
    if (sid === 'new') { setLocked(new Set()); setLeftEarly({}); setPresent(Object.fromEntries(ps.map((x) => [x.id, true]))); return; }
    const { data } = await supabase.rpc('session_attendance', { p_session_id: sid });
    const lockedSet = new Set((data || []).filter((x) => x.checkin_at).map((x) => x.player_id));
    const leMap = {}; (data || []).forEach((x) => { if (x.left_early) leMap[x.player_id] = x.left_reason || 'Left early'; });
    const map = {};
    ps.forEach((p) => { const r = (data || []).find((x) => x.player_id === p.id); map[p.id] = r ? !!r.present : false; });
    lockedSet.forEach((id) => { map[id] = true; });
    setLocked(lockedSet); setLeftEarly(leMap); setPresent(map);
  }

  function markPresentByCode(raw) {
    const code = (raw || '').trim().toUpperCase();
    if (!code) return;
    const p = playersRef.current.find((x) => (x.code || '').trim().toUpperCase() === code);
    if (!p) { setScanErr(`No player with code ${code} on this team`); setScanMsg(''); try { navigator.vibrate?.(200); } catch (_e) {} errorBeep(); return; }
    setPresent((s) => ({ ...s, [p.id]: true }));
    setLocked((prev) => { const n = new Set(prev); n.add(p.id); return n; });
    setScanErr(''); setScanMsg(`✓ ${p.name} checked in — locked present`);
    successBeep();
    try { navigator.vibrate?.(60); } catch (_e) {}
  }
  function onManual(e) { e.preventDefault(); if (!manual.trim()) return; markPresentByCode(manual); setManual(''); }
  function toggleScanner() { const next = !scanOpen; setScanOpen(next); setScanMsg(''); setScanErr(''); if (next) { primeAudio(); start(); } else stop(); }

  async function ensureSession() {
    if (sessionSel !== 'new') return sessionSel;
    const starts_at = (date && newTime) ? new Date(`${date}T${newTime}`).toISOString() : null;
    const { data: ts, error } = await supabase.from('training_sessions')
      .insert({ team_id: teamId, coach_id: profile.id, date, starts_at, location: newLocation.trim() || null, notes: notes.trim() || null })
      .select().single();
    if (error) throw error;
    await reloadSessions(); setSessionSel(ts.id);
    return ts.id;
  }

  async function markLeftEarly(p) {
    setPanelMsg(''); setErr('');
    const reason = leReason === 'Other' ? (leNote.trim() || 'Other') : (leNote.trim() ? `${leReason} — ${leNote.trim()}` : leReason);
    let sid;
    try { sid = await ensureSession(); } catch (e) { setErr(e.message || String(e)); return; }
    const { error } = await supabase.rpc('record_left_early', { p_session_id: sid, p_player_id: p.id, p_reason: reason });
    if (error) { setErr(error.message); return; }
    setLeftEarly((m) => ({ ...m, [p.id]: reason }));
    setPresent((s) => ({ ...s, [p.id]: true }));
    setLocked((prev) => { const n = new Set(prev); n.add(p.id); return n; });
    setLeNote(''); setPanelMsg(`${first(p.name)} marked left early — still counts as present.`);
  }
  async function undoLeftEarly(p) {
    if (sessionSel === 'new') return;
    await supabase.rpc('clear_left_early', { p_session_id: sessionSel, p_player_id: p.id });
    setLeftEarly((m) => { const n = { ...m }; delete n[p.id]; return n; });
    setPanelMsg('Left-early cleared.');
  }
  async function sendNote(p) {
    setPanelMsg(''); setErr('');
    const { error } = await supabase.rpc('add_coach_note', { p_player_id: p.id, p_note: improve.trim() });
    if (error) { setErr(error.message); return; }
    setImprove('');
    setPanelMsg(`Note sent to ${first(p.name)} — it’ll appear on their profile.`);
  }

  async function removeSession(sid, e) {
    if (e) e.stopPropagation();
    if (!window.confirm('Cancel this training session? Players will be notified and its attendance is removed. This cannot be undone.')) return;
    setErr(''); setOk('');
    const { error } = await supabase.rpc('delete_training_session', { p_session_id: sid });
    if (error) { setErr(error.message); return; }
    await reloadSessions();
    if (sessionSel === sid) selectSession('new');
    setOk('Training session deleted.');
  }

  async function save(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      let sid;
      try { sid = await ensureSession(); } catch (e2) { setErr(e2.message || String(e2)); return; }
      const rows = players.map((p) => ({ session_id: sid, player_id: p.id, attended: !!present[p.id] }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,player_id' });
        if (e2) { setErr(e2.message); return; }
      }
      await supabase.rpc('recompute_team_ranks', { p_team: teamId });
      stop(); setScanOpen(false);
      setOk(`Saved — ${rows.filter((r) => r.attended).length}/${rows.length} present. Ranks updated.`);
      await reloadSessions(); setSessionSel(sid); setNotes('');
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Training" title="Log Training"><div className="card">Demo mode — sign in as a real coach to log training.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Training" title="Log Training"><div className="card">No teams assigned yet.</div></AppShell>;

  const presentCount = players.filter((p) => present[p.id]).length;
  const absentCount = players.length - presentCount;

  // grouped session list
  const now = new Date();
  const startWeek = new Date(now); startWeek.setHours(0, 0, 0, 0); startWeek.setDate(startWeek.getDate() - startWeek.getDay());
  const endWeek = new Date(startWeek); endWeek.setDate(startWeek.getDate() + 7);
  const sWhen = (s) => new Date(s.starts_at || s.date);
  const groups = { today: [], week: [], earlier: [] };
  sessions.forEach((s) => {
    if (isToday(s.starts_at || s.date)) groups.today.push(s);
    else { const w = sWhen(s); (w >= startWeek && w < endWeek) ? groups.week.push(s) : groups.earlier.push(s); }
  });
  const earlierShown = showEarlier ? groups.earlier : groups.earlier.slice(0, 6);

  // attendance list filter + sort
  const displayPlayers = [...players]
    .filter((p) => p.name.toLowerCase().includes(pQuery.toLowerCase()))
    .sort((a, b) => pSort === 'present'
      ? ((present[b.id] ? 1 : 0) - (present[a.id] ? 1 : 0)) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));

  const sessionCard = (s) => {
    const sel = sessionSel === s.id; const today = isToday(s.starts_at || s.date);
    return (
      <div key={s.id} onClick={() => selectSession(s.id)} role="button" tabIndex={0}
        style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: sel ? '2px solid var(--green-600)' : '1px solid var(--border)', background: today ? 'var(--surface-2)' : 'var(--surface)' }}>
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
  };
  const groupHeader = (t) => <div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 0' }}>{t}</div>;

  return (
    <AppShell role="coach" active="Training" title="Log Training">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="field" style={{ margin: 0 }}><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => { stop(); setScanOpen(false); setTeamId(e.target.value); }}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>

          <div className="section-header" style={{ marginTop: 14 }}><h4 style={{ margin: 0 }}>Scheduled sessions</h4><span className="badge badge-neutral">{sessions.length}</span></div>
          <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>Tap the session that’s happening now to log its attendance.</p>
          <div className="stack" style={{ gap: 8 }}>
            <div onClick={() => selectSession('new')} role="button" tabIndex={0}
              style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: sessionSel === 'new' ? '2px solid var(--green-600)' : '1px solid var(--border)' }}>
              <strong>➕ New session (not scheduled)</strong>
            </div>
            {groups.today.length > 0 && <>{groupHeader('Today')}{groups.today.map(sessionCard)}</>}
            {groups.week.length > 0 && <>{groupHeader('This week')}{groups.week.map(sessionCard)}</>}
            {groups.earlier.length > 0 && <>{groupHeader('Earlier')}{earlierShown.map(sessionCard)}
              {groups.earlier.length > 6 && <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => setShowEarlier((v) => !v)}>{showEarlier ? 'Show less' : `Show ${groups.earlier.length - 6} more`}</button>}</>}
          </div>
        </div>

        {sessionSel === 'new' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-header"><h4 style={{ margin: 0 }}>➕ New session details</h4></div>
            <div className="grid grid-3" style={{ gap: 10 }}>
              <div className="field" style={{ margin: 0 }}><label className="label">Date</label>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Time (optional)</label>
                <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Location (optional)</label>
                <input className="input" placeholder="e.g. Main Pitch" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} /></div>
            </div>
          </div>
        )}

        {sessionSel && sessionSel !== 'new' && <SessionJournal sessionId={sessionSel} players={players} />}

        {sessionSel ? (
        <form className="card" onSubmit={save}>
          <div className="section-header">
            <h4 style={{ margin: 0 }}>Attendance <span className="subtle" style={{ fontSize: 13, fontWeight: 400 }}>· {presentCount} present · {absentCount} absent</span></h4>
            <button type="button" className="btn btn-primary" style={{ minHeight: 34, padding: '6px 12px' }} onClick={toggleScanner}>
              {scanOpen ? 'Close scanner' : '📷 Scan present'}
            </button>
          </div>
          <p className="subtle" style={{ marginTop: 0, fontSize: 12 }}>Tap a player’s name to mark them left early or send a training note.</p>

          {scanOpen && (
            <div className="card" style={{ background: 'var(--surface-2)', border: 0, marginBottom: 12 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Scan a player’s QR, or type their student code</strong>
                {scanning ? <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }} onClick={stop}>Stop camera</button>
                          : <button type="button" className="btn btn-secondary" style={{ minHeight: 30 }} onClick={() => { primeAudio(); start(); }}>Start camera</button>}
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

          {players.length > 6 && (
            <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 1, minWidth: 150, minHeight: 34 }} placeholder="Find a player…" value={pQuery} onChange={(e) => setPQuery(e.target.value)} />
              <div className="segmented">
                <button type="button" aria-selected={pSort === 'name'} onClick={() => setPSort('name')}>A–Z</button>
                <button type="button" aria-selected={pSort === 'present'} onClick={() => setPSort('present')}>Present first</button>
              </div>
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            {displayPlayers.map((p) => {
              const le = leftEarly[p.id];
              return (
                <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" className="row" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, minWidth: 140, textAlign: 'left' }}
                      onClick={() => { setEditFor(editFor === p.id ? '' : p.id); setPanelMsg(''); setLeReason('Injury'); setLeNote(''); setImprove(''); }}>
                      <span className="avatar">{p.name.split(' ').map((w)=>w[0]).join('')}</span>
                      <span style={{ fontWeight: 600, textDecoration: 'underline' }}>{p.name}</span>
                    </button>
                    <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {le && <span className="badge badge-warning">Left early{le && le !== true ? `: ${le}` : ''}</span>}
                      {locked.has(p.id) && <span className="badge badge-neutral" title="Checked in — locked present">🔒</span>}
                      <span className={`badge ${present[p.id] ? 'badge-success' : 'badge-danger'}`}>{present[p.id] ? 'Present' : 'Absent'}</span>
                      <input type="checkbox" checked={!!present[p.id]} disabled={locked.has(p.id)}
                        onChange={(e) => setPresent((s) => ({ ...s, [p.id]: e.target.checked }))} />
                    </span>
                  </div>

                  {editFor === p.id && (
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <div className="row between"><strong style={{ fontSize: 13 }}>🚪 Left early</strong>
                        {le && <button type="button" className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => undoLeftEarly(p)}>Undo</button>}</div>
                      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="field" style={{ margin: 0, minWidth: 150 }}>
                          <label className="label" style={{ fontSize: 12 }}>Reason</label>
                          <select className="select" value={leReason} onChange={(e) => setLeReason(e.target.value)}>
                            {REASONS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                        </div>
                        <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder={leReason === 'Other' ? 'Describe reason' : 'Add detail (optional)'}
                          value={leNote} onChange={(e) => setLeNote(e.target.value)} />
                        <button type="button" className="btn btn-secondary" style={{ minHeight: 38 }} onClick={() => markLeftEarly(p)}>Mark left early</button>
                      </div>
                      <p className="subtle" style={{ fontSize: 12, margin: '6px 0 0' }}>Left-early players still count as present — attendance score isn’t affected.</p>

                      <div style={{ marginTop: 14 }}>
                        <strong style={{ fontSize: 13 }}>📝 Training note for {first(p.name)}</strong>
                        <textarea className="textarea" rows={3} style={{ marginTop: 6 }} value={improve} onChange={(e) => setImprove(e.target.value)}
                          placeholder="What can they improve on? This is sent to the player’s profile." />
                        <button type="button" className="btn btn-primary" style={{ minHeight: 38 }} onClick={() => sendNote(p)} disabled={!improve.trim()}>Send note to player</button>
                      </div>
                      {panelMsg && <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 8 }}>{panelMsg}</p>}
                    </div>
                  )}
                </div>
              );
            })}
            {players.length === 0 && <p className="subtle">No players on this team yet.</p>}
            {players.length > 0 && displayPlayers.length === 0 && <p className="subtle">No players match “{pQuery}”.</p>}
          </div>

          {sessionSel === 'new' && (
            <div className="field" style={{ marginTop: 12 }}><label className="label">Session note / focus (optional)</label>
              <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Fitness + set pieces" /></div>
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
