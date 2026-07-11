/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import StatCard from '../components/StatCard.jsx';
import RankBadge from '../components/RankBadge.jsx';
import { supabase } from '../lib/supabaseClient.js';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
const isImage = (m) => (m || '').startsWith('image/');
const isVideo = (m) => (m || '').startsWith('video/');

function Meta({ label, value }) {
  return <div><div className="subtle" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{label}</div><div style={{ fontWeight: 600 }}>{value ?? '—'}</div></div>;
}

export default function AdminPlayerDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [medical, setMedical] = useState([]);
  const [matches, setMatches] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => { (async () => {
    const [{ data: dossier, error }, { data: n }, { data: f }, { data: m }, { data: mt }, { data: at }] = await Promise.all([
      supabase.rpc('admin_player_dossier', { p_player_id: id }),
      supabase.rpc('admin_player_notes', { p_player_id: id }),
      supabase.rpc('admin_player_files', { p_player_id: id }),
      supabase.rpc('admin_player_medical', { p_player_id: id }),
      supabase.rpc('admin_player_matches', { p_player_id: id }),
      supabase.rpc('admin_player_attendance', { p_player_id: id }),
    ]);
    if (error) setErr(error.message);
    setD(dossier || false); setNotes(n || []); setFiles(f || []); setMedical(m || []); setMatches(mt || []); setAttendance(at || []);
  })(); }, [id]);

  async function openFile(f) {
    const { data } = await supabase.storage.from('player-files').createSignedUrl(f.path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  if (d === null) return <AppShell role="admin" active="Players" title="Player"><div className="card">Loading…</div></AppShell>;
  if (d === false) return <AppShell role="admin" active="Players" title="Player"><div className="card">Player not found. <Link to="/admin/players">Back</Link>{err ? ` — ${err}` : ''}</div></AppShell>;

  const meal = notes.filter((x) => x.kind === 'diet');
  const coachNotes = notes.filter((x) => x.kind === 'note');

  return (
    <AppShell role="admin" active="Players" title={d.name || 'Player'}>
      <div style={{ marginBottom: 12 }}><Link to="/admin/players" className="subtle">← Back to stats</Link></div>

      {/* Identity + metadata */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="row"><span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(d.name)}</span>
            <div><h3 style={{ margin: 0 }}>{d.name}</h3>
              <div className="subtle">{[d.team, d.position].filter(Boolean).join(' · ') || '—'}</div></div>
          </div>
          <RankBadge level={d.rank || 'Rookie'} />
        </div>
        {d.benched && <div className="badge badge-warning" style={{ marginTop: 12 }}>Benched{d.bench_reason ? ` — ${d.bench_reason}` : ''}</div>}
        <div className="grid grid-3" style={{ marginTop: 16, gap: 14 }}>
          <Meta label="Email" value={d.email} />
          <Meta label="Student code" value={d.child_code} />
          <Meta label="Team / division" value={[d.team, d.division ? d.division.replace('_',' ') : null].filter(Boolean).join(' · ') || '—'} />
          <Meta label="Coach" value={d.coach} />
          <Meta label="Date of birth" value={fmtDate(d.dob)} />
          <Meta label="Joined" value={fmtDate(d.joined)} />
          <Meta label="Height" value={d.height_cm ? `${d.height_cm} cm` : '—'} />
          <Meta label="Weight" value={d.weight_kg ? `${d.weight_kg} kg` : '—'} />
          <Meta label="Strong / weak foot" value={[d.strong_foot, d.weak_foot ? `weak ${d.weak_foot}/5` : null].filter(Boolean).join(' · ') || '—'} />
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Attendance" value={`${d.attendance_pct}%`} />
        <StatCard label="Games" value={d.games} />
        <StatCard label="Minutes" value={d.minutes} />
        <StatCard label="Avg rating" value={d.avg_rating || '—'} />
        <StatCard label="Goals" value={d.goals} />
        <StatCard label="Assists" value={d.assists} />
        <StatCard label="Defensive actions" value={d.def_actions} />
        <StatCard label="Sessions attended" value={`${d.sessions_attended}/${d.sessions_total}`} />
      </div>

      {(() => {
        const upcoming = matches.filter((m) => m.upcoming).sort((a, b) => new Date(a.when_at) - new Date(b.when_at));
        const history = matches.filter((m) => !m.upcoming);
        return (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-header"><h4 style={{ margin: 0 }}>⚽ Upcoming games</h4><span className="badge badge-neutral">{upcoming.length}</span></div>
              {upcoming.length === 0 ? <p className="subtle">None scheduled.</p> : (
                <div className="stack" style={{ gap: 6 }}>
                  {upcoming.map((m) => (
                    <div key={m.match_id} className="row between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <span><strong>vs {m.opponent}</strong><span className="subtle" style={{ fontSize: 12 }}> · {new Date(m.when_at).toLocaleString()}{m.venue ? ` · ${m.venue}` : ''}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-header"><h4 style={{ margin: 0 }}>📜 Game history</h4><span className="badge badge-neutral">{history.length}</span></div>
              {history.length === 0 ? <p className="subtle">No games played yet.</p> : (
                <table className="table"><thead><tr><th>Opponent</th><th>Date</th><th>Result</th><th>Min</th><th>G</th><th>A</th><th>Rating</th></tr></thead>
                  <tbody>{history.map((m) => (
                    <tr key={m.match_id}>
                      <td>vs {m.opponent}</td><td>{new Date(m.when_at).toLocaleDateString()}</td><td>{m.result || '—'}</td>
                      <td>{m.minutes ?? '—'}</td><td>{m.goals ?? '—'}</td><td>{m.assists ?? '—'}</td><td>{m.rating ?? '—'}</td>
                    </tr>))}</tbody>
                </table>
              )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-header"><h4 style={{ margin: 0 }}>✅ Practice attendance</h4><span className="badge badge-success">{d.attendance_pct}%</span></div>
              {attendance.length === 0 ? <p className="subtle">No sessions yet.</p> : (
                <div className="stack" style={{ gap: 6 }}>
                  {attendance.map((a) => (
                    <div key={a.session_id} className="row between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap', gap: 6 }}>
                      <span>{new Date(a.when_at).toLocaleDateString()}<span className="subtle" style={{ fontSize: 12 }}>{a.notes ? ` · ${a.notes}` : ''}</span></span>
                      <span className="row" style={{ gap: 6 }}>
                        {a.left_early && <span className="badge badge-warning">Left early{a.left_reason ? `: ${a.left_reason}` : ''}</span>}
                        <span className={`badge ${a.attended ? 'badge-success' : 'badge-danger'}`}>{a.attended ? 'Present' : 'Absent'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      })()}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Coach notes + meal */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="section-header"><h4 style={{ margin: 0 }}>📝 Coach notes</h4><span className="badge badge-neutral">{coachNotes.length}</span></div>
            {coachNotes.length === 0 ? <p className="subtle">No notes.</p> : coachNotes.map((n, i) => (
              <div key={i} style={{ paddingTop: 10, marginTop: 10, borderTop: i ? '1px solid var(--border)' : 0 }}>
                <p style={{ margin: 0 }}>{n.content}</p>
                <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{n.author || 'Coach'} · {new Date(n.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {meal.length > 0 && (
            <div className="card">
              <div className="section-header"><h4 style={{ margin: 0 }}>🥗 Meal plans</h4><span className="badge badge-neutral">{meal.length}</span></div>
              {meal.map((n, i) => (
                <div key={i} style={{ paddingTop: 10, marginTop: 10, borderTop: i ? '1px solid var(--border)' : 0 }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{n.content}</p>
                  <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents + medical */}
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="section-header"><h4 style={{ margin: 0 }}>📎 Documents &amp; media</h4><span className="badge badge-neutral">{files.length}</span></div>
            {files.length === 0 ? <p className="subtle">No files.</p> : (
              <div className="stack" style={{ gap: 8 }}>
                {files.map((f) => (
                  <div key={f.id} className="row between" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 14, wordBreak: 'break-all' }}>{isVideo(f.mime) ? '🎬 ' : isImage(f.mime) ? '🖼️ ' : '📄 '}{f.file_name}</strong>
                      <div className="subtle" style={{ fontSize: 12 }}><span className="badge badge-neutral" style={{ fontSize: 10 }}>{f.kind || 'file'}</span> · {f.uploaded_by || '—'} · {fmtDate(f.created_at)}</div>
                    </div>
                    <button className="btn btn-secondary" style={{ minHeight: 32 }} onClick={() => openFile(f)}>Open</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-header"><h4 style={{ margin: 0 }}>🩹 Medical / injury thread</h4><span className="badge badge-neutral">{medical.length}</span></div>
            {medical.length === 0 ? <p className="subtle">No medical notes.</p> : (
              <div className="stack" style={{ gap: 10 }}>
                {medical.map((m, i) => (
                  <div key={i} style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    <p style={{ margin: 0 }}>{m.message}</p>
                    <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>{m.author_name || '—'}{m.author_role ? ` (${m.author_role})` : ''} · {new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
