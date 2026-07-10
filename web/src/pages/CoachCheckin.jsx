/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams } from '../lib/coach.js';

const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function CoachCheckin() {
  const { profile, session } = useAuth();
  const [params] = useSearchParams();
  const wantSession = params.get('session');

  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [roster, setRoster] = useState([]);
  const [action, setAction] = useState('in');       // 'in' | 'out'
  const [manual, setManual] = useState('');
  const [last, setLast] = useState('');
  const [err, setErr] = useState('');
  const [scanning, setScanning] = useState(false);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);
  const lastScanRef = useRef({ code: '', t: 0 });
  const actionRef = useRef('in');
  useEffect(() => { actionRef.current = action; }, [action]);

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); return stopCam; }, []);

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
      p_session_id: sessionId, p_code: (code || '').trim(), p_action: actionRef.current, p_method: method,
    });
    if (error) { setErr(error.message); try { navigator.vibrate?.(200); } catch (_e) {} return; }
    setLast(`${data.name} — ${actionRef.current === 'out' ? 'checked out' : 'checked in'} ${fmt(actionRef.current === 'out' ? data.checkout_at : data.checkin_at)}`);
    try { navigator.vibrate?.(60); } catch (_e) {}
    loadRoster();
  }

  function onManual(e) {
    e.preventDefault();
    if (!manual.trim()) return;
    record(manual, 'manual');
    setManual('');
  }

  async function startCam() {
    setErr('');
    if (!supported) { setErr('Camera scanning isn’t supported on this browser — use the code box below.'); return; }
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
              record(val, 'qr');
            }
          }
        } catch (_e) { /* frame decode noise */ }
        if (runningRef.current) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) { setErr('Camera error: ' + (e.message || e)); }
  }
  function stopCam() {
    runningRef.current = false; setScanning(false);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  if (session?.demo) return <AppShell role="coach" active="Check-in" title="Check-in"><div className="card">Demo mode — sign in as a real coach to take attendance.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Check-in" title="Check-in"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  const present = roster.filter((r) => r.present).length;

  return (
    <AppShell role="coach" active="Check-in" title="Practice Check-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => { stopCam(); setTeamId(e.target.value); }}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Practice session</label>
            <select className="select" value={sessionId} onChange={(e) => { stopCam(); setSessionId(e.target.value); }}>
              {sessions.length === 0 && <option value="">No practices — schedule one first</option>}
              {sessions.map((s) => <option key={s.id} value={s.id}>
                {(s.starts_at ? new Date(s.starts_at).toLocaleString() : s.date) + (s.notes ? ` · ${s.notes}` : '')}
              </option>)}</select></div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label" style={{ margin: 0 }}>Mode:</span>
          <div className="segmented">
            <button type="button" aria-selected={action === 'in'} onClick={() => setAction('in')}>Check in</button>
            <button type="button" aria-selected={action === 'out'} onClick={() => setAction('out')}>Check out</button>
          </div>
        </div>
      </div>

      {/* Scanner */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Scan player QR</h4>
          {scanning ? <button className="btn btn-ghost" onClick={stopCam}>Stop camera</button>
                    : <button className="btn btn-primary" onClick={startCam} disabled={!sessionId}>📷 Start camera</button>}</div>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', display: scanning ? 'block' : 'none' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 320, objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: '18% 22%', border: '3px solid rgba(255,255,255,.9)', borderRadius: 12 }} />
        </div>
        {!supported && <p className="subtle" style={{ fontSize: 13, margin: '4px 0 0' }}>This browser can’t scan QR codes. Use the code box below — it works everywhere.</p>}

        <form onSubmit={onManual} className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Or type student code, e.g. PIQ-EAG3"
            value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="btn btn-secondary" disabled={!manual.trim() || !sessionId}>{action === 'out' ? 'Check out' : 'Check in'}</button>
        </form>
        {last && <p style={{ color: 'var(--green-700)', fontSize: 14, margin: '10px 0 0', fontWeight: 600 }}>✓ {last}</p>}
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0 0' }}>{err}</p>}
      </div>

      {/* Roster */}
      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Attendance</h4>
          <span className="badge badge-success">{present}/{roster.length} present</span></div>
        {roster.length === 0 ? <p className="subtle">No players on this team, or no session selected.</p> : (
          <div className="stack" style={{ gap: 6 }}>
            {roster.map((r) => (
              <div key={r.player_id} className="row between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap', gap: 8 }}>
                <span className="row" style={{ minWidth: 150 }}>
                  <span className="avatar">{(r.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                  <span>{r.name}<span className="subtle" style={{ fontSize: 12 }}> · {r.child_code}</span></span>
                </span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {r.present
                    ? <span className="badge badge-success">✓ In {fmt(r.checkin_at)}{r.checkout_at ? ` · Out ${fmt(r.checkout_at)}` : ''}</span>
                    : <span className="badge badge-neutral">Not in</span>}
                  {r.method === 'manual' && <span className="badge badge-warning">manual</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
