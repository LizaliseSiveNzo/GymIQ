/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, teamPlayers } from '../lib/coach.js';

const CATEGORIES = ['General', 'Tactical', 'Technical', 'Physical', 'Team culture', 'Planning'];
const CAT_COLOUR = {
  General: '#6b7280', Tactical: '#a855f7', Technical: '#3b82f6',
  Physical: '#f59e0b', 'Team culture': '#10b981', Planning: '#0ea5e9',
};
const fmt = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const PAGE = 15;

export default function CoachJournal() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [entries, setEntries] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState('all');   // all | training | match | note
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  // new entry form
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cat, setCat] = useState('General');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState('');
  const [onCal, setOnCal] = useState(true);

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);

  useEffect(() => { if (teamId) load(teamId); }, [teamId]);

  async function load(tid) {
    setLoading(true);
    try {
      const ppl = await teamPlayers(tid);
      setPlayers(ppl);

      const [{ data: sessions }, { data: matches }, { data: notes }] = await Promise.all([
        supabase.from('training_sessions')
          .select('id,notes,starts_at,date,location,objectives,exercises,observations,reflection')
          .eq('team_id', tid).order('starts_at', { ascending: false, nullsFirst: false }).limit(80),
        supabase.from('matches')
          .select('id,opponent,date,result,competition,reflection')
          .eq('team_id', tid).order('date', { ascending: false }).limit(80),
        supabase.from('coach_journal_entries')
          .select('id,entry_date,title,body,category,created_at,show_on_calendar')
          .eq('team_id', tid).order('entry_date', { ascending: false }).limit(80),
      ]);

      // standouts for the loaded sessions
      const sIds = (sessions || []).map((s) => s.id);
      let stand = [];
      if (sIds.length) {
        const { data } = await supabase.from('training_standouts').select('session_id,player_id').in('session_id', sIds);
        stand = data || [];
      }
      const nameOf = (pid) => ppl.find((p) => p.id === pid)?.name || 'Player';

      const feed = [
        ...(sessions || [])
          .filter((s) => s.objectives || s.exercises || s.observations || s.reflection || stand.some((x) => x.session_id === s.id))
          .map((s) => ({
            kind: 'training', id: s.id, when: s.starts_at || s.date,
            title: s.notes || 'Training session', where: s.location,
            sections: [
              ['🎯 Objectives', s.objectives],
              ['🏋️ Exercises', s.exercises],
              ['👀 Observations', s.observations],
              ['💭 Reflection', s.reflection],
            ].filter(([, v]) => v),
            standouts: stand.filter((x) => x.session_id === s.id).map((x) => nameOf(x.player_id)),
            link: `/coach/checkin?session=${s.id}`,
          })),
        ...(matches || [])
          .filter((m) => m.reflection)
          .map((m) => ({
            kind: 'match', id: m.id, when: m.date,
            title: `vs ${m.opponent}`, where: m.competition, result: m.result,
            sections: [['💭 Post-match reflection', m.reflection]],
            standouts: [],
            link: `/coach/lineup?match=${m.id}`,
          })),
        ...(notes || []).map((n) => ({
          kind: 'note', id: n.id, when: n.entry_date, title: n.title,
          category: n.category, sections: n.body ? [['', n.body]] : [], standouts: [],
          onCalendar: n.show_on_calendar, raw: n,
        })),
      ].sort((a, b) => new Date(b.when) - new Date(a.when));

      setEntries(feed);
      setLimit(PAGE);
    } finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault(); if (!title.trim()) return;
    setBusy(true); setErr('');
    try {
      const payload = { team_id: teamId, coach_id: profile.id, title: title.trim(),
                        body: body.trim() || null, category: cat, entry_date: date,
                        show_on_calendar: onCal };
      const { error } = editId
        ? await supabase.from('coach_journal_entries').update(payload).eq('id', editId)
        : await supabase.from('coach_journal_entries').insert(payload);
      if (error) { setErr(error.message); return; }
      resetForm(); await load(teamId);
    } finally { setBusy(false); }
  }

  function resetForm() {
    setTitle(''); setBody(''); setCat('General'); setDate(new Date().toISOString().slice(0, 10));
    setAdding(false); setEditId(''); setOnCal(true);
  }
  function startEdit(n) {
    setEditId(n.id); setTitle(n.title); setBody(n.body || '');
    setCat(n.category); setDate(n.entry_date); setOnCal(n.show_on_calendar !== false); setAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function toggleCalendar(n) {
    const next = !(n.show_on_calendar !== false);
    await supabase.from('coach_journal_entries').update({ show_on_calendar: next }).eq('id', n.id);
    await load(teamId);
  }

  async function removeEntry(id) {
    if (!window.confirm('Delete this journal entry?')) return;
    await supabase.from('coach_journal_entries').delete().eq('id', id);
    await load(teamId);
  }

  if (session?.demo) return <AppShell role="coach" active="Journal" title="Journal"><div className="card">Demo mode — sign in as a real coach to use the journal.</div></AppShell>;
  if (teams === null) return <AppShell role="coach" active="Journal" title="Journal"><div className="card">Loading…</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Journal" title="Journal"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  const counts = {
    training: entries.filter((e) => e.kind === 'training').length,
    match: entries.filter((e) => e.kind === 'match').length,
    note: entries.filter((e) => e.kind === 'note').length,
  };
  const needle = q.trim().toLowerCase();
  const shownAll = entries
    .filter((e) => filter === 'all' || e.kind === filter)
    .filter((e) => !needle || (e.title + ' ' + e.sections.map(([l, v]) => l + ' ' + v).join(' ') + ' ' + e.standouts.join(' ')).toLowerCase().includes(needle));
  const shown = shownAll.slice(0, limit);

  const META = {
    training: { icon: '🏃', label: 'Training', colour: 'var(--success)' },
    match:    { icon: '⚽', label: 'Match',    colour: 'var(--energy)' },
    note:     { icon: '📝', label: 'Note',     colour: '#3b82f6' },
  };

  const Chip = ({ label, value, n, colour }) => (
    <button type="button" onClick={() => setFilter(filter === value ? 'all' : value)} className="badge"
      style={{ cursor: 'pointer', background: 'transparent',
        border: filter === value ? `1.5px solid ${colour}` : '1px solid var(--border)',
        color: filter === value ? colour : 'inherit',
        opacity: filter === 'all' || filter === value ? 1 : .5 }}>
      {label}{n != null ? ` ${n}` : ''}
    </button>
  );

  return (
    <AppShell role="coach" active="Journal" title="Coaching Journal">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'end', minHeight: 40 }}
            onClick={() => { if (adding) resetForm(); else setAdding(true); }}>
            {adding ? 'Close' : '＋ New entry'}
          </button>
        </div>
        <p className="subtle" style={{ fontSize: 13, margin: '10px 0 0' }}>
          Everything this squad has worked on — training journals, match reflections and your own notes — in one timeline.
        </p>
      </div>

      {adding && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px' }}>{editId ? '✏️ Edit entry' : '📝 New journal entry'}</h4>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <div className="field" style={{ margin: 0 }}><label className="label">Title</label>
              <input className="input" placeholder="e.g. Squad struggling to build from the back" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label className="label">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="field"><label className="label">Category</label>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => (
                <button type="button" key={c} onClick={() => setCat(c)} className="badge"
                  style={{ cursor: 'pointer', background: cat === c ? CAT_COLOUR[c] : 'transparent',
                    color: cat === c ? '#fff' : 'inherit', border: `1px solid ${cat === c ? CAT_COLOUR[c] : 'var(--border)'}` }}>{c}</button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Notes</label>
            <textarea className="textarea" rows={4} placeholder="What did you notice? What does the squad need to work on?"
              value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <label className="row" style={{ gap: 8, marginBottom: 10 }}>
            <input type="checkbox" checked={onCal} onChange={(e) => setOnCal(e.target.checked)} />
            <span>📅 Show on the calendar for this date</span>
          </label>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy || !title.trim()}>{busy ? 'Saving…' : (editId ? 'Save changes' : 'Add entry')}</button>
            <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Journal</h4>
          <span className="badge badge-neutral">{shownAll.length}{shownAll.length !== entries.length ? ` of ${entries.length}` : ''}</span>
        </div>

        {entries.length > 0 && (
          <>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <Chip label="All" value="all" n={entries.length} colour="var(--green-600)" />
              <Chip label="🏃 Training" value="training" n={counts.training} colour="var(--success)" />
              <Chip label="⚽ Matches" value="match" n={counts.match} colour="var(--energy)" />
              <Chip label="📝 Notes" value="note" n={counts.note} colour="#3b82f6" />
            </div>
            <input className="input" style={{ minHeight: 34, marginBottom: 12 }} placeholder="Search the journal…"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </>
        )}

        {loading ? <p className="subtle" style={{ margin: 0 }}>Loading journal…</p>
         : entries.length === 0 ? (
          <div>
            <p style={{ margin: 0 }}>No journal entries yet.</p>
            <p className="subtle" style={{ fontSize: 13, margin: '6px 0 0' }}>
              Entries appear here automatically when you fill in a <Link to="/coach/training">training session journal</Link> or a{' '}
              <Link to="/coach/match">post-match reflection</Link> — or add your own note above.
            </p>
          </div>
        ) : shown.length === 0 ? <p className="subtle" style={{ margin: 0 }}>Nothing matches that filter.</p>
         : (
          <>
            <div className="stack" style={{ gap: 12 }}>
              {shown.map((e) => {
                const M = META[e.kind];
                return (
                  <div key={e.kind + e.id} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${M.colour}`, borderRadius: 12, padding: '12px 14px' }}>
                    <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ minWidth: 180 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{M.icon}</span>
                          <strong>{e.title}</strong>
                        </div>
                        <div className="subtle" style={{ fontSize: 12, marginTop: 2 }}>
                          {fmt(e.when)}{e.where ? ` · ${e.where}` : ''}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {e.result && <span className="badge badge-neutral">🏁 {e.result}</span>}
                        {e.kind === 'note' && e.onCalendar && <span className="badge badge-neutral" title="Showing on the calendar">📅</span>}
                        {e.category && <span className="badge" style={{ background: CAT_COLOUR[e.category], color: '#fff' }}>{e.category}</span>}
                        <span className="badge badge-neutral">{M.label}</span>
                      </div>
                    </div>

                    {e.sections.length > 0 && (
                      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                        {e.sections.map(([label, text]) => (
                          <div key={label || 'body'}>
                            {label && <div className="subtle" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>}
                            <p style={{ margin: '2px 0 0', whiteSpace: 'pre-line', fontSize: 13.5 }}>{text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {e.standouts.length > 0 && (
                      <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        <span className="subtle" style={{ fontSize: 12 }}>Stood out:</span>
                        {e.standouts.map((n) => <span key={n} className="badge badge-success">⭐ {n}</span>)}
                      </div>
                    )}

                    <div className="row" style={{ gap: 10, marginTop: 10 }}>
                      {e.link && <Link to={e.link} className="subtle" style={{ fontSize: 12 }}>Open {e.kind === 'match' ? 'match' : 'session'} →</Link>}
                      {e.kind === 'note' && (
                        <>
                          <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px' }} onClick={() => toggleCalendar(e.raw)}>
                            {e.onCalendar ? '📅 Remove from calendar' : '📅 Add to calendar'}
                          </button>
                          <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px' }} onClick={() => startEdit(e.raw)}>✏️ Edit</button>
                          <button type="button" className="btn btn-ghost" style={{ minHeight: 26, padding: '2px 8px', color: 'var(--danger)' }} onClick={() => removeEntry(e.id)}>🗑</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {shownAll.length > shown.length && (
              <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 12 }}
                onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({shownAll.length - shown.length} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
