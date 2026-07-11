/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

const isImage = (m) => (m || '').startsWith('image/');
const isVideo = (m) => (m || '').startsWith('video/');

export default function CoachAnnouncements() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [players, setPlayers] = useState([]);
  const [list, setList] = useState([]);
  const [urls, setUrls] = useState({});     // announcement id -> signed url
  const [openFile, setOpenFile] = useState({});   // id -> bool (inline preview)

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [pinned, setPinned] = useState(false);
  const [audience, setAudience] = useState('team');
  const [picked, setPicked] = useState({});
  const [pFilter, setPFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  // edit
  const [editId, setEditId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);
  useEffect(() => { if (teamId) { load(); loadPlayers(); } }, [teamId]);

  async function loadPlayers() { setPlayers(await teamPlayers(teamId)); setPicked({}); }

  async function load() {
    const { data } = await supabase.from('announcements')
      .select('id,title,body,created_at,file_name,file_path,mime,pinned').eq('team_id', teamId)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(30);
    const rows = data || [];
    const ids = rows.map((a) => a.id);
    let counts = {};
    if (ids.length) {
      const { data: r } = await supabase.from('announcement_recipients').select('announcement_id').in('announcement_id', ids);
      (r || []).forEach((x) => { counts[x.announcement_id] = (counts[x.announcement_id] || 0) + 1; });
    }
    setList(rows.map((a) => ({ ...a, recipients: counts[a.id] || 0 })));
    // sign attachment urls
    const map = {};
    for (const a of rows.filter((x) => x.file_path)) {
      const { data: s } = await supabase.storage.from('announcement-files').createSignedUrl(a.file_path, 3600);
      if (s?.signedUrl) map[a.id] = s.signedUrl;
    }
    setUrls(map);
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
        p_team: teamId, p_title: title, p_body: body, p_file_path: file_path, p_file_name: file_name, p_mime: mime, p_player_ids: playerIds, p_pinned: pinned,
      });
      if (error) { setErr(error.message); return; }
      setMsg(audience === 'selected' ? `Sent to ${playerIds.length} player${playerIds.length === 1 ? '' : 's'}.` : `Sent to the whole team.`);
      setTitle(''); setBody(''); setFile(null); setPicked({}); setAudience('team'); setPinned(false); setPFilter('');
      load();
    } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this announcement? It will also disappear from the players.')) return;
    const { error } = await supabase.rpc('delete_announcement', { p_id: id });
    if (error) { setErr(error.message); return; }
    load();
  }
  async function togglePin(a) {
    await supabase.rpc('set_announcement_pinned', { p_id: a.id, p_pinned: !a.pinned });
    load();
  }
  function startEdit(a) { setEditId(a.id); setEditTitle(a.title || ''); setEditBody(a.body || ''); }
  async function saveEdit(id) {
    const { error } = await supabase.rpc('update_announcement', { p_id: id, p_title: editTitle, p_body: editBody });
    if (error) { setErr(error.message); return; }
    setEditId(''); load();
  }

  if (session?.demo) return <AppShell role="coach" active="Announcements" title="Announcements"><div className="card">Demo mode — sign in as a real coach to post announcements.</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Announcements" title="Announcements"><div className="card">No teams assigned yet.</div></AppShell>;

  const filteredPlayers = players.filter((p) => p.name.toLowerCase().includes(pFilter.toLowerCase()));
  const pickedCount = Object.values(picked).filter(Boolean).length;

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

          <label className="row" style={{ gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            <span>📌 Pin as important (stays at the top for players)</span>
          </label>

          <div className="field"><label className="label">Send to</label>
            <div className="segmented">
              <button type="button" aria-selected={audience === 'team'} onClick={() => setAudience('team')}>Whole team</button>
              <button type="button" aria-selected={audience === 'selected'} onClick={() => setAudience('selected')}>Selected players</button>
            </div>
          </div>
          {audience === 'selected' && (
            <div style={{ marginBottom: 12 }}>
              <div className="row between" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <input className="input" style={{ flex: 1, minWidth: 140, minHeight: 34 }} placeholder="Filter players…" value={pFilter} onChange={(e) => setPFilter(e.target.value)} />
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => setPicked(Object.fromEntries(players.map((p) => [p.id, true])))}>All</button>
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => setPicked({})}>Clear</button>
                </div>
              </div>
              <div className="card" style={{ background: 'var(--surface-2)', border: 0, maxHeight: 220, overflowY: 'auto', marginBottom: 6 }}>
                {filteredPlayers.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No players match.</p> : filteredPlayers.map((p) => (
                  <label key={p.id} className="row" style={{ gap: 8, padding: '6px 0' }}>
                    <input type="checkbox" checked={!!picked[p.id]} onChange={(e) => setPicked((s) => ({ ...s, [p.id]: e.target.checked }))} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <div className="subtle" style={{ fontSize: 12 }}>{pickedCount} selected</div>
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
                  <div className="row between" style={{ gap: 8 }}>
                    <strong>{a.pinned ? '📌 ' : ''}{a.title || a.file_name || 'Attachment'}</strong>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} title={a.pinned ? 'Unpin' : 'Pin to top'} onClick={() => togglePin(a)}>{a.pinned ? '📌' : '📍'}</button>
                      <button className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} title="Edit" onClick={() => startEdit(a)}>✎</button>
                      <button className="btn btn-ghost" style={{ minHeight: 28, padding: '2px 8px', color: 'var(--danger)' }} title="Delete" onClick={() => remove(a.id)}>🗑</button>
                    </div>
                  </div>

                  {editId === a.id ? (
                    <div style={{ marginTop: 8 }}>
                      <input className="input" style={{ marginBottom: 6 }} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
                      <textarea className="input" rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} placeholder="Details" />
                      <div className="row" style={{ gap: 8, marginTop: 6 }}>
                        <button className="btn btn-primary" style={{ minHeight: 32 }} onClick={() => saveEdit(a.id)}>Save</button>
                        <button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => setEditId('')}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {a.body && <p style={{ margin: '4px 0 0' }}>{a.body}</p>}
                      {a.file_name && (
                        <div style={{ marginTop: 6 }}>
                          <button type="button" className="btn btn-secondary" style={{ minHeight: 30 }} onClick={() => setOpenFile((s) => ({ ...s, [a.id]: !s[a.id] }))}>📎 {openFile[a.id] ? 'Hide' : (isImage(a.mime) || isVideo(a.mime) ? 'Preview' : 'Open')} {a.file_name}</button>
                          {openFile[a.id] && urls[a.id] && (
                            <div style={{ marginTop: 8 }}>
                              {isImage(a.mime) ? <img src={urls[a.id]} alt={a.file_name} style={{ maxWidth: '100%', borderRadius: 8 }} />
                                : isVideo(a.mime) ? <video src={urls[a.id]} controls playsInline style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 320 }} />
                                : <a className="btn btn-secondary" href={urls[a.id]} target="_blank" rel="noreferrer" style={{ minHeight: 32 }}>Open file ↗</a>}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>
                        {new Date(a.created_at).toLocaleString()} · {a.recipients ? `🎯 ${a.recipients} player${a.recipients === 1 ? '' : 's'}` : `Whole team · ${players.length} player${players.length === 1 ? '' : 's'}`}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
