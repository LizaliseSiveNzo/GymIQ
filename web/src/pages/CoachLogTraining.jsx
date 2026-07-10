/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

export default function CoachLogTraining() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [sessions, setSessions] = useState([]);   // scheduled practices
  const [sessionSel, setSessionSel] = useState('new');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState([]);
  const [present, setPresent] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');

  // scanner state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [scanMsg, setScanMsg] = useState(''); const [scanErr, setScanErr] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);
  const lastScanRef = useRef({ code: '', t: 0 });
  const playersRef = useRef([]);
  useEffect(() => { playersRef.current = players; }, [players]);

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); return stopCam; }, []);

  useEffect(() => { if (!teamId) return; (async () => {
    const p = await teamPlayers(teamId); setPlayers(p);
    setPresent(Object.fromEntries(p.map((x) => [x.id, true])));
    const { data } = await supabase.from('training_sessions').select('id,starts_at,location,notes')
      .eq('team_id', teamId).not('starts_at', 'is', null).order('starts_at', { ascending: false }).limit(10);
    setSessions(data || []); setSessionSel('new');
  })(); }, [teamId]);

  function markPresentByCode(raw) {
    const code = (raw || '').trim().toUpperCase();
    if (!code) return;
    const p = playersRef.current.find((x) => (x.code || '').trim().toUpperCase() === code);
    if (!p) { setScanErr(`No player with code ${code} on this team`); setScanMsg(''); try { navigator.vibrate?.(200); } catch (_e) {} return; }
    setPresent((s) => ({ ...s, [p.id]: true }));
    setScanErr(''); setScanMsg(`✓ ${p.name} marked present`);
    try { navigator.vibrate?.(60); } catch (_e) {}
  }

  function onManual(e) {
    e.preventDefault();
    if (!manual.trim()) return;
    markPresentByCode(manual);
    setManual('');
  }

  async function startCam() {
    setScanErr('');
    if (!supported) { setScanErr('Camera scanning isn’t supported on this browser — use the code box below.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      runningRef.current = true; setScanning(true);
      const loop = async () => {
        if (!runningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes[0]?.rawValue) {
            const val = codes[0].rawValue.trim();
            const now = Date.now();
            if (!(val === lastScanRef.current.code && now - lastScanRef.current.t < 2500)) {
              lastScanRef.current = { code: val, t: now };
              markPresentByCode(val);
            }
          }
        } catch (_e) { /* frame noise */ }
        if (runningRef.current) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) { setScanErr('Camera error: ' + (e.message || e)); }
  }
  function stopCam() {
    runningRef.current = false; setScanning(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }
  function toggleScanner() {
    const next = !scanOpen; setScanOpen(next); setScanMsg(''); setScanErr('');
    if (!next) stopCam();
  }

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
      stopCam(); setScanOpen(false);
      setOk(`Saved — ${rows.filter((r) => r.attended).length}/${rows.length} present. Ranks updated.`);
      setNotes('');
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Log Training" title="Log Training"><div className="card">Demo mode — sign in as a real coach to log training.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Log Training" title="Log Training"><div className="card">No teams assigned yet.</div></AppShell>;

  const presentCount = players.filter((p) => present[p.id]).length;

  return (
    <AppShell role="coach" active="Log Training" title="Log Training">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <form className="card" onSubmit={save}>
          <div className="grid grid-2">
            <div className="field"><label className="label">Team</label>
              <select className="select" value={teamId} onChange={(e) => { stopCam(); setScanOpen(false); setTeamId(e.target.value); }}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="field"><label className="label">Session</label>
              <select className="select" value={sessionSel} onChange={(e) => setSessionSel(e.target.value)}>
                <option value="new">New session</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>
                  {new Date(s.starts_at).toLocaleDateString()} — {s.notes || 'Practice'}</option>)}
              </select></div>
          </div>
          {sessionSel === 'new' && (
            <div className="field"><label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          )}

          <div className="section-header" style={{ marginTop: 8 }}>
            <h4 style={{ margin: 0 }}>Attendance <span className="subtle" style={{ fontSize: 13, fontWeight: 400 }}>· {presentCount}/{players.length} present</span></h4>
            <button type="button" className="btn btn-primary" style={{ minHeight: 34, padding: '6px 12px' }} onClick={toggleScanner}>
              {scanOpen ? 'Close scanner' : '📷 Scan present'}
            </button>
          </div>

          {scanOpen && (
            <div className="card" style={{ background: 'var(--surface-2)', border: 0, marginBottom: 12 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Scan a player’s QR, or type their student code</strong>
                {scanning ? <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }} onClick={stopCam}>Stop camera</button>
                          : <button type="button" className="btn btn-secondary" style={{ minHeight: 30 }} onClick={startCam}>Start camera</button>}
              </div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', display: scanning ? 'block' : 'none' }}>
                <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: '18% 22%', border: '3px solid rgba(255,255,255,.9)', borderRadius: 12 }} />
              </div>
              {!supported && <p className="subtle" style={{ fontSize: 12, margin: '4px 0 0' }}>This browser can’t scan QR codes — use the code box below.</p>}
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Student code, e.g. PIQ-EAG3"
                  value={manual} onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onManual(e); }} />
                <button type="button" className="btn btn-secondary" onClick={onManual} disabled={!manual.trim()}>Mark present</button>
              </div>
              {scanMsg && <p style={{ color: 'var(--green-700)', fontSize: 14, margin: '10px 0 0', fontWeight: 600 }}>{scanMsg}</p>}
              {scanErr && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0 0' }}>{scanErr}</p>}
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
      </div>
    </AppShell>
  );
}
