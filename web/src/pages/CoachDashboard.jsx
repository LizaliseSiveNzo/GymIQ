/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';
import CoachCalendar from '../components/CoachCalendar.jsx';
import StatCard from '../components/StatCard.jsx';

const DIVISIONS = ['U11','U12','U13','U14','U15','U16','U19','First_Team'];

function DemoCoach() {
  const SQUAD = [['Thabo Mokoena','Winger','92%','4.4','Elite'],['Sipho Ndlovu','Midfield','78%','3.8','Rising Star'],['Kabelo Sithole','Defender','88%','4.1','Elite'],['Junior Adams','Striker','64%','3.2','Rookie']];
  return (
    <>
      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--green-600)' }}>
        <div className="row between">
          <div><div className="subtle" style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Today · Training</div>
            <h3 style={{ margin: '4px 0 0' }}>U15 — 16:00 at Main Pitch</h3></div>
          <button className="btn btn-primary">➕ Log session</button>
        </div>
      </div>
      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>My squad — U15</h4><span className="badge badge-warning">1 low attendance</span></div>
        <table className="table"><thead><tr><th>Player</th><th>Position</th><th>Attendance</th><th>Avg rating</th><th>Rank</th></tr></thead>
          <tbody>{SQUAD.map(([n,pos,att,r,rank]) => (
            <tr key={n}><td><span className="row"><span className="avatar">{n.split(' ').map(w=>w[0]).join('')}</span> {n}</span></td>
              <td>{pos}</td><td>{att}</td><td>{r}</td><td><span className="badge badge-neutral">{rank}</span></td></tr>))}</tbody></table>
      </div>
    </>
  );
}

