import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

export default function CoachLogTraining() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [players, setPlayers] = useState([]);
  const [present, setPresent] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) (async () => {
    const p = await teamPlayers(teamId); setPlayers(p);
    setPresent(Object.fromEntries(p.map((x) => [x.id, true])));
  })(); }, [teamId]);

  async function save(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true);
    try {
      const { data: ts, error } = await supabase.from('training_sessions')
        .insert({ team_id: teamId, coach_id: profile.id, date, notes }).select().single();
      if (error) { setErr(error.message); return; }
      const rows = players.map((p) => ({ session_id: ts.id, player_id: p.id, attended: !!present[p.id] }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('attendance').insert(rows);
        if (e2) { setErr(e2.message); return; }
      }
      await supabase.rpc('recompute_team_ranks', { p_team: teamId });
      setOk(`Saved — ${rows.filter((r) => r.attended).length}/${rows.length} present. Ranks updated.`);
      setNotes('');
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Log Training" title="Log Training"><div className="card">Demo mode — sign in as a real coach to log training.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Log Training" title="Log Training"><div className="card">No teams assigned yet.</div></AppShell>;

  return (
    <AppShell role="coach" active="Log Training" title="Log Training">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <form className="card" onSubmit={save}>
          <div className="grid grid-2">
            <div className="field"><label className="label">Team</label>
              <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="field"><label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>

          <h4 style={{ marginTop: 8 }}>Attendance</h4>
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

          <div className="field" style={{ marginTop: 12 }}><label className="label">Session note (optional)</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          {ok &&  <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{ok}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !players.length}>{busy ? 'Saving…' : 'Save session'}</button>
        </form>
      </div>
    </AppShell>
  );
}
