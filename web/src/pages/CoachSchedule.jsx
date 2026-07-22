/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams } from '../lib/coach.js';

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const endOfWeek = () => { const d = new Date(); d.setHours(23, 59, 59, 999); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d; };

export default function CoachSchedule() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [rsvps, setRsvps] = useState({});
  const [showForms, setShowForms] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  // fixture form
  const [opponent, setOpponent] = useState('');
  const [fDate, setFDate] = useState('');
  const [homeAway, setHomeAway] = useState('Home');
  const [competition, setCompetition] = useState('');
  // practice form
  const [pDate, setPDate] = useState('');
  const [location, setLocation] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [notify, setNotify] = useState(true);
  // other-event form
  const [eTitle, setETitle] = useState('');
  const [eType, setEType] = useState('Meeting');
  const [eDate, setEDate] = useState('');
  const [eLoc, setELoc] = useState('');
  const [eNotes, setENotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) { loadUpcoming(); setShowPast(false); setPast([]); } }, [teamId]);

  function mapItems(matches, practices, events) {
    return [
      ...(matches || []).map((m) => ({ id: 'm' + m.id, kind: 'match', rawId: m.id, type: 'Match', when: m.date, title: `vs ${m.opponent}`, where: m.venue || m.home_away })),
      ...(practices || []).map((p) => ({ id: 'p' + p.id, kind: 'practice', rawId: p.id, type: 'Practice', when: p.starts_at, title: p.notes || 'Training', where: p.location })),
      ...(events || []).map((e) => ({ id: 'e' + e.id, kind: 'event', rawId: e.id, type: e.event_type, when: e.starts_at, title: e.title, where: e.location })),
    ];
  }

  async function loadUpcoming() {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const fromIso = startToday.toISOString();
    const [{ data: matches }, { data: practices }, { data: events }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date,venue,home_away').eq('team_id', teamId).gte('date', fromIso),
      supabase.from('training_sessions').select('id,starts_at,location,notes').eq('team_id', teamId).not('starts_at', 'is', null).gte('starts_at', fromIso),
      supabase.from('team_events').select('id,title,event_type,starts_at,location').eq('team_id', teamId).gte('starts_at', fromIso),
    ]);
    const items = mapItems(matches, practices, events).sort((a, b) => new Date(a.when) - new Date(b.when));
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

  async function loadPast() {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const toIso = startToday.toISOString();
    const [{ data: matches }, { data: practices }, { data: events }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date,venue,home_away').eq('team_id', teamId).lt('date', toIso).order('date', { ascending: false }).limit(20),
      supabase.from('training_sessions').select('id,starts_at,location,notes').eq('team_id', teamId).not('starts_at', 'is', null).lt('starts_at', toIso).order('starts_at', { ascending: false }).limit(20),
      supabase.from('team_events').select('id,title,event_type,starts_at,location').eq('team_id', teamId).lt('starts_at', toIso).order('starts_at', { ascending: false }).limit(20),
    ]);
    setPast(mapItems(matches, practices, events).sort((a, b) => new Date(b.when) - new Date(a.when)));
    setShowPast(true);
  }

  const openLog = (u) => {
    if (u.kind === 'event') return;                      // general events have nothing to log
    if (u.kind === 'practice') return navigate(`/coach/checkin?session=${u.rawId}`);
    return navigate(`/coach/lineup?match=${u.rawId}`);
  };

  async function removeEvent(u, e) {
    if (e) e.stopPropagation();
    const label = u.kind === 'match' ? 'Cancel this match? Players will be notified, it disappears from their schedule, and its lineup is deleted.'
      : u.kind === 'event' ? 'Cancel this event? Players will be notified.'
      : 'Cancel this training session? Players will be notified and its attendance is removed.';
    if (!window.confirm(label)) return;
    setErr('');
    const { error } = u.kind === 'match'
      ? await supabase.rpc('delete_match', { p_id: u.rawId })
      : u.kind === 'event'
      ? await supabase.rpc('delete_team_event', { p_id: u.rawId })
      : await supabase.rpc('delete_training_session', { p_session_id: u.rawId });
    if (error) { setErr(error.message); return; }
    loadUpcoming(); if (showPast) loadPast();
  }

  async function addEvent(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('');
    try {
      const { data: ev, error } = await supabase.from('team_events')
        .insert({ team_id: teamId, coach_id: profile.id, title: eTitle.trim(), event_type: eType,
                  starts_at: eDate, location: eLoc.trim() || null, notes: eNotes.trim() || null })
        .select('id').single();
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId,
          p_message: `${eType}: ${eTitle} — ${new Date(eDate).toLocaleString()}${eLoc ? ' at ' + eLoc : ''} (${team?.name || 'team'})`,
          p_ref_type: 'event', p_ref_id: ev.id });
      }
      setMsg('Event added to the schedule and calendar.');
      setETitle(''); setEDate(''); setELoc(''); setENotes('');
      loadUpcoming();
    } finally { setBusy(false); }
  }

  async function addFixture(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const { data: m, error } = await supabase.from('matches')
        .insert({ team_id: teamId, opponent, date: fDate, home_away: homeAway, venue: homeAway, competition: competition.trim() || null })
        .select('id').single();
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId, p_message: `New fixture: ${team?.name} vs ${opponent} — ${new Date(fDate).toLocaleString()} (${homeAway})`, p_ref_type: 'match', p_ref_id: m.id });
      }
      setMsg('Fixture scheduled.'); setOpponent(''); setFDate(''); setCompetition(''); loadUpcoming();
    } finally { setBusy(false); }
  }

  async function addPractice(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const { data: s, error } = await supabase.from('training_sessions')
        .insert({ team_id: teamId, coach_id: profile.id, date: pDate.slice(0, 10), starts_at: pDate, location, notes: pNotes })
        .select('id').single();
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId, p_message: `Practice: ${team?.name} — ${new Date(pDate).toLocaleString()}${location ? ' at ' + location : ''}`, p_ref_type: 'practice', p_ref_id: s.id });
      }
      setMsg('Practice scheduled.'); setPDate(''); setLocation(''); setPNotes(''); loadUpcoming();
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Schedule" title="Schedule"><div className="card">Demo mode — sign in as a real coach to schedule.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Schedule" title="Schedule"><div className="card">No teams assigned yet.</div></AppShell>;

  const eow = endOfWeek();
  const thisWeek = upcoming.filter((u) => new Date(u.when) <= eow);
  const later = upcoming.filter((u) => new Date(u.when) > eow);

  const card = (u, canDelete = true) => (
    <div key={u.id} onClick={() => openLog(u)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openLog(u); }}
      style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer',
        borderLeft: isToday(u.when) ? '4px solid var(--energy)' : '1px solid var(--border)', background: isToday(u.when) ? 'var(--surface-2)' : 'var(--surface)' }}>
      <div className="row between">
        <div>
          <strong>{u.title}</strong>
          <div className="subtle" style={{ fontSize: 13 }}>{new Date(u.when).toLocaleString()}{u.where ? ` · ${u.where}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {isToday(u.when) && <span className="badge badge-warning">Today</span>}
          <span className={`badge ${u.kind === 'match' ? 'badge-info' : u.kind === 'event' ? 'badge-neutral' : 'badge-success'}`}>{u.kind === 'event' ? `📌 ${u.type}` : u.type}</span>
          {canDelete && <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px', color: 'var(--danger)' }} title="Delete" onClick={(e) => removeEvent(u, e)}>🗑</button>}
        </div>
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="subtle" style={{ fontSize: 12 }}>{u.kind === 'practice' ? '✅ Tap to take attendance' : '📋 Tap to set lineup'}</span>
        <span className="subtle" style={{ fontSize: 16 }}>›</span>
      </div>
      {(() => {
        const r = rsvps[`${u.kind}:${u.rawId}`];
        if (!r) return null;
        return (
          <div style={{ fontSize: 13, marginTop: 6 }}>
            <span className="badge badge-success" style={{ marginRight: 8 }}>✓ {r.going} going</span>
            {r.absent.length > 0 && <span className="badge badge-warning">✗ {r.absent.length} out</span>}
            {r.absent.map((a, i) => <div key={i} className="subtle" style={{ fontSize: 12, marginTop: 4 }}>✗ {a.name}{a.reason ? ` — ${a.reason}` : ''}</div>)}
          </div>
        );
      })()}
    </div>
  );

  const groupHeader = (t) => <div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 0' }}>{t}</div>;

  return (
    <AppShell role="coach" active="Schedule" title="Schedule">
      {/* Team + notify */}
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

      {/* Collapsible add forms */}
      {showForms && (
        <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
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
            <div className="field"><label className="label">Home / Away</label>
              <select className="select" value={homeAway} onChange={(e) => setHomeAway(e.target.value)}>{['Home','Away','Neutral'].map((v) => <option key={v}>{v}</option>)}</select></div>
            <div className="field"><label className="label">Competition (optional)</label>
              <input className="input" placeholder="League / Cup / Friendly" value={competition} onChange={(e) => setCompetition(e.target.value)} /></div>
            <button className="btn btn-secondary btn-block" disabled={busy || !opponent.trim() || !fDate}>{busy ? 'Saving…' : 'Schedule fixture'}</button>
          </form>

          <form className="card" onSubmit={addEvent} style={{ gridColumn: '1 / -1' }}>
            <h4>📌 Schedule another event</h4>
            <p className="subtle" style={{ fontSize: 13, marginTop: 0 }}>Meetings, trials, fitness tests, socials — anything that isn’t training or a match.</p>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="field" style={{ margin: 0 }}><label className="label">Title</label>
                <input className="input" placeholder="e.g. Parents meeting" value={eTitle} onChange={(e) => setETitle(e.target.value)} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Type</label>
                <select className="select" value={eType} onChange={(e) => setEType(e.target.value)}>
                  {['Meeting','Trial','Fitness test','Social','Tournament','Other'].map((v) => <option key={v}>{v}</option>)}
                </select></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Date &amp; time</label>
                <input className="input" type="datetime-local" value={eDate} onChange={(e) => setEDate(e.target.value)} /></div>
              <div className="field" style={{ margin: 0 }}><label className="label">Location (optional)</label>
                <input className="input" placeholder="e.g. Clubhouse" value={eLoc} onChange={(e) => setELoc(e.target.value)} /></div>
            </div>
            <div className="field"><label className="label">Notes (optional)</label>
              <input className="input" placeholder="e.g. Bring boots and a water bottle" value={eNotes} onChange={(e) => setENotes(e.target.value)} /></div>
            <button className="btn btn-primary btn-block" disabled={busy || !eTitle.trim() || !eDate}>{busy ? 'Saving…' : 'Schedule event'}</button>
          </form>
        </div>
      )}

      {/* Upcoming */}
      <div className="card">
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Upcoming <span className="badge badge-neutral">{upcoming.length}</span></h4>
          <button type="button" className="btn btn-primary" style={{ minHeight: 34 }} onClick={() => setShowForms((v) => !v)}>{showForms ? 'Close' : '＋ Schedule'}</button>
        </div>
        <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>Tap a card to log attendance (training) or set the lineup (match).</p>
        {upcoming.length === 0 ? <p className="subtle">Nothing scheduled yet. Tap “＋ Schedule”.</p> : (
          <div className="stack" style={{ gap: 10 }}>
            {thisWeek.length > 0 && <>{groupHeader('This week')}{thisWeek.map((u) => card(u))}</>}
            {later.length > 0 && <>{groupHeader('Later')}{later.map((u) => card(u))}</>}
          </div>
        )}

        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {!showPast
            ? <button type="button" className="btn btn-ghost" onClick={loadPast}>Show past events</button>
            : <>
                <div className="row between"><strong style={{ fontSize: 13 }}>Past events</strong>
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 28 }} onClick={() => { setShowPast(false); setPast([]); }}>Hide</button></div>
                {past.length === 0 ? <p className="subtle" style={{ margin: '8px 0 0' }}>No past events.</p>
                  : <div className="stack" style={{ gap: 10, marginTop: 8, opacity: .85 }}>{past.map((u) => card(u))}</div>}
              </>}
        </div>
      </div>
    </AppShell>
  );
}
