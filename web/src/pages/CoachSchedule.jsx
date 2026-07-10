/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams } from '../lib/coach.js';

export default function CoachSchedule() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [upcoming, setUpcoming] = useState([]);
  const [rsvps, setRsvps] = useState({});
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  // fixture form
  const [opponent, setOpponent] = useState('');
  const [fDate, setFDate] = useState('');
  const [venue, setVenue] = useState('Home');
  // practice form
  const [pDate, setPDate] = useState('');
  const [location, setLocation] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) loadUpcoming(); }, [teamId]);

  async function loadUpcoming() {
    const nowIso = new Date().toISOString();
    const [{ data: matches }, { data: practices }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date,venue').eq('team_id', teamId).gte('date', nowIso),
      supabase.from('training_sessions').select('id,starts_at,location,notes').eq('team_id', teamId).not('starts_at', 'is', null).gte('starts_at', nowIso),
    ]);
    const items = [
      ...(matches || []).map((m) => ({ id: 'm' + m.id, kind: 'match', rawId: m.id, type: 'Match', when: m.date, title: `vs ${m.opponent}`, where: m.venue })),
      ...(practices || []).map((p) => ({ id: 'p' + p.id, kind: 'practice', rawId: p.id, type: 'Practice', when: p.starts_at, title: p.notes || 'Training', where: p.location })),
    ].sort((a, b) => new Date(a.when) - new Date(b.when));
    setUpcoming(items);

    const ids = items.map((i) => i.rawId);
    if (ids.length) {
      const { data: r } = await supabase.from('event_rsvps')
        .select('event_type,event_id,status,reason,players(users(name))').in('event_id', ids);
      const map = {};
      (r || []).forEach((x) => {
        const k = `${x.event_type}:${x.event_id}`;
        map[k] = map[k] || { going: 0, absent: [] };
        if (x.status === 'going') map[k].going += 1;
        else map[k].absent.push({ name: x.players?.users?.name || 'Player', reason: x.reason });
      });
      setRsvps(map);
    } else setRsvps({});
  }

  async function addFixture(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const { error } = await supabase.from('matches').insert({ team_id: teamId, opponent, date: fDate, venue });
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId, p_message: `New fixture: ${team?.name} vs ${opponent} — ${new Date(fDate).toLocaleString()} (${venue})` });
      }
      setMsg('Fixture scheduled.'); setOpponent(''); setFDate(''); loadUpcoming();
    } finally { setBusy(false); }
  }

  async function addPractice(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const { error } = await supabase.from('training_sessions').insert({
        team_id: teamId, coach_id: profile.id, date: pDate.slice(0, 10), starts_at: pDate, location, notes: pNotes,
      });
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId, p_message: `Practice: ${team?.name} — ${new Date(pDate).toLocaleString()}${location ? ' at ' + location : ''}` });
      }
      setMsg('Practice scheduled.'); setPDate(''); setLocation(''); setPNotes(''); loadUpcoming();
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Schedule" title="Schedule"><div className="card">Demo mode — sign in as a real coach to schedule.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Schedule" title="Schedule"><div className="card">No teams assigned yet.</div></AppShell>;

  return (
    <AppShell role="coach" active="Schedule" title="Schedule">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ margin: 0, minWidth: 200 }}>
            <label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
            </select>
          </div>
          <label className="row" style={{ gap: 8, alignSelf: 'end' }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>Notify players &amp; parents</span>
          </label>
        </div>
        {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={addPractice}>
          <h4>🏃 Schedule a practice</h4>
          <div className="field"><label className="label">Date &amp; time</label>
            <input className="input" type="datetime-local" value={pDate} onChange={(e) => setPDate(e.target.value)} /></div>
          <div className="field"><label className="label">Location</label>
            <input className="input" placeholder="e.g. Main Pitch" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="field"><label className="label">Focus / notes</label>
            <input className="input" placeholder="e.g. Fitness + set pieces" value={pNotes} onChange={(e) => setPNotes(e.target.value)} /></div>
          <button className="btn btn-primary btn-block" disabled={busy || !pDate}>{busy ? 'Saving…' : 'Schedule practice'}</button>
        </form>

        <form className="card" onSubmit={addFixture}>
          <h4>⚽ Schedule a fixture</h4>
          <div className="field"><label className="label">Opponent</label>
            <input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} /></div>
          <div className="field"><label className="label">Date &amp; time</label>
            <input className="input" type="datetime-local" value={fDate} onChange={(e) => setFDate(e.target.value)} /></div>
          <div className="field"><label className="label">Venue</label>
            <select className="select" value={venue} onChange={(e) => setVenue(e.target.value)}>{['Home','Away'].map((v) => <option key={v}>{v}</option>)}</select></div>
          <button className="btn btn-secondary btn-block" disabled={busy || !opponent.trim() || !fDate}>{busy ? 'Saving…' : 'Schedule fixture'}</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Upcoming</h4><span className="badge badge-neutral">{upcoming.length}</span></div>
        {upcoming.length === 0 ? <p className="subtle">Nothing scheduled yet.</p> : (
          <div className="stack" style={{ gap: 10 }}>
            {upcoming.map((u) => (
              <div key={u.id} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <div className="row between">
                  <div>
                    <strong>{u.title}</strong>
                    <div className="subtle" style={{ fontSize: 13 }}>{new Date(u.when).toLocaleString()}{u.where ? ` · ${u.where}` : ''}</div>
                  </div>
                  <span className={`badge ${u.type === 'Match' ? 'badge-info' : 'badge-success'}`}>{u.type}</span>
                </div>
                {u.type === 'Match' && <Link to={`/coach/lineup?match=${u.rawId}`} className="btn btn-secondary" style={{ minHeight: 30, padding: '4px 10px', marginTop: 6 }}>📋 Set lineup</Link>}
                {u.type === 'Practice' && <Link to={`/coach/checkin?session=${u.rawId}`} className="btn btn-secondary" style={{ minHeight: 30, padding: '4px 10px', marginTop: 6 }}>✅ Take attendance</Link>}
                {(() => {
                  const r = rsvps[`${u.kind}:${u.rawId}`];
                  if (!r) return <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>No availability responses yet.</div>;
                  return (
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      <span className="badge badge-success" style={{ marginRight: 8 }}>✓ {r.going} going</span>
                      {r.absent.length > 0 && (
                        <span className="badge badge-warning">✗ {r.absent.length} out</span>
                      )}
                      {r.absent.map((a, i) => (
                        <div key={i} className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
                          ✗ {a.name}{a.reason ? ` — ${a.reason}` : ''}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
