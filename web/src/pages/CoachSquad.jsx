/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { myTeams, squadWithStats } from '../lib/coach.js';
import { initials } from '../lib/format.js';

const PAGE = 25;

const SORTS = [
  ['name', 'A–Z'],
  ['rate', 'Attendance'],
  ['position', 'Position'],
  ['rank', 'Rank'],
];
const RANK_ORDER = { Legend: 5, Master: 4, Elite: 3, Rising_Star: 2, Rookie: 1 };

export default function CoachSquad() {
  const { profile, session } = useAuth();
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [squad, setSquad] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [pos, setPos] = useState('all');
  const [avail, setAvail] = useState('all');   // all | available | unavailable
  const [sort, setSort] = useState('name');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => { if (session?.demo) return; (async () => {
    const t = await myTeams(profile.id); setTeams(t); if (t[0]) setTeamId(t[0].id);
  })(); }, []);

  useEffect(() => { if (!teamId) return; (async () => {
    setLoading(true);
    try { setSquad(await squadWithStats(teamId)); } finally { setLoading(false); }
    setLimit(PAGE);
  })(); }, [teamId]);

  if (session?.demo) return <AppShell role="coach" active="Squad" title="Squad"><div className="card">Demo mode — sign in as a real coach to view your squad.</div></AppShell>;
  if (teams === null) return <AppShell role="coach" active="Squad" title="Squad"><div className="card">Loading…</div></AppShell>;
  if (teams.length === 0) return <AppShell role="coach" active="Squad" title="Squad"><div className="card">No teams yet. Create a team on your dashboard first.</div></AppShell>;

  const positions = [...new Set(squad.map((p) => p.position).filter(Boolean))].sort();

  const filtered = squad
    .filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((p) => pos === 'all' || p.position === pos)
    .filter((p) => avail === 'all' || (avail === 'missing' ? (!p.hasEmergency || !p.hasConsent) : avail === 'available' ? !p.unavailable : !!p.unavailable))
    .sort((a, b) => {
      if (sort === 'rate') return (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name);
      if (sort === 'position') return (a.position || 'zz').localeCompare(b.position || 'zz') || a.name.localeCompare(b.name);
      if (sort === 'rank') return (RANK_ORDER[b.rank] || 0) - (RANK_ORDER[a.rank] || 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  const shown = filtered.slice(0, limit);
  const unavailable = squad.filter((p) => p.unavailable).length;
  const active = q.trim() || pos !== 'all' || avail !== 'all';

  const attColour = (r) => r == null ? 'badge-neutral' : r >= 80 ? 'badge-success' : r >= 50 ? 'badge-warning' : 'badge-danger';

  return (
    <AppShell role="coach" active="Squad" title="Squad">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ margin: 0, minWidth: 220 }}>
            <label className="label">Team</label>
            <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.division.replace('_',' ')})</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8, alignSelf: 'end', flexWrap: 'wrap' }}>
            <Link to="/coach/journal" className="btn btn-ghost" style={{ minHeight: 34 }}>📓 Journal</Link>
            <span className="badge badge-neutral">{squad.length} player{squad.length === 1 ? '' : 's'}</span>
            {unavailable > 0 && <span className="badge badge-warning">{unavailable} unavailable</span>}
          </div>
        </div>

        {/* search + filters + sort */}
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search players…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" style={{ maxWidth: 160 }} value={pos} onChange={(e) => setPos(e.target.value)}>
            <option value="all">All positions</option>
            {positions.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 170 }} value={avail} onChange={(e) => setAvail(e.target.value)}>
            <option value="all">All availability</option>
            <option value="available">Available only</option>
            <option value="unavailable">Unavailable only</option>
            <option value="missing">Missing safeguarding info</option>
          </select>
        </div>
        <div className="row between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <div className="segmented">
            {SORTS.map(([k, label]) => (
              <button key={k} type="button" aria-selected={sort === k} onClick={() => setSort(k)}>{label}</button>
            ))}
          </div>
          {active && (
            <button type="button" className="btn btn-ghost" style={{ minHeight: 30 }}
              onClick={() => { setQ(''); setPos('all'); setAvail('all'); }}>Clear filters</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Players</h4>
          <span className="badge badge-neutral">{filtered.length}{filtered.length !== squad.length ? ` of ${squad.length}` : ''}</span>
        </div>

        {loading ? <p className="subtle" style={{ margin: 0 }}>Loading squad…</p>
         : squad.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No players on this team yet. Your academy admin assigns players to teams.</p>
         : filtered.length === 0 ? <p className="subtle" style={{ margin: 0 }}>No players match those filters.</p>
         : (
          <>
            <div className="stack" style={{ gap: 8 }}>
              {shown.map((p) => (
                <Link key={p.id} to={`/coach/player/${p.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', display: 'block' }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="row" style={{ gap: 10, minWidth: 180 }}>
                      <span className="avatar">{initials(p.name)}</span>
                      <div>
                        <strong>{p.name}</strong>
                        {p.shirt != null && <span className="subtle" style={{ fontSize: 12 }}> · #{p.shirt}</span>}
                        <div className="subtle" style={{ fontSize: 12 }}>
                          {p.position || 'No position'} · {(p.rank || 'Rookie').replace('_',' ')}
                        </div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {(!p.hasEmergency || !p.hasConsent) && (
                        <span className="badge badge-danger"
                          title={[!p.hasEmergency && 'No emergency contact', !p.hasConsent && 'No guardian consent recorded'].filter(Boolean).join(' · ')}>
                          🛡️ Missing info
                        </span>
                      )}
                      {p.injury && <span className="badge badge-danger" title={p.injury.injury_type}>🩹 Injured</span>}
                      {p.benched && !p.injury && <span className="badge badge-warning" title={p.benchReason || ''}>Unavailable</span>}
                      <span className={`badge ${attColour(p.rate)}`}>{p.rate == null ? '— att' : `${p.rate}% att`}</span>
                      {p.avg && <span className="badge badge-neutral">★ {p.avg}</span>}
                      <span className="subtle" style={{ fontSize: 16 }}>›</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {filtered.length > shown.length && (
              <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 12 }}
                onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, filtered.length - shown.length)} more ({filtered.length - shown.length} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
