/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

export default function CoachAnnouncements() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [players, setPlayers] = useState([]);
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [audience, setAudience] = useState('team');   // 'team' | 'selected'
  const [picked, setPicked] = useState({});           // player_id -> bool
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) { load(); loadPlayers(); } }, [teamId]);

  async function loadPlayers() { setPlayers(await teamPlayers(teamId)); setPicked({}); }
  async function load() {
    const { data } = await supabase.from('announcements')
      .select('id,title,body,created_at,file_name,file_path,mime').eq('team_id', teamId)
      .order('created_at', { ascending: false }).limit(30);
    setList(data || []);
    const ids = (data || []).map((a) => a.id);
    if (ids.length) {
      const { data: r } = await supabase.from('announcement_recipients').select('announcement_id').in('announcement_id', ids);
      const counts = {}; (r || []).forEach((x) => { counts[x.announcement_id] = (counts[x.announcement_id] || 0) + 1; });
      setList((data || []).map((a) => ({ ...a, recipients: counts[a.id] || 0 })));
    }
  }

  async function post(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      let file_path = null, file_name = null, mime = null;
      if (file) {
        if (file.size > 200 * 1024 * 1024) { setErr('File too large (max 200MB).'); return; }
        const safe = file.name.replace(/[^\w.\-]/g, '_');
        file_path = `${teamId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from('announcement-files').upload(file_path, file, { contentType: file.type || undefined });
        if (upErr) { setErr(upErr.message); return; }
        file_name = file.name; mime = file.type || null;
      }
      const playerIds = audience === 'selected' ? Object.keys(picked).filter((k) => picked[k]) : [];
      if (audience === 'selected' && playerIds.length === 0) { setErr('Pick at least one player, or switch to the whole team.'); return; }
      const { error } = await supabase.rpc('send_announcement', {
        p_team: teamId, p_title: title, p_body: body, p_file_path: file_path, p_file_name: file_name, p_mime: mime, p_player_ids: playerIds,
      });
      if (error) { setErr(error.message); return; }
      setMsg(audience === 'selected' ? `Sent to ${playerIds.length} player${playerIds.length === 1 ? '' : 's'}.` : 'Sent to the whole team.');
      setTitle(''); setBody(''); setFile(null); setPicked({}); setAudience('team');
      load();
    } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this announcement? It will also disappear from the players.')) return;
    const { error } = await supabase.rpc('delete_announcement', { p_id: id });
    if (error) { setErr(error.message); return; }
    load();
  }

  if (session?.demo) return <AppShell role="coach" active="Announcements" title="Announcements"><div className="card">Demo mode — sign in as a real coach to post announcements.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Announcements" title="Announcements"><div className="card">No teams assigned yet.</div></AppShell>;

  return (
    <AppShell role="coach" active="Announcements" title="Announcements">
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={post}>
          <h4>📣 Post an announcement</h4>
          <div className="field"><label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
            </select></div>
          <div className="field"><label className="label">Title</label>
            <input className="input" placeholder="e.g. This week's training plan" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label className="label">Details (optional)</label>
            <textarea className="input" rows={3} placeholder="Anything the players should know…" value={body} onChange={(e) => setBody(e.target.value)} /></div>

          <div className="field"><label className="label">Attach a file or photo (optional)</label>
            <input className="input" type="file" accept="image/*,application/pdf,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <p className="subtle" style={{ fontSize: 12, margin: '4px 0 0' }}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB</p>}
          </div>

          <div className="field"><label className="label">Send to</label>
            <div className="segmented">
              <button type="button" aria-selected={audience === 'team'} onClick={() => setAudience('team')}>Whole team</button>
              <button type="button" aria-selected={audience === 'selected'} onClick={() => setAudience('selected')}>Selected players</button>
            </div>
          </div>
          {audience === 'selected' && (
            <div className="card" style={{ background: 'var(--surface-2)', border: 0, marginBottom: 12, maxHeight: 220, overflowY: 'auto' }}>
              {players.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No players on this team.</p> : players.map((p) => (
                <label key={p.id} className="row" style={{ gap: 8, padding: '6px 0' }}>
                  <input type="checkbox" checked={!!picked[p.id]} onChange={(e) => setPicked((s) => ({ ...s, [p.id]: e.target.checked }))} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          )}

          {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, margin: '0 0 10px' }}>{msg}</p>}
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || (!title.trim() && !file)}>{busy ? 'Sending…' : 'Send announcement'}</button>
        </form>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Sent</h4><span className="badge badge-neutral">{list.length}</span></div>
          {list.length === 0 ? <p className="subtle">Nothing sent yet.</p> : (
            <div className="stack" style={{ gap: 12 }}>
              {list.map((a) => (
                <div key={a.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div className="row between">
                    <strong>{a.title || a.file_name || 'Attachment'}</strong>
                    <button className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} title="Delete" onClick={() => remove(a.id)}>✕</button>
                  </div>
                  {a.body && <p style={{ margin: '4px 0 0' }}>{a.body}</p>}
                  {a.file_name && <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>📎 {a.file_name}</div>}
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
                    {new Date(a.created_at).toLocaleString()} · {a.recipients ? `🎯 ${a.recipients} player${a.recipients === 1 ? '' : 's'}` : 'Whole team'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
