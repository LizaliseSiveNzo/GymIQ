/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import RankBadge from '../components/RankBadge.jsx';
import StatCard from '../components/StatCard.jsx';
import InjuryThread from '../components/InjuryThread.jsx';
import MatchLog from '../components/MatchLog.jsx';
import PlayerUploads from '../components/PlayerUploads.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import AttributeEditor from '../components/AttributeEditor.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function CoachPlayerDetail() {
  const { id } = useParams();
  const { profile, session } = useAuth();
  const [p, setP] = useState(null);
  const [stats, setStats] = useState({ att: '—', avg: '—', minutes: 0 });
  const [notes, setNotes] = useState([]);
  const [mealPlan, setMealPlan] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newMeal, setNewMeal] = useState('');
  const [benchReason, setBenchReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [doc, setDoc] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [uploadsKey, setUploadsKey] = useState(0);

  useEffect(() => { if (!session?.demo) load(); }, [id]);

  async function load() {
    const { data: player } = await supabase.from('players')
      .select('id,position,rank_level,benched,bench_reason,child_code,team_id,users(name)')
      .eq('id', id).single();
    if (!player) { setP(false); return; }
    setP(player);
    setBenchReason(player.bench_reason || '');

    const [{ data: sessions }, { data: att }, { data: ms }] = await Promise.all([
      supabase.from('training_sessions').select('id').eq('team_id', player.team_id),
      supabase.from('attendance').select('session_id,attended').eq('player_id', id),
      supabase.from('player_match_stats').select('minutes_played,rating').eq('player_id', id),
    ]);
    const total = (sessions || []).length;
    const attended = (att || []).filter((a) => a.attended).length;
    const minutes = (ms || []).reduce((n, x) => n + (x.minutes_played || 0), 0);
    const rated = (ms || []).filter((x) => x.rating != null);
    setStats({
      att: total ? `${Math.round(attended / total * 100)}%` : '—',
      avg: rated.length ? (rated.reduce((n, x) => n + Number(x.rating), 0) / rated.length).toFixed(1) : '—',
      minutes,
    });

    const { data: ns } = await supabase.from('coach_player_notes')
      .select('id,note,diet_plan,created_at').eq('player_id', id)
      .order('created_at', { ascending: false }).limit(30);
    setNotes((ns || []).filter((n) => n.note));
    const latestMeal = (ns || []).find((n) => n.diet_plan);
    setMealPlan(latestMeal?.diet_plan || '');
    setNewMeal(latestMeal?.diet_plan || '');
  }

  async function addNote(e) {
    e.preventDefault(); if (!newNote.trim()) return;
    setBusy(true);
    try {
      await supabase.from('coach_player_notes').insert({ coach_id: profile.id, player_id: id, note: newNote.trim() });
      setNewNote(''); setMsg('Note saved — the player can see it on their profile.'); load();
    } finally { setBusy(false); }
  }

  async function saveMeal(e) {
    e.preventDefault(); setBusy(true);
    try {
      await supabase.from('coach_player_notes').insert({ coach_id: profile.id, player_id: id, diet_plan: newMeal.trim() || null });
      setMsg('Meal plan updated.'); load();
    } finally { setBusy(false); }
  }

  async function sendDoc(e) {
    e.preventDefault();
    if (!doc) return;
    setSending(true); setSendMsg('');
    try {
      if (doc.size > 200 * 1024 * 1024) { setSendMsg('File too large (max 200MB).'); return; }
      const safe = doc.name.replace(/[^\w.\-]/g, '_');
      const path = `${id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from('player-files').upload(path, doc, { contentType: doc.type || undefined });
      if (upErr) { setSendMsg(upErr.message); return; }
      const kind = (doc.type || '').startsWith('image/') ? 'image' : 'document';
      const { error } = await supabase.rpc('coach_add_player_file', { p_player_id: id, p_path: path, p_file_name: doc.name, p_mime: doc.type || null, p_kind: kind });
      if (error) { setSendMsg(error.message); return; }
      setDoc(null); setSendMsg('Document sent — it’s on the player’s profile.'); setUploadsKey((k) => k + 1);
    } finally { setSending(false); }
  }

  async function toggleBench() {
    setBusy(true);
    try {
      await supabase.from('players').update({
        benched: !p.benched,
        bench_reason: !p.benched ? (benchReason.trim() || null) : null,
      }).eq('id', id);
      load();
    } finally { setBusy(false); }
  }

  if (session?.demo) return <AppShell role="coach" active="Dashboard" title="Player"><div className="card">Demo mode — sign in as a real coach to manage players.</div></AppShell>;
  if (p === null) return <AppShell role="coach" active="Dashboard" title="Player"><div className="card">Loading…</div></AppShell>;
  if (p === false) return <AppShell role="coach" active="Dashboard" title="Player"><div className="card">Player not found (or not on your team). <Link to="/coach">Back to squad</Link></div></AppShell>;

  const name = p.users?.name || 'Player';
  return (
    <AppShell role="coach" active="Dashboard" title={name}>
      <div style={{ marginBottom: 12 }}><Link to="/coach" className="subtle">← Back to squad</Link></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="row">
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(name)}</span>
            <div>
              <h3 style={{ margin: 0 }}>{name}</h3>
              <div className="subtle">{p.position || '—'} · Child code: <strong>{p.child_code || '—'}</strong></div>
            </div>
          </div>
          <RankBadge level={p.rank_level || 'Rookie'} />
        </div>
        {p.benched && <div className="badge badge-warning" style={{ marginTop: 12 }}>Benched{p.bench_reason ? ` — ${p.bench_reason}` : ''}</div>}
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          <StatCard label="Attendance" value={stats.att} />
          <StatCard label="Minutes" value={stats.minutes} />
          <StatCard label="Avg rating" value={stats.avg} />
        </div>
        {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, margin: '12px 0 0' }}>{msg}</p>}
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <form className="card" onSubmit={addNote}>
            <h4>📝 Add a note</h4>
            <p className="subtle" style={{ fontSize: 13 }}>Visible to the player (and their parents on the same login).</p>
            <textarea className="input" rows={3} placeholder="e.g. Great pressing today. Work on first touch — wall passes 10 min/day."
              value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !newNote.trim()}>Save note</button>
          </form>

          <form className="card" onSubmit={saveMeal}>
            <h4>🥗 Meal plan</h4>
            <textarea className="input" rows={5} placeholder={'e.g.\nBreakfast: oats + banana\nPre-training: fruit + water\nDinner: chicken, rice, veg'}
              value={newMeal} onChange={(e) => setNewMeal(e.target.value)} />
            <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} disabled={busy || newMeal.trim() === mealPlan.trim()}>Update meal plan</button>
          </form>

          <div className="card">
            <h4>🪑 Bench</h4>
            {!p.benched && (
              <div className="field"><label className="label">Reason (shown to the family)</label>
                <input className="input" placeholder="e.g. Resting a knock — back next week" value={benchReason} onChange={(e) => setBenchReason(e.target.value)} /></div>
            )}
            <button className="btn btn-ghost btn-block" onClick={toggleBench} disabled={busy} type="button">
              {p.benched ? 'Return to squad' : 'Bench player'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Note history</h4><span className="badge badge-neutral">{notes.length}</span></div>
          {notes.length === 0 ? <p className="subtle">No notes yet.</p> : (
            <div className="stack" style={{ gap: 12 }}>
              {notes.map((n) => (
                <div key={n.id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <p style={{ margin: 0 }}>{n.note}</p>
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MatchLog playerId={id} />

      <PlayerCard playerId={id} />

      <AttributeEditor playerId={id} />

      <form className="card" style={{ marginTop: 18 }} onSubmit={sendDoc}>
        <h4 style={{ marginTop: 0 }}>📎 Send a document, photo or video to {name.split(' ')[0]}</h4>
        <p className="subtle" style={{ fontSize: 13, marginTop: 0 }}>Documents, images and videos (up to 200MB) — uploads straight to the player’s profile and notifies them.</p>
        <input key={uploadsKey} className="input" type="file" accept="image/*,application/pdf,video/*" onChange={(e) => setDoc(e.target.files?.[0] || null)} />
        {doc && <p className="subtle" style={{ fontSize: 12, margin: '4px 0 0' }}>{doc.name} · {(doc.size / 1024 / 1024).toFixed(1)}MB</p>}
        {sendMsg && <p style={{ color: 'var(--green-700)', fontSize: 13, margin: '8px 0 0' }}>{sendMsg}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={sending || !doc}>{sending ? 'Sending…' : 'Send to player'}</button>
      </form>

      <PlayerUploads key={uploadsKey} playerId={id} canUpload={false} />

      <InjuryThread playerId={id} />
    </AppShell>
  );
}