function CreateTeam({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [division, setDivision] = useState('U13');
  const [sport, setSport] = useState('soccer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('create_coach_team', { p_name: name.trim(), p_division: division, p_sport: sport });
      if (error) { setErr(error.message); return; }
      onCreated?.(data);
    } finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
      <div className="section-header"><h4 style={{ margin: 0 }}>Create a team</h4>
        {onCancel && <button type="button" className="btn btn-ghost" style={{ minHeight: 32 }} onClick={onCancel}>Cancel</button>}</div>
      <div className="grid grid-3">
        <div className="field" style={{ margin: 0 }}><label className="label">Team name</label>
          <input className="input" placeholder="e.g. U13 Eagles" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field" style={{ margin: 0 }}><label className="label">Division</label>
          <select className="select" value={division} onChange={(e) => setDivision(e.target.value)}>
            {DIVISIONS.map((d) => <option key={d} value={d}>{d.replace('_',' ')}</option>)}</select></div>
        <div className="field" style={{ margin: 0 }}><label className="label">Sport</label>
          <select className="select" value={sport} onChange={(e) => setSport(e.target.value)}>
            {['soccer','rugby','cricket','chess'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</p>}
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create team'}</button>
    </form>
  );
}

function LiveCoach() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [squad, setSquad] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [nextUp, setNextUp] = useState(null);
  const [matchCount, setMatchCount] = useState(0);

  async function reloadTeams(selectId) {
    const t = await myTeams(profile.id);
    setTeams(t);
    setTeamId(selectId || t[0]?.id || '');
    return t;
  }
  useEffect(() => { reloadTeams(); }, []);
  useEffect(() => { if (teamId) loadSquad(teamId); }, [teamId]);

  async function loadSquad(tid) {
    const players = await teamPlayers(tid);
    const { data: sessions } = await supabase.from('training_sessions').select('id').eq('team_id', tid);
    const sIds = (sessions || []).map((s) => s.id);
    const total = sIds.length;
    let att = [];
    if (sIds.length) { const { data } = await supabase.from('attendance').select('player_id,attended').in('session_id', sIds); att = data || []; }
    const { data: matches } = await supabase.from('matches').select('id').eq('team_id', tid);
    const mIds = (matches || []).map((m) => m.id);
    setMatchCount(mIds.length);
    let stats = [];
    if (mIds.length) { const { data } = await supabase.from('player_match_stats').select('player_id,minutes_played,rating').in('match_id', mIds); stats = data || []; }
    // next up: soonest upcoming match or practice (from start of today)
    const fromIso = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); })();
    const [{ data: um }, { data: up }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date,venue').eq('team_id', tid).gte('date', fromIso).order('date', { ascending: true }).limit(1),
      supabase.from('training_sessions').select('id,notes,starts_at,location').eq('team_id', tid).not('starts_at', 'is', null).gte('starts_at', fromIso).order('starts_at', { ascending: true }).limit(1),
    ]);
    const cand = [];
    if (um && um[0]) cand.push({ kind: 'match', id: um[0].id, when: new Date(um[0].date), title: 'vs ' + um[0].opponent, where: um[0].venue });
    if (up && up[0]) cand.push({ kind: 'practice', id: up[0].id, when: new Date(up[0].starts_at), title: up[0].notes || 'Training', where: up[0].location });
    cand.sort((a, b) => a.when - b.when);
    setNextUp(cand[0] || null);
    setSquad(players.map((p) => {
      const a = att.filter((x) => x.player_id === p.id);
      const rate = total ? Math.round(a.filter((x) => x.attended).length / total * 100) : 0;
      const st = stats.filter((x) => x.player_id === p.id);
      const avg = st.length ? (st.reduce((n, x) => n + Number(x.rating || 0), 0) / st.length).toFixed(1) : '—';
      return { ...p, rate, avg, sessions: total };
    }));
  }

  async function onCreated(newId) { setShowCreate(false); await reloadTeams(newId); }

  if (teams === null) return <div className="card">Loading…</div>;

  if (teams.length === 0) {
    return (
      <>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Welcome, coach 👋</h3>
          <p className="subtle" style={{ margin: 0 }}>Create your first team to start logging training, matches and lineups.</p>
        </div>
        <CreateTeam onCreated={onCreated} />
      </>
    );
  }

  return (
    <>
      {showCreate && <CreateTeam onCreated={onCreated} onCancel={() => setShowCreate(false)} />}

      <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label className="label">Team</label>
          <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
          </select>
        </div>
        <div className="row" style={{ gap: 10, alignSelf: 'end', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowCreate((v) => !v)}>＋ New team</button>
          <Link to="/coach/training" className="btn btn-primary">➕ Log training</Link>
          <Link to="/coach/match" className="btn btn-secondary">⚽ Matches</Link>
        </div>
      </div>

      {(() => {
        const present = squad.filter((p) => p.sessions && p.rate >= 50).length;
        const avgAtt = squad.length && squad.some((p) => p.sessions) ? Math.round(squad.reduce((n, p) => n + (p.sessions ? p.rate : 0), 0) / squad.filter((p) => p.sessions).length || 0) : 0;
        const goTo = () => nextUp && (nextUp.kind === 'practice' ? navigate(`/coach/checkin?session=${nextUp.id}`) : navigate(`/coach/lineup?match=${nextUp.id}`));
        const isToday = nextUp && new Date(nextUp.when).toDateString() === new Date().toDateString();
        return (
          <>
            {nextUp ? (
              <div className="card" onClick={goTo} role="button" tabIndex={0}
                style={{ marginBottom: 16, cursor: 'pointer', borderLeft: `4px solid ${nextUp.kind === 'match' ? 'var(--energy)' : 'var(--green-600)'}` }}>
                <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {isToday ? 'Today' : 'Next up'} · {nextUp.kind === 'match' ? 'Match' : 'Training'}
                    </div>
                    <h3 style={{ margin: '4px 0 2px' }}>{nextUp.title}</h3>
                    <div className="subtle" style={{ fontSize: 13 }}>{new Date(nextUp.when).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{nextUp.where ? ` · ${nextUp.where}` : ''}</div>
                  </div>
                  <span className="btn btn-primary" style={{ minHeight: 38 }}>{nextUp.kind === 'match' ? '📋 Set lineup' : '✅ Take attendance'}</span>
                </div>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div><div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Next up</div>
                    <p style={{ margin: '6px 0 0' }}>Nothing scheduled. Add a session or fixture.</p></div>
                  <Link to="/coach/schedule" className="btn btn-secondary" style={{ minHeight: 38 }}>📅 Schedule</Link>
                </div>
              </div>
            )}
            <div className="grid grid-4" style={{ marginBottom: 16 }}>
              <StatCard label="Squad size" value={squad.length} />
              <StatCard label="Avg attendance" value={squad.some((p) => p.sessions) ? `${avgAtt}%` : '—'} />
              <StatCard label="Matches played" value={matchCount} />
              <StatCard label="Teams" value={teams.length} />
            </div>
          </>
        );
      })()}

      <CoachCalendar teamIds={teams.map((t) => t.id)} />

      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Squad</h4><span className="badge badge-neutral">{squad.length}</span></div>
        {squad.length === 0
          ? <p className="subtle">No players on this team yet. Ask your academy admin to add players (they’ll get a child code to link).</p>
          : <table className="table"><thead><tr><th>Player</th><th>Position</th><th>Attendance</th><th>Avg rating</th><th>Rank</th></tr></thead>
              <tbody>{squad.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/coach/player/${p.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}><span className="avatar">{p.name.split(' ').map((w)=>w[0]).join('')}</span> <span style={{ textDecoration: 'underline' }}>{p.name}</span></Link></td>
                  <td>{p.position || '—'}</td>
                  <td>{p.sessions ? `${p.rate}%` : '—'}</td>
                  <td>{p.avg}</td>
                  <td><span className="badge badge-neutral">{(p.rank || 'Rookie').replace('_',' ')}</span></td>
                </tr>))}</tbody></table>}
      </div>
    </>
  );
}

export default function CoachDashboard() {
  const { session } = useAuth();
  return (
    <AppShell role="coach" active="Dashboard" title="Coach Dashboard">
      {session?.demo ? <DemoCoach /> : <LiveCoach />}
    </AppShell>
  );
}
