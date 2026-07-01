import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

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

function LiveCoach() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [squad, setSquad] = useState([]);

  useEffect(() => { (async () => {
    const t = await myTeams(profile.id);
    setTeams(t);
    if (t[0]) setTeamId(t[0].id);
  })(); }, []);

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
    let stats = [];
    if (mIds.length) { const { data } = await supabase.from('player_match_stats').select('player_id,minutes_played,rating').in('match_id', mIds); stats = data || []; }
    setSquad(players.map((p) => {
      const a = att.filter((x) => x.player_id === p.id);
      const rate = total ? Math.round(a.filter((x) => x.attended).length / total * 100) : 0;
      const st = stats.filter((x) => x.player_id === p.id);
      const avg = st.length ? (st.reduce((n, x) => n + Number(x.rating || 0), 0) / st.length).toFixed(1) : '—';
      return { ...p, rate, avg, sessions: total };
    }));
  }

  if (teams.length === 0) {
    return <div className="card">You have no teams assigned yet. Ask your academy admin to assign you to a team.</div>;
  }

  return (
    <>
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label className="label">Team</label>
          <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
          </select>
        </div>
        <div className="row" style={{ gap: 10, alignSelf: 'end' }}>
          <Link to="/coach/training" className="btn btn-primary">➕ Log training</Link>
          <Link to="/coach/match" className="btn btn-secondary">⚽ Log match</Link>
        </div>
      </div>

      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Squad</h4><span className="badge badge-neutral">{squad.length}</span></div>
        {squad.length === 0
          ? <p className="subtle">No players on this team yet.</p>
          : <table className="table"><thead><tr><th>Player</th><th>Position</th><th>Attendance</th><th>Avg rating</th><th>Rank</th></tr></thead>
              <tbody>{squad.map((p) => (
                <tr key={p.id}>
                  <td><span className="row"><span className="avatar">{p.name.split(' ').map((w)=>w[0]).join('')}</span> {p.name}</span></td>
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
