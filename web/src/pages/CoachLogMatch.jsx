/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
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
const endOfWeek = () => { const d = new Date(); d.setHours(23, 59, 59, 999); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d; };

export default function CoachLogMatch() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [matches, setMatches] = useState([]);
  const [lineups, setLineups] = useState({});   // match_id -> starters count
  const [showForm, setShowForm] = useState(false);

  // add-match form
  const [opponent, setOpponent] = useState('');
  const [dt, setDt] = useState('');
  const [homeAway, setHomeAway] = useState('Home');
  const [competition, setCompetition] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  // result editor
  const [resultFor, setResultFor] = useState('');
  const [resultText, setResultText] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) loadMatches(); }, [teamId]);

  async function loadMatches() {
    const { data } = await supabase.from('matches')
      .select('id,opponent,date,home_away,venue,competition,formation,result')
      .eq('team_id', teamId).order('date', { ascending: false });
    setMatches(data || []);
    const ids = (data || []).map((m) => m.id);
    if (ids.length) {
      const { data: ln } = await supabase.from('match_lineups').select('match_id,status').in('match_id', ids);
      const map = {};
      (ln || []).forEach((r) => { if (r.status === 'starter') map[r.match_id] = (map[r.match_id] || 0) + 1; });
      setLineups(map);
    } else setLineups({});
  }

  async function addMatch(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const { data: m, error } = await supabase.from('matches')
        .insert({ team_id: teamId, opponent: opponent.trim(), date: new Date(dt).toISOString(), home_away: homeAway, venue: homeAway, competition: competition.trim() || null })
        .select('id').single();
      if (error) { setErr(error.message); return; }
      if (notify) {
        const team = teams.find((t) => t.id === teamId);
        await supabase.rpc('notify_team', { p_team: teamId, p_message: `New fixture: ${team?.name} vs ${opponent} — ${whenLabel(dt)} (${homeAway})`, p_ref_type: 'match', p_ref_id: m.id });
      }
      setMsg('Match added. Tap it below to set the lineup.');
      setOpponent(''); setDt(''); setCompetition(''); setShowForm(false);
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

  async function saveResult(id, e) {
    if (e) e.stopPropagation();
    const { error } = await supabase.from('matches').update({ result: resultText.trim() || null }).eq('id', id);
    if (error) { setErr(error.message); return; }
    setResultFor(''); setResultText(''); await loadMatches();
  }

  if (session?.demo) return <AppShell role="coach" active="Matches" title="Matches"><div className="card">Demo mode — sign in as a real coach to manage matches.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Matches" title="Matches"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const eow = endOfWeek();
  const upcoming = matches.filter((m) => new Date(m.date) >= startToday).sort((a, b) => new Date(a.date) - new Date(b.date));
  const thisWeek = upcoming.filter((m) => new Date(m.date) <= eow);
  const later = upcoming.filter((m) => new Date(m.date) > eow);
  const past = matches.filter((m) => new Date(m.date) < startToday);

  const lineupBadge = (m) => {
    const n = lineups[m.id] || 0;
    if (n === 0) return <span className="badge badge-neutral">No lineup</span>;
    if (n >= 11) return <span className="badge badge-success">✓ XI set</span>;
    return <span className="badge badge-warning">{n}/11 set</span>;
  };

  const card = (m, opts = {}) => (
    <div key={m.id} onClick={() => openLineup(m.id)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') openLineup(m.id); }}
      style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer',
        borderLeft: isToday(m.date) ? '4px solid var(--energy)' : '1px solid var(--border)',
        background: isToday(m.date) ? 'var(--surface-2)' : 'var(--surface)' }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
        <div>
          <strong>vs {m.opponent}</strong>
          <div className="subtle" style={{ fontSize: 13 }}>{whenLabel(m.date)}{m.home_away ? ` · ${m.home_away}` : ''}{m.competition ? ` · ${m.competition}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {isToday(m.date) && <span className="badge badge-warning">Today</span>}
          {m.formation && <span className="badge badge-info">{m.formation}</span>}
          {!opts.past && lineupBadge(m)}
          {opts.past && m.result && <span className="badge badge-neutral">🏁 {m.result}</span>}
          <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px', color: 'var(--danger)' }}
            onClick={(e) => removeMatch(m.id, e)} title="Cancel match">🗑</button>
        </div>
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="subtle" style={{ fontSize: 12 }}>📋 Tap to set formation, starting XI &amp; bench</span>
        <span className="subtle" style={{ fontSize: 16 }}>›</span>
      </div>

      {opts.past && (resultFor === m.id ? (
        <div className="row" style={{ gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
          <input className="input" style={{ minHeight: 34, flex: 1 }} placeholder="e.g. W 2-1 / 1-1 / L 0-3" value={resultText} onChange={(e) => setResultText(e.target.value)} />
          <button type="button" className="btn btn-primary" style={{ minHeight: 34 }} onClick={(e) => saveResult(m.id, e)}>Save</button>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 34 }} onClick={(e) => { e.stopPropagation(); setResultFor(''); }}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" style={{ minHeight: 30, padding: '4px 10px', marginTop: 8 }}
          onClick={(e) => { e.stopPropagation(); setResultFor(m.id); setResultText(m.result || ''); }}>🏁 {m.result ? 'Edit result' : 'Add result'}</button>
      ))}
    </div>
  );

  const groupHeader = (t) => <div className="subtle" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 0' }}>{t}</div>;

  return (
    <AppShell role="coach" active="Matches" title="Matches">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        {/* Team + add toggle */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div className="field" style={{ margin: 0, minWidth: 200 }}><label className="label">Team</label>
              <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <button type="button" className="btn btn-primary" style={{ alignSelf: 'end', minHeight: 40 }} onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : '＋ Add match'}</button>
          </div>
          {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 10 }}>{msg}</p>}
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</p>}
        </div>

        {showForm && (
          <form className="card" onSubmit={addMatch} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px' }}>⚽ Add a match</h4>
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
            <label className="row" style={{ gap: 8, marginTop: 10 }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>Notify players &amp; parents</span>
            </label>
            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={busy || !opponent.trim() || !dt}>{busy ? 'Adding…' : 'Add match'}</button>
          </form>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header"><h4 style={{ margin: 0 }}>Upcoming matches</h4><span className="badge badge-neutral">{upcoming.length}</span></div>
          <p className="subtle" style={{ marginTop: 0, fontSize: 13 }}>Tap a match to prepare the lineup — formation, starting XI and bench.</p>
          {upcoming.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No upcoming matches. Tap “＋ Add match”.</p>
            : <div className="stack" style={{ gap: 10 }}>
                {thisWeek.length > 0 && <>{groupHeader('This week')}{thisWeek.map((m) => card(m))}</>}
                {later.length > 0 && <>{groupHeader('Later')}{later.map((m) => card(m))}</>}
              </div>}
        </div>

        {past.length > 0 && (
          <div className="card">
            <div className="section-header"><h4 style={{ margin: 0 }}>Past matches</h4><span className="badge badge-neutral">{past.length}</span></div>
            <div className="stack" style={{ gap: 10 }}>{past.slice(0, 15).map((m) => card(m, { past: true }))}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
