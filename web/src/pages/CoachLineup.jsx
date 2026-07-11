/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

const FORMATIONS = {
  '4-4-2':   ['GK','RB','CB','CB','LB','RM','CM','CM','LM','ST','ST'],
  '4-3-3':   ['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW'],
  '4-2-3-1': ['GK','RB','CB','CB','LB','CDM','CDM','CAM','RW','LW','ST'],
  '3-5-2':   ['GK','CB','CB','CB','RWB','CM','CM','CM','LWB','ST','ST'],
  '3-4-3':   ['GK','CB','CB','CB','RM','CM','CM','LM','RW','ST','LW'],
  '5-3-2':   ['GK','RWB','CB','CB','CB','LWB','CM','CM','CM','ST','ST'],
  '4-5-1':   ['GK','RB','CB','CB','LB','RM','CM','CM','CM','LM','ST'],
};
const DEF = ['RB','LB','CB','RWB','LWB'];
const MID = ['RM','LM','CM','CDM','CAM'];
const FWD = ['RW','LW','ST'];
const slotCat = (l) => l === 'GK' ? 'GK' : DEF.includes(l) ? 'DEF' : MID.includes(l) ? 'MID' : FWD.includes(l) ? 'FWD' : 'MID';
const POS_ORDER = ['GK','RB','RWB','CB','LB','LWB','CDM','CM','RM','LM','CAM','RW','ST','LW'];
const posIndex = (lbl) => { const i = POS_ORDER.indexOf(lbl); return i < 0 ? 99 : i; };
const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const playerCat = (pos = '') => {
  const s = (pos || '').toLowerCase();
  if (/keep|goal|\bgk\b/.test(s)) return 'GK';
  if (/back|def|centre-half|\bcb\b|\brb\b|\blb\b|\bwb\b|sweeper/.test(s)) return 'DEF';
  if (/strik|forward|wing|attack|\bcf\b|\bst\b/.test(s)) return 'FWD';
  if (/mid|\bcm\b|\bdm\b|\bam\b|playmaker/.test(s)) return 'MID';
  return 'MID';
};

