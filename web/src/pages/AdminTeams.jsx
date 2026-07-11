/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DIVISIONS = ['U11','U12','U13','U14','U15','U16','U19','First_Team'];

export default function AdminTeams() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [name, setName] = useState('');
  const [division, setDivision] = useState('U11');
  const [sport, setSport] = useState('soccer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const [{ data: tm }, { data: co }] = await Promise.all([
      supabase.from('teams').select('id,name,division,sport,coach_id').order('division'),
      supabase.from('users').select('id,name').eq('role', 'coach').order('name'),
    ]);
    setTeams(tm || []);
    setCoaches(co || []);
  }
  useEffect(() => { if (!session?.demo) load(); }, []);

  async function addTeam(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const { error } = await supabase.from('teams').insert({ name, division, sport, org_id: profile?.org_id });
      if (error) { setErr(error.message); return; }
      setName(''); await load();
    } finally { setBusy(false); }
  }

  async function assignCoach(teamId, coachId) {
    await supabase.from('teams').update({ coach_id: coachId || null }).eq('id', teamId);
    load();
  }

  async function deleteTeam(teamId, teamName) {
    if (!window.confirm(`Delete ${teamName}? Players stay in the academy (unassigned), but the team's schedule, matches, lineups, stats and announcements are removed. This cannot be undone.`)) return;
    setErr('');
    const { error } = await supabase.rpc('delete_team', { p_team: teamId });
    if (error) { setErr(error.message); return; }
    load();
  }

  const noOrg = !session?.demo && profile && !profile.org_id;

  return (
    <AppShell role="admin" active="Teams" title="Teams">
      {session?.demo && <div className="badge badge-success" style={{ marginBottom: 16 }}>Demo mode — sign in with a real admin to save teams</div>}
      {noOrg && <div className="card" style={{ marginBottom: 16 }}>Create your academy on the Dashboard first, then add teams here.</div>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h4>Add a team</h4>
          <form onSubmit={addTeam}>
            <div className="field"><label className="label">Team name</label>
              <input className="input" placeholder="e.g. U15 Boys" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label className="label">Division</label>
              <select className="select" value={division} onChange={(e) => setDivision(e.target.value)}>
                {DIVISIONS.map((d) => <option key={d} value={d}>{d.replace('_',' ')}</option>)}</select></div>
            <div className="field"><label className="label">Sport</label>
              <select className="select" value={sport} onChange={(e) => setSport(e.target.value)}>
                {['soccer','rugby','cricket','chess'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
            <button className="btn btn-primary btn-block" disabled={busy || !name.trim() || noOrg}>{busy ? 'Saving…' : 'Add team'}</button>
          </form>
        </div>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Your teams</h4><span className="badge badge-neutral">{teams.length}</span></div>
          {teams.length === 0
            ? <p className="subtle">No teams yet. Add your first team.</p>
            : <table className="table"><thead><tr><th>Name</th><th>Division</th><th>Coach</th><th></th></tr></thead>
                <tbody>{teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td><td>{t.division.replace('_',' ')}</td>
                    <td>
                      <select className="select" style={{ minHeight: 34, padding: '4px 8px' }}
                        value={t.coach_id || ''} onChange={(e) => assignCoach(t.id, e.target.value)}>
                        <option value="">— Unassigned —</option>
                        {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td><button className="btn btn-ghost" style={{ minHeight: 32, padding: '2px 8px', color: 'var(--danger)' }} title="Delete team" onClick={() => deleteTeam(t.id, t.name)}>🗑</button></td>
                  </tr>
                ))}</tbody>
              </table>}
          {coaches.length === 0 && !session?.demo &&
            <p className="subtle" style={{ marginTop: 10 }}>No coaches yet — have a coach register, then assign them here.</p>}
        </div>
      </div>
    </AppShell>
  );
}
