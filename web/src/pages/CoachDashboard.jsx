/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, squadWithStats } from '../lib/coach.js';
import CoachCalendar from '../components/CoachCalendar.jsx';
import StatCard from '../components/StatCard.jsx';
import InsightCards from '../components/InsightCards.jsx';
import { teamInsights } from '../lib/insights.js';

const DIVISIONS = ['U11','U12','U13','U14','U15','U16','U19','First_Team'];
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfWeek = () => { const d = new Date(); d.setHours(23,59,59,999); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d; };
const whenLabel = (d) => new Date(d).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();

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

// One row in the "Needs attention" panel.
function ActionRow({ icon, tone, label, title, meta, cta, onClick, to }) {
  const inner = (
    <div className="row between" style={{ flexWrap: 'wrap', gap: 8, width: '100%' }}>
      <div className="row" style={{ gap: 10, minWidth: 200, textAlign: 'left' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div className="subtle" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
          <strong>{title}</strong>
          {meta && <div className="subtle" style={{ fontSize: 12 }}>{meta}</div>}
        </div>
      </div>
      <span className="row" style={{ gap: 6 }}>
        <span className="btn btn-secondary" style={{ minHeight: 32, padding: '4px 10px', pointerEvents: 'none' }}>{cta}</span>
        <span className="subtle" style={{ fontSize: 16 }}>›</span>
      </span>
    </div>
  );
  const style = { width: '100%', border: '1px solid var(--border)', borderLeft: `4px solid ${tone}`,
                  borderRadius: 12, padding: '10px 12px', background: 'var(--surface)', cursor: 'pointer', display: 'block', textDecoration: 'none', color: 'inherit' };
  if (to) return <Link to={to} style={style}>{inner}</Link>;
  return <button type="button" onClick={onClick} style={style}>{inner}</button>;
}

function LiveCoach() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [squad, setSquad] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [upcoming, setUpcoming] = useState([]);      // sessions + matches this week
  const [unlogged, setUnlogged] = useState([]);      // past sessions with no attendance
  const [recentAnn, setRecentAnn] = useState([]);
  const [insights, setInsights] = useState([]);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [allInsights, setAllInsights] = useState(false);

  async function reloadTeams(selectId) {
    const t = await myTeams(profile.id);
    setTeams(t);
    setTeamId(selectId || t[0]?.id || '');
    return t;
  }
  useEffect(() => { reloadTeams(); }, []);
  useEffect(() => { if (teamId) load(teamId); }, [teamId]);

  async function load(tid) {
    const sq = await squadWithStats(tid);
    setSquad(sq);

    setInsightsBusy(true);
    teamInsights(tid, sq).then((r) => { setInsights(r); setInsightsBusy(false); });

    const fromIso = startOfToday().toISOString();
    const eowIso = endOfWeek().toISOString();

    const [{ data: um }, { data: up }, { data: allSessions }, { data: matches }, { data: anns }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date,venue,competition').eq('team_id', tid).gte('date', fromIso).lte('date', eowIso).order('date'),
      supabase.from('training_sessions').select('id,notes,starts_at,location').eq('team_id', tid).not('starts_at','is',null).gte('starts_at', fromIso).lte('starts_at', eowIso).order('starts_at'),
      supabase.from('training_sessions').select('id,notes,starts_at,date').eq('team_id', tid).lt('starts_at', fromIso).order('starts_at', { ascending: false }).limit(10),
      supabase.from('matches').select('id').eq('team_id', tid),
      supabase.from('announcements').select('id,title,created_at').eq('team_id', tid).order('created_at', { ascending: false }).limit(3),
    ]);

    setMatchCount((matches || []).length);
    setRecentAnn(anns || []);

    const ev = [
      ...(um || []).map((m) => ({ kind: 'match', id: m.id, when: new Date(m.date), title: 'vs ' + m.opponent, where: m.venue })),
      ...(up || []).map((s) => ({ kind: 'practice', id: s.id, when: new Date(s.starts_at), title: s.notes || 'Training', where: s.location })),
    ].sort((a, b) => a.when - b.when);
    setUpcoming(ev);

    // past sessions with zero attendance rows = outstanding
    const past = allSessions || [];
    if (past.length) {
      const { data: att } = await supabase.from('attendance').select('session_id').in('session_id', past.map((s) => s.id));
      const logged = new Set((att || []).map((a) => a.session_id));
      setUnlogged(past.filter((s) => !logged.has(s.id)).slice(0, 5));
    } else setUnlogged([]);
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

  const unavailable = squad.filter((p) => p.unavailable);
  const avgAtt = squad.some((p) => p.rate != null)
    ? Math.round(squad.filter((p) => p.rate != null).reduce((n, p) => n + p.rate, 0) / squad.filter((p) => p.rate != null).length)
    : null;
  const actionCount = upcoming.length + unlogged.length + unavailable.length;

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
          <Link to="/coach/squad" className="btn btn-secondary">👥 Squad</Link>
          <Link to="/coach/training" className="btn btn-primary">➕ Log training</Link>
        </div>
      </div>

      {/* ---------- Needs attention ---------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Needs attention</h4>
          {actionCount > 0 && <span className="badge badge-warning">{actionCount}</span>}
        </div>

        {actionCount === 0 ? (
          <div style={{ padding: '10px 0' }}>
            <p style={{ margin: 0 }}>✅ You’re all caught up — nothing needs attention right now.</p>
            <p className="subtle" style={{ margin: '4px 0 0', fontSize: 13 }}>Nothing scheduled this week? <Link to="/coach/schedule">Add a session or fixture →</Link></p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {unlogged.map((s) => (
              <ActionRow key={'u' + s.id} icon="⚠️" tone="var(--danger)" label="Attendance outstanding"
                title={s.notes || 'Training session'}
                meta={s.starts_at ? whenLabel(s.starts_at) : (s.date || '')}
                cta="Log now" onClick={() => navigate(`/coach/checkin?session=${s.id}`)} />
            ))}

            {upcoming.map((e) => (
              <ActionRow key={e.kind + e.id} icon={e.kind === 'match' ? '⚽' : '🏃'}
                tone={e.kind === 'match' ? 'var(--energy)' : 'var(--success)'}
                label={isToday(e.when) ? `Today · ${e.kind === 'match' ? 'Match' : 'Training'}` : (e.kind === 'match' ? 'Upcoming match' : 'Upcoming training')}
                title={e.title}
                meta={`${whenLabel(e.when)}${e.where ? ' · ' + e.where : ''}`}
                cta={e.kind === 'match' ? '📋 Lineup' : '✅ Attendance'}
                onClick={() => navigate(e.kind === 'match' ? `/coach/lineup?match=${e.id}` : `/coach/checkin?session=${e.id}`)} />
            ))}

            {unavailable.map((p) => (
              <ActionRow key={'b' + p.id} icon="🩹" tone={p.injury ? 'var(--danger)' : '#f59e0b'} label={p.injury ? 'Player injured' : 'Player unavailable'}
                title={p.name} meta={p.injury ? `${p.injury.injury_type}${p.injury.expected_return ? ' · back ' + new Date(p.injury.expected_return).toLocaleDateString() : ''}` : (p.benchReason || 'Marked unavailable')}
                cta="View profile" to={`/coach/player/${p.id}`} />
            ))}
          </div>
        )}

        {recentAnn.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>📣 Recent announcements</strong>
              <Link to="/coach/announcements" className="subtle" style={{ fontSize: 12 }}>See all →</Link>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {recentAnn.map((a) => (
                <div key={a.id} className="row between">
                  <span style={{ fontSize: 13 }}>{a.title}</span>
                  <span className="subtle" style={{ fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Stats (secondary) ---------- */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Squad size" value={squad.length} />
        <StatCard label="Avg attendance" value={avgAtt == null ? '—' : `${avgAtt}%`} />
        <StatCard label="Matches played" value={matchCount} />
        <StatCard label="Unavailable" value={unavailable.length} />
      </div>

      {/* ---------- What stands out ---------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>💡 What stands out</h4>
          {insights.length > 3 && (
            <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }}
              onClick={() => setAllInsights((v) => !v)}>
              {allInsights ? 'Show less' : `Show all ${insights.length}`}
            </button>
          )}
        </div>
        <InsightCards items={allInsights ? insights : insights.slice(0, 3)} loading={insightsBusy}
          empty="Not enough data yet — log a few sessions and matches and insights will appear here." />
        <p className="subtle" style={{ fontSize: 12, margin: '10px 0 0' }}>
          Prompts for your judgement, not verdicts.
        </p>
      </div>

      <CoachCalendar teamIds={teams.map((t) => t.id)} />

      <div className="card">
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <strong>👥 Squad</strong>
            <div className="subtle" style={{ fontSize: 13 }}>{squad.length} player{squad.length === 1 ? '' : 's'} — search, filter and sort on the Squad page.</div>
          </div>
          <Link to="/coach/squad" className="btn btn-primary" style={{ minHeight: 38 }}>Open squad →</Link>
        </div>
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