export default function CoachLineup() {
  const { profile, session } = useAuth();
  const [params] = useSearchParams();
  const wantMatch = params.get('match');

  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [matches, setMatches] = useState([]);
  const [matchId, setMatchId] = useState('');
  const [players, setPlayers] = useState([]);
  const [sel, setSel] = useState({});
  const [mode, setMode] = useState('edit');   // 'view' | 'edit'

  const [opponent, setOpponent] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [homeAway, setHomeAway] = useState('Home');
  const [competition, setCompetition] = useState('');
  const [formation, setFormation] = useState('4-3-3');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id);
    setTeams(t);
    if (wantMatch) {
      const { data: m } = await supabase.from('matches').select('team_id').eq('id', wantMatch).single();
      setTeamId(m?.team_id || t[0]?.id || '');
    } else if (t[0]) setTeamId(t[0].id);
  })(); }, []);

  useEffect(() => { if (!teamId) return; (async () => {
    const { data: ms } = await supabase.from('matches')
      .select('id,opponent,date,home_away,competition,formation').eq('team_id', teamId).order('date', { ascending: false });
    setMatches(ms || []);
    setPlayers(await teamPlayers(teamId));
    const pref = wantMatch && (ms || []).some((m) => m.id === wantMatch) ? wantMatch : '';
    setMatchId(pref);
    if (!pref) { resetFixture(); setMode('edit'); }
  })(); }, [teamId]);

  useEffect(() => { loadLineup(matchId); }, [matchId, matches]);

  async function loadLineup(id) {
    if (!id) { setSel({}); setMode('edit'); return; }
    const m = matches.find((x) => x.id === id);
    if (m) {
      setOpponent(m.opponent || '');
      setDateTime(m.date ? toLocalInput(m.date) : '');
      setHomeAway(m.home_away || 'Home');
      setCompetition(m.competition || '');
      setFormation(m.formation && FORMATIONS[m.formation] ? m.formation : '4-3-3');
    }
    const { data } = await supabase.from('match_lineups').select('player_id,status,position,is_captain').eq('match_id', id);
    const map = {}; (data || []).forEach((r) => { map[r.player_id] = { status: r.status, position: r.position || '', captain: !!r.is_captain }; });
    setSel(map);
    setMode((data && data.length) ? 'view' : 'edit');   // existing lineup -> show the run-down first
  }

  function resetFixture() {
    setOpponent(''); setDateTime(''); setHomeAway('Home'); setCompetition(''); setFormation('4-3-3'); setSel({});
  }

  function setStatus(pid, status) {
    setSel((s) => {
      const cur = s[pid] || { position: '', captain: false };
      let position = cur.position;
      if (status === 'starter' && !position) { const p = players.find((x) => x.id === pid); position = p?.position || ''; }
      const captain = status === 'starter' ? cur.captain : false;
      return { ...s, [pid]: { status, position, captain } };
    });
  }
  const setPos = (pid, position) => setSel((s) => ({ ...s, [pid]: { ...(s[pid] || { status: 'starter', captain: false }), position } }));
  const setCaptain = (pid) => setSel((s) => {
    const next = {};
    Object.keys(s).forEach((k) => { next[k] = { ...s[k], captain: false }; });
    next[pid] = { ...(s[pid] || { status: 'starter', position: '' }), status: 'starter', captain: true };
    return next;
  });

  function autoPick() {
    const slots = FORMATIONS[formation];
    const remaining = [...players];
    const takeByCat = (need) => { const i = remaining.findIndex((p) => playerCat(p.position) === need); return i >= 0 ? remaining.splice(i, 1)[0] : null; };
    const filled = slots.map((label) => ({ label, player: takeByCat(slotCat(label)) }));
    filled.forEach((f) => { if (!f.player && remaining.length) f.player = remaining.shift(); });
    const next = {};
    filled.forEach((f) => { if (f.player) next[f.player.id] = { status: 'starter', position: f.label, captain: false }; });
    remaining.forEach((p) => { next[p.id] = { status: 'bench', position: '', captain: false }; });
    setSel(next); setMsg(''); setErr('');
  }

  const startersList = players.filter((p) => sel[p.id]?.status === 'starter');
  const benchList = players.filter((p) => sel[p.id]?.status === 'bench');
  const startersSorted = [...startersList].sort((a, b) => posIndex(sel[a.id]?.position) - posIndex(sel[b.id]?.position));
  const need = FORMATIONS[formation].length;
  const shape = ['GK','DEF','MID','FWD'].map((c) => `${c} ${FORMATIONS[formation].filter((l) => slotCat(l) === c).length}`).join(' · ');

  async function save() {
    setBusy(true); setErr(''); setMsg('');
    try {
      if (!opponent.trim()) { setErr('Add the opponent you are facing.'); return; }
      if (!dateTime) { setErr('Choose the date the match is played.'); return; }
      const meta = { team_id: teamId, opponent: opponent.trim(), date: new Date(dateTime).toISOString(), home_away: homeAway, competition: competition.trim() || null, formation };
      let id = matchId;
      if (id) {
        const { error } = await supabase.from('matches').update(meta).eq('id', id);
        if (error) { setErr(error.message); return; }
      } else {
        const { data, error } = await supabase.from('matches').insert(meta).select('id').single();
        if (error) { setErr(error.message); return; }
        id = data.id;
      }
      const rows = []; const removeIds = [];
      players.forEach((p) => {
        const s = sel[p.id];
        if (s && s.status) rows.push({ match_id: id, player_id: p.id, status: s.status, position: s.position || null, is_captain: !!s.captain });
        else removeIds.push(p.id);
      });
      if (removeIds.length) await supabase.from('match_lineups').delete().eq('match_id', id).in('player_id', removeIds);
      if (rows.length) {
        const { error } = await supabase.from('match_lineups').upsert(rows, { onConflict: 'match_id,player_id' });
        if (error) { setErr(error.message); return; }
      }
      const { data: ms } = await supabase.from('matches')
        .select('id,opponent,date,home_away,competition,formation').eq('team_id', teamId).order('date', { ascending: false });
      setMatches(ms || []);
      setMatchId(id);
      setMode('view');
      setMsg('');
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Matches" title="Lineup"><div className="card">Demo mode — sign in as a real coach to build lineups.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Matches" title="Lineup"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  // ---------- READ-ONLY RUN-DOWN ----------
  if (matchId && mode === 'view') {
    return (
      <AppShell role="coach" active="Matches" title="Match Lineup">
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header">
            <h4 style={{ margin: 0 }}>vs {opponent}</h4>
            <button className="btn btn-secondary" style={{ minHeight: 34, padding: '6px 14px' }} onClick={() => { setMsg(''); setErr(''); setMode('edit'); }}>✎ Edit</button>
          </div>
          <div className="subtle" style={{ fontSize: 13 }}>
            {dateTime ? new Date(dateTime).toLocaleString() : '—'} · {homeAway}{competition ? ` · ${competition}` : ''}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="badge badge-info">Formation {formation}</span>
            <span className="badge badge-neutral">Shape {shape}</span>
            <span className="badge badge-success">{startersList.length} starting</span>
            <span className="badge badge-neutral">{benchList.length} bench</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header"><h4 style={{ margin: 0 }}>Starting XI</h4><span className="badge badge-success">{startersList.length}</span></div>
          {startersSorted.length === 0 ? <p className="subtle">No starters set.</p> : (
            <div className="stack" style={{ gap: 2 }}>
              {startersSorted.map((p) => (
                <div key={p.id} className="row between" style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="row"><span className="avatar">{initials(p.name)}</span> <span>{p.name}{sel[p.id]?.captain ? <strong style={{ color: 'var(--energy)' }}> · © Captain</strong> : ''}</span></span>
                  <span className="badge badge-neutral" style={{ minWidth: 46, textAlign: 'center' }}>{sel[p.id]?.position || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Bench</h4><span className="badge badge-neutral">{benchList.length}</span></div>
          {benchList.length === 0 ? <p className="subtle">No players on the bench.</p> : (
            <div className="stack" style={{ gap: 2 }}>
              {benchList.map((p) => (
                <div key={p.id} className="row" style={{ padding: '9px 0', borderTop: '1px solid var(--border)', gap: 10 }}>
                  <span className="avatar">{initials(p.name)}</span> <span>{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // ---------- EDITABLE BUILDER ----------
  const controls = (p) => {
    const s = sel[p.id] || {};
    return (
      <div key={p.id} className="row between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap', gap: 8 }}>
        <span className="row" style={{ minWidth: 150 }}>
          <span className="avatar">{p.name.split(' ').map((w) => w[0]).join('')}</span>
          <span>{p.name}{p.position ? <span className="subtle" style={{ fontSize: 12 }}> · {p.position}</span> : null}</span>
        </span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="segmented">
            <button type="button" aria-selected={s.status === 'starter'} onClick={() => setStatus(p.id, 'starter')}>Start</button>
            <button type="button" aria-selected={s.status === 'bench'} onClick={() => setStatus(p.id, 'bench')}>Bench</button>
            <button type="button" aria-selected={!s.status} onClick={() => setStatus(p.id, '')}>—</button>
          </div>
          {s.status === 'starter' && (
            <>
              <input className="input" style={{ width: 100, minHeight: 34 }} placeholder="Pos" value={s.position || ''} onChange={(e) => setPos(p.id, e.target.value)} />
              <button type="button" className={`btn ${s.captain ? 'btn-primary' : 'btn-ghost'}`} style={{ minHeight: 34, padding: '4px 10px' }}
                title="Set as captain" onClick={() => setCaptain(p.id)}>{s.captain ? '© Captain' : 'Ⓒ'}</button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppShell role="coach" active="Matches" title="Match Lineup">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Fixture</h4>
          {matchId && <button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => loadLineup(matchId)}>Cancel</button>}
        </div>
        <div className="grid grid-2" style={{ marginBottom: 10 }}>
          <div className="field" style={{ margin: 0 }}><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Load / new fixture</label>
            <select className="select" value={matchId} onChange={(e) => { setMatchId(e.target.value); if (!e.target.value) resetFixture(); }}>
              <option value="">＋ New fixture</option>
              {matches.map((m) => <option key={m.id} value={m.id}>vs {m.opponent} · {new Date(m.date).toLocaleDateString()}</option>)}
            </select></div>
        </div>
        <div className="grid grid-2">
          <div className="field" style={{ margin: 0 }}><label className="label">Opponent / team facing</label>
            <input className="input" placeholder="e.g. Coastal Academy" value={opponent} onChange={(e) => setOpponent(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Date &amp; kickoff</label>
            <input className="input" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Home / Away</label>
            <select className="select" value={homeAway} onChange={(e) => setHomeAway(e.target.value)}>
              <option>Home</option><option>Away</option><option>Neutral</option></select></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Competition (optional)</label>
            <input className="input" placeholder="e.g. League / Friendly / Cup" value={competition} onChange={(e) => setCompetition(e.target.value)} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}><label className="label">Formation</label>
            <select className="select" value={formation} onChange={(e) => setFormation(e.target.value)}>
              {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
          <button type="button" className="btn btn-secondary" onClick={autoPick}>⚙ Auto-pick XI from positions</button>
        </div>
        <p className="subtle" style={{ margin: '10px 0 0', fontSize: 13 }}>Shape: {shape}. Auto-pick slots players into the formation using each player’s saved position, then you can fine-tune below.</p>
      </div>

      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>Squad</h4>
          <div className="row" style={{ gap: 8 }}>
            <span className={`badge ${startersList.length === need ? 'badge-success' : 'badge-warning'}`}>{startersList.length}/{need} starting</span>
            <span className="badge badge-neutral">{benchList.length} bench</span></div></div>

        {players.length === 0 ? <p className="subtle">No players on this team yet.</p> : (
          <div className="stack" style={{ gap: 8 }}>
            {[...players].sort((a, b) => {
              const rank = (p) => sel[p.id]?.status === 'starter' ? 0 : sel[p.id]?.status === 'bench' ? 1 : 2;
              return rank(a) - rank(b);
            }).map((p) => controls(p))}
          </div>
        )}
        {startersList.length !== need && <p className="subtle" style={{ color: 'var(--energy)', fontSize: 13, marginTop: 10 }}>
          A {formation} needs {need} starters — you have {startersList.length}.</p>}
        {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
        {msg && <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{msg}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : (matchId ? 'Save lineup' : 'Create fixture & save lineup')}</button>
      </div>
    </AppShell>
  );
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
