import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

const blank = () => ({ minutes: 0, goals: 0, assists: 0, rating: '' });

export default function CoachLogMatch() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState('');
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) (async () => {
    const p = await teamPlayers(teamId); setPlayers(p);
    setStats(Object.fromEntries(p.map((x) => [x.id, blank()])));
  })(); }, [teamId]);

  function setStat(pid, k, v) { setStats((s) => ({ ...s, [pid]: { ...s[pid], [k]: v } })); }

  async function save(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      const { data: match, error } = await supabase.from('matches')
        .insert({ team_id: teamId, opponent, date, result }).select().single();
      if (error) { setErr(error.message); return; }
      const rows = players.map((p) => ({
        match_id: match.id, player_id: p.id,
        minutes_played: Number(stats[p.id]?.minutes) || 0,
        goals: Number(stats[p.id]?.goals) || 0,
        assists: Number(stats[p.id]?.assists) || 0,
        rating: stats[p.id]?.rating === '' ? null : Number(stats[p.id].rating),
      }));
      const { error: e2 } = await supabase.from('player_match_stats').insert(rows);
      if (e2) { setErr(e2.message); return; }
      setOk('Match logged.');
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Log Match" title="Log Match"><div className="card">Demo mode — sign in as a real coach to log a match.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Log Match" title="Log Match"><div className="card">No teams assigned yet.</div></AppShell>;

  return (
    <AppShell role="coach" active="Log Match" title="Log Match">
      <form className="card" onSubmit={save}>
        <div className="grid grid-4">
          <div className="field"><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="field"><label className="label">Opponent</label>
            <input className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)} /></div>
          <div className="field"><label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label className="label">Result</label>
            <input className="input" placeholder="e.g. 2-1" value={result} onChange={(e) => setResult(e.target.value)} /></div>
        </div>

        <h4 style={{ marginTop: 8 }}>Player stats</h4>
        {players.length === 0 ? <p className="subtle">No players on this team yet.</p> : (
          <table className="table">
            <thead><tr><th>Player</th><th>Min</th><th>Goals</th><th>Assists</th><th>Rating</th></tr></thead>
            <tbody>{players.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td><input className="input" style={{ minHeight: 34, width: 70, padding: '4px 8px' }} type="number" value={stats[p.id]?.minutes ?? 0} onChange={(e) => setStat(p.id,'minutes',e.target.value)} /></td>
                <td><input className="input" style={{ minHeight: 34, width: 60, padding: '4px 8px' }} type="number" value={stats[p.id]?.goals ?? 0} onChange={(e) => setStat(p.id,'goals',e.target.value)} /></td>
                <td><input className="input" style={{ minHeight: 34, width: 60, padding: '4px 8px' }} type="number" value={stats[p.id]?.assists ?? 0} onChange={(e) => setStat(p.id,'assists',e.target.value)} /></td>
                <td><input className="input" style={{ minHeight: 34, width: 70, padding: '4px 8px' }} type="number" step="0.1" min="0" max="5" placeholder="0-5" value={stats[p.id]?.rating ?? ''} onChange={(e) => setStat(p.id,'rating',e.target.value)} /></td>
              </tr>))}</tbody>
          </table>
        )}

        {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
        {ok &&  <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{ok}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !players.length || !opponent.trim()}>{busy ? 'Saving…' : 'Save match'}</button>
      </form>
    </AppShell>
  );
}
