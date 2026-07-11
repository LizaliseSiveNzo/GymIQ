/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams } from '../lib/coach.js';
import { useQrScanner } from '../lib/useQrScanner.js';
import { primeAudio, successBeep, errorBeep } from '../lib/sound.js';

const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const REASONS = ['Injury', 'Illness', 'Family / personal', 'Disciplinary', 'Fatigue', 'Other'];

export default function CoachCheckin() {
  const { profile, session } = useAuth();
  const [params] = useSearchParams();
  const wantSession = params.get('session');

  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [roster, setRoster] = useState([]);
  const [manual, setManual] = useState('');
  const [last, setLast] = useState('');
  const [err, setErr] = useState('');

  const [earlyFor, setEarlyFor] = useState('');
  const [reasonSel, setReasonSel] = useState('Injury');
  const [reasonNote, setReasonNote] = useState('');

  const { videoRef, scanning, error: camErr, cameraSupported, start, stop } = useQrScanner((val) => record(val, 'qr'));

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); return stop; }, []);

  useEffect(() => { if (!teamId) return; (async () => {
    const { data } = await supabase.from('training_sessions')
      .select('id,starts_at,date,location,notes').eq('team_id', teamId)
      .order('starts_at', { ascending: false, nullsFirst: false }).limit(30);
    setSessions(data || []);
    const pref = wantSession && (data || []).some((s) => s.id === wantSession) ? wantSession : (data?.[0]?.id || '');
    setSessionId(pref);
  })(); }, [teamId]);

  useEffect(() => { loadRoster(); }, [sessionId]);

  async function loadRoster() {
    if (!sessionId) { setRoster([]); return; }
    const { data } = await supabase.rpc('session_attendance', { p_session_id: sessionId });
    setRoster(data || []);
  }

  async function record(code, method) {
    if (!sessionId) { setErr('Pick a practice session first.'); return; }
    setErr('');
    const { data, error } = await supabase.rpc('record_attendance', {
      p_session_id: sessionId, p_code: (code || '').trim(), p_action: 'in', p_method: method,
    });
    if (error) { setErr(error.message); try { navigator.vibrate?.(200); } catch (_e) {} errorBeep(); return; }
    setLast(`${data.name} — checked in ${fmt(data.checkin_at)}`);
    successBeep();
    try { navigator.vibrate?.(60); } catch (_e) {}
    loadRoster();
  }

  function onManual(e) { e.preventDefault(); if (!manual.trim()) return; record(manual, 'manual'); setManual(''); }

  async function saveEarly(playerId) {
    const reason = reasonSel === 'Other' ? (reasonNote.trim() || 'Other') : (reasonNote.trim() ? `${reasonSel} — ${reasonNote.trim()}` : reasonSel);
    setErr('');
    const { error } = await supabase.rpc('record_left_early', { p_session_id: sessionId, p_player_id: playerId, p_reason: reason });
    if (error) { setErr(error.message); return; }
    setEarlyFor(''); setReasonNote(''); setReasonSel('Injury'); loadRoster();
  }
  async function undoEarly(playerId) { await supabase.rpc('clear_left_early', { p_session_id: sessionId, p_player_id: playerId }); loadRoster(); }

  if (session?.demo) return <AppShell role="coach" active="Training" title="Check-in"><div className="card">Demo mode — sign in as a real coach to take attendance.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Training" title="Check-in"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  const present = roster.filter((r) => r.present).length;

  return (
    <AppShell role="coach" active="Training" title="Practice Check-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => { stop(); setTeamId(e.target.value); }}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Practice session</label>
            <select className="select" value={sessionId} onChange={(e) => { stop(); setSessionId(e.target.value); }}>
              {sessions.length === 0 && <option value="">No practices — schedule one first</option>}
              {sessions.map((s) => <option key={s.id} value={s.id}>
                {(s.starts_at ? new Date(s.starts_at).toLocaleString() : s.date) + (s.notes ? ` · ${s.notes}` : '')}
              </option>)}</select></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Scan player QR to check in</h4>
          {scanning ? <button className="btn btn-ghost" onClick={stop}>Stop camera</button>
                    : <button className="btn btn-primary" onClick={() => { primeAudio(); start(); }} disabled={!sessionId}>📷 Start camera</button>}</div>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', display: scanning ? 'block' : 'none' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: '18% 22%', border: '3px solid rgba(255,255,255,.9)', borderRadius: 12 }} />
        </div>
        {!cameraSupported && <p className="subtle" style={{ fontSize: 13, margin: '4px 0 0' }}>This browser can’t use the camera. Use the code box below — it works everywhere.</p>}

        <form onSubmit={onManual} className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Or type student code, e.g. PIQ-EAG3"
            value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-secondary" disabled={!manual.trim() || !sessionId}>Check in</button>
        </form>
        {last && <p style={{ color: 'var(--green-700)', fontSize: 14, margin: '10px 0 0', fontWeight: 600 }}>✓ {last}</p>}
        {(err || camErr) && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0 0' }}>{err || camErr}</p>}
      </div>

      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Attendance</h4>
          <span className="badge badge-success">{present}/{roster.length} present</span></div>
        {roster.length === 0 ? <p className="subtle">No players on this team, or no session selected.</p> : (
          <div className="stack" style={{ gap: 6 }}>
            {roster.map((r) => (
              <div key={r.player_id} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="row" style={{ minWidth: 150 }}>
                    <span className="avatar">{(r.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                    <span>{r.name}<span className="subtle" style={{ fontSize: 12 }}> · {r.child_code}</span></span>
                  </span>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {r.present ? <span className="badge badge-success">✓ In {fmt(r.checkin_at)}</span> : <span className="badge badge-neutral">Not in</span>}
                    {r.left_early && <span className="badge badge-warning">Left early{r.left_reason ? `: ${r.left_reason}` : ''}</span>}
                    {r.present && !r.left_early && <button className="btn btn-ghost" style={{ minHeight: 30, padding: '4px 10px' }} onClick={() => { setEarlyFor(earlyFor === r.player_id ? '' : r.player_id); setReasonSel('Injury'); setReasonNote(''); }}>Left early</button>}
                    {r.left_early && <button className="btn btn-ghost" style={{ minHeight: 30, padding: '4px 10px' }} onClick={() => undoEarly(r.player_id)}>Undo</button>}
                  </div>
                </div>
                {earlyFor === r.player_id && (
                  <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="field" style={{ margin: 0, minWidth: 150 }}>
                      <label className="label" style={{ fontSize: 12 }}>Reason</label>
                      <select className="select" value={reasonSel} onChange={(e) => setReasonSel(e.target.value)}>
                        {REASONS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                    </div>
                    <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder={reasonSel === 'Other' ? 'Describe reason' : 'Add detail (optional)'}
                      value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
                    <button className="btn btn-primary" style={{ minHeight: 38 }} onClick={() => saveEarly(r.player_id)}>Save</button>
                    <button className="btn btn-ghost" style={{ minHeight: 38 }} onClick={() => setEarlyFor('')}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
