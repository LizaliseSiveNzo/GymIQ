/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams } from '../lib/coach.js';

const isToday = (iso) => iso && new Date(iso).toDateString() === new Date().toDateString();
const whenLabel = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function CoachLogMatch() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [matches, setMatches] = useState([]);

  // add-match form
  const [opponent, setOpponent] = useState('');
  const [dt, setDt] = useState('');
  const [homeAway, setHomeAway] = useState('Home');
  const [competition, setCompetition] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) loadMatches(); }, [teamId]);

  async function loadMatches() {
    const { data } = await supabase.from('matches')
      .select('id,opponent,date,home_away,venue,competition,formation,result')
      .eq('team_id', teamId).order('date', { ascending: false });
    setMatches(data || []);
  }

  async function addMatch(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const { data: m, error } = await supabase.from('matches')
        .insert({ team_id: teamId, opponent: opponent.trim(), date: new Date(dt).toISOString(), home_away: homeAway, competition: competition.trim() || null })
        .select('id').single();
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId, p_message: `New fixture: ${team?.name} vs ${opponent} — ${whenLabel(dt)} (${homeAway})`, p_ref_type: 'match', p_ref_id: m.id });
      }
      setMsg('Match added. Tap it below to set the lineup.');
      setOpponent(''); setDt(''); setCompetition('');
      await loadMatches();
    } finally { setBusy(false); }
  }

  const openLineup = (id) => navigate(`/coach/lineup?match=${id}`);

  async function removeMatch(id, e) {
    if (e) e.stopPropagation();
    if (!window.confirm('Cancel this match? Players will be notified, it disappears from their schedule, and its lineup is deleted.')) return;
    const { error } = await supabase.rpc('delete_match', { p_id: id });
    if (error) { setErr(error.message); return; }
    await loadMatches();
  }

  if (session?.demo) return <AppShell role="coach" active="Matches" title="Matches"><div className="card">Demo mode — sign in as a real coach to manage matches.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Matches" title="Matches"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const upcoming = matches.filter((m) => new Date(m.date) >= startToday).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = matches.filter((m) => new Date(m.date) < startToday);

  const card = (m) => (
    <div key={m.id} onClick={() => openLineup(m.id)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') openLineup(m.id); }}
      style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer',
        borderLeft: isToday(m.date) ? '4px solid var(--energy)' : '1px solid var(--border)',
        background: isToday(m.date) ? 'var(--surface-2)' : 'var(--surface)' }}>
      <div className="row between">
        <div>
          <strong>vs {m.opponent}</strong>
          <div className="subtle" style={{ fontSize: 13 }}>{whenLabel(m.date)}{m.home_away ? ` · ${m.home_away}` : ''}{m.competition ? ` · ${m.competition}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {isToday(m.date) && <span className="badge badge-warning">Today</span>}
          {m.formation && <span className="badge badge-info">{m.formation}</span>}
          <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px', color: 'var(--danger)' }}
            onClick={(e) => removeMatch(m.id, e)} title="Remove match">🗑</button>
        </div>
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="subtle" style={{ fontSize: 12 }}>📋 Tap to set formation, starting XI &amp; bench</span>
        <span className="subtle" style={{ fontSize: 16 }}>›</span>
      </div>
    </div>
  );

  return (
    <AppShell role="coach" active="Matches" title="Matches">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <form className="card" onSubmit={addMatch} style={{ marginBottom: 16 }}>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <div className="field" style={{ margin: 0, minWidth: 200 }}><label className="label">Team</label>
              <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <label className="row" style={{ gap: 8, alignSelf: 'end' }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>Notify players &amp; parents</span>
            </label>
          </div>
          <h4 style={{ margin: '4px 0 8px' }}>⚽ Add a match</h4>
          <div className="grid grid-2">
            <div className="field" style={{ margin: 0 }}><label className="label">Opponent</label>
              <input className="input" placeholder="e.g. Coastal Academy" value={opponent} onChange={(e) => setOpponent(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Date &amp; kickoff</label>
              <input className="input" type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Home / Away</label>
              <select className="select" value={homeAway} onChange={(e) => setHomeAway(e.target.value)}>
                <option>Home</option><option>Away</option><option>Neutral</option></select></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Competition (optional)</label>
              <input className="input" placeholder="League / Cup / Friendly" value={competition} onChange={(e) => setCompetition(e.target.value)} /></div>
          </div>
          {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || !opponent.trim() || !dt}>{busy ? 'Adding…' : 'Add match'}</button>
        </form>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header"><h4 style={{ margin: 0 }}>Upcoming matches</h4><span className="badge badge-neutral">{upcoming.length}</span></div>
          <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>Tap a match to prepare the lineup — formation, starting positions and bench.</p>
          {upcoming.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No upcoming matches. Add one above.</p>
            : <div className="stack" style={{ gap: 10 }}>{upcoming.map(card)}</div>}
        </div>

        {past.length > 0 && (
          <div className="card">
            <div className="section-header"><h4 style={{ margin: 0 }}>Past matches</h4><span className="badge badge-neutral">{past.length}</span></div>
            <div className="stack" style={{ gap: 10 }}>{past.slice(0, 10).map(card)}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
