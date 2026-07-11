/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const genCode = () => 'PIQ-' + Math.random().toString(36).slice(2, 7).toUpperCase();

export default function AdminPlayers() {
  const { session, profile } = useAuth();
  const [roster, setRoster] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pick, setPick] = useState({});          // user_id -> team_id chosen in the assign dropdown
  const [assigning, setAssigning] = useState('');
  const [form, setForm] = useState({ name: '', team_id: '', position: '', dob: '', medical: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [lastCode, setLastCode] = useState('');

  async function load() {
    const [{ data: rp }, { data: tm }] = await Promise.all([
      supabase.rpc('admin_list_players'),
      supabase.from('teams').select('id,name,division').order('division'),
    ]);
    setRoster(rp || []);
    setTeams(tm || []);
  }
  useEffect(() => { if (!session?.demo) load(); }, []);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function assign(userId) {
    const teamId = pick[userId];
    if (!teamId) return;
    setAssigning(userId); setErr(''); setMsg('');
    try {
      const { error } = await supabase.rpc('admin_assign_player', { p_user_id: userId, p_team_id: teamId });
      if (error) { setErr(error.message); return; }
      setMsg('Player assigned to a team.');
      await load();
    } finally { setAssigning(''); }
  }

  async function addPlayer(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const child_code = genCode();
      const { data: u, error: ue } = await supabase.from('users')
        .insert({ name: form.name, email: `${child_code.toLowerCase()}@player.pitchiq.local`, role: 'player' })
        .select().single();
      if (ue) { setErr(ue.message); return; }
      const { error } = await supabase.from('players').insert({
        user_id: u.id,
        team_id: form.team_id || null,
        position: form.position || null,
        date_of_birth: form.dob || null,
        medical_notes: form.medical || null,
        child_code,
      });
      if (error) { setErr(error.message); return; }
      setLastCode(child_code);
      setForm({ name: '', team_id: '', position: '', dob: '', medical: '' });
      await load();
    } finally { setBusy(false); }
  }

  const noOrg = !session?.demo && profile && !profile.org_id;
  const pending = roster.filter((r) => r.needs_team);
  const assigned = roster.filter((r) => !r.needs_team);

  return (
    <AppShell role="admin" active="Players" title="Players">
      {session?.demo && <div className="badge badge-success" style={{ marginBottom: 16 }}>Demo mode — sign in with a real admin to manage players</div>}
      {noOrg && <div className="card" style={{ marginBottom: 16 }}>Create your academy on the Dashboard first.</div>}
      {msg && <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--success)' }}>{msg}</div>}
      {lastCode && <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--green-600)' }}>
        Player created. Child code for the parent to link: <strong>{lastCode}</strong></div>}
      {err && <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>{err}</div>}

      {/* New registrations awaiting a team */}
      <div className="card" style={{ marginBottom: 16, borderLeft: pending.length ? '4px solid var(--energy)' : undefined }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>New registrations — awaiting a team</h4>
          <span className={`badge ${pending.length ? 'badge-warning' : 'badge-neutral'}`}>{pending.length}</span>
        </div>
        {pending.length === 0
          ? <p className="subtle" style={{ margin: 0 }}>Everyone who registered has been assigned to a team. 🎉</p>
          : <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Assign to team</th><th></th></tr></thead>
              <tbody>{pending.map((r) => (
                <tr key={r.user_id}>
                  <td><span className="row"><span className="avatar">{(r.name || '?').split(' ').map((w)=>w[0]).join('').slice(0,2)}</span> {r.name || '—'}</span></td>
                  <td className="subtle">{r.email}</td>
                  <td>
                    <select className="select" value={pick[r.user_id] || ''} onChange={(e) => setPick((p) => ({ ...p, [r.user_id]: e.target.value }))}>
                      <option value="">— Choose team —</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
                    </select>
                  </td>
                  <td><button className="btn btn-primary" style={{ minHeight: 38 }} disabled={!pick[r.user_id] || assigning === r.user_id} onClick={() => assign(r.user_id)}>
                    {assigning === r.user_id ? 'Assigning…' : 'Assign'}</button></td>
                </tr>
              ))}</tbody>
            </table>}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h4>Add a player manually</h4>
          <form onSubmit={addPlayer}>
            <div className="field"><label className="label">Full name</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="field"><label className="label">Team</label>
              <select className="select" value={form.team_id} onChange={(e) => set('team_id', e.target.value)}>
                <option value="">— Unassigned —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
              </select></div>
            <div className="field"><label className="label">Position</label>
              <input className="input" placeholder="e.g. Winger" value={form.position} onChange={(e) => set('position', e.target.value)} /></div>
            <div className="field"><label className="label">Date of birth</label>
              <input className="input" type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} /></div>
            <div className="field"><label className="label">Medical notes (optional)</label>
              <textarea className="textarea" value={form.medical} onChange={(e) => set('medical', e.target.value)} /></div>
            <button className="btn btn-primary btn-block" disabled={busy || !form.name.trim() || noOrg}>{busy ? 'Saving…' : 'Add player'}</button>
          </form>
        </div>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Assigned players</h4><span className="badge badge-neutral">{assigned.length}</span></div>
          {assigned.length === 0
            ? <p className="subtle">No players assigned to a team yet.</p>
            : <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Team</th><th>Rank</th></tr></thead>
                <tbody>{assigned.map((p) => (
                  <tr key={p.user_id}>
                    <td><Link to={`/admin/player/${p.player_id}`} style={{ color: 'inherit' }}><span style={{ textDecoration: 'underline', fontWeight: 600 }}>{p.name || '—'}</span></Link></td>
                    <td className="subtle">{p.email}</td>
                    <td>{p.team_name || '—'}</td>
                    <td><span className="badge badge-neutral">{(p.rank_level || 'Rookie').replace('_',' ')}</span></td>
                  </tr>
                ))}</tbody>
              </table>}
        </div>
      </div>
    </AppShell>
  );
}
