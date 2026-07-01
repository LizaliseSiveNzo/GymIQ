import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import RankBadge from '../components/RankBadge.jsx';
import StatCard from '../components/StatCard.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const RANKS = ['Rookie', 'Rising_Star', 'Elite', 'Master', 'Grand_Master'];
const NEXT = { Rookie: 'Rising Star', Rising_Star: 'Elite', Elite: 'Master', Master: 'Grand Master', Grand_Master: 'Grand Master' };
const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const DEMO = { name: 'Thabo Mokoena', position: 'Winger', team: 'U15', rank: 'Elite', progress: 62,
  attendance_pct: 92, minutes: 840, avg_rating: 4.4 };

export default function PlayerProfile() {
  const { session } = useAuth();
  const [ov, setOv] = useState(session?.demo ? DEMO : null);
  const [loading, setLoading] = useState(!session?.demo);

  useEffect(() => {
    if (session?.demo) return;
    supabase.rpc('my_player_overview').then(({ data }) => { setOv(data); setLoading(false); });
  }, []);

  if (loading) return <AppShell role="player" active="My Profile" title="My Profile"><div className="card">Loading…</div></AppShell>;
  if (!ov) return (
    <AppShell role="player" active="My Profile" title="My Profile">
      <div className="card"><h3>No player profile linked</h3>
        <p className="subtle" style={{ margin: 0 }}>This account isn’t linked to a player yet. Ask your academy admin.</p></div>
    </AppShell>
  );

  const rank = ov.rank || 'Rookie';
  return (
    <AppShell role="player" active="My Profile" title="My Profile">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <div className="card">
          <div className="row between">
            <div className="row">
              <span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(ov.name)}</span>
              <div>
                <h3 style={{ margin: 0 }}>{ov.name}</h3>
                <div className="subtle">{[ov.team, ov.position].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>
            <RankBadge level={rank} />
          </div>

          <div className="progress energy" style={{ margin: '18px 0 6px' }}>
            <span style={{ width: `${ov.progress || 0}%` }} />
          </div>
          <div className="subtle" style={{ fontSize: 13 }}>
            {rank === 'Grand_Master' ? 'Top rank reached! 🏆' : `${ov.progress || 0}% to ${NEXT[rank]}`}
          </div>

          <div className="ladder" style={{ marginTop: 14 }}>
            {RANKS.map((r) => (
              <div key={r} className={`step ${r === rank ? 'active' : ''}`}>{r.replace('_', ' ')}</div>
            ))}
          </div>

          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <StatCard label="Attendance" value={`${ov.attendance_pct ?? 0}%`} />
            <StatCard label="Minutes" value={ov.minutes ?? 0} />
            <StatCard label="Avg rating" value={ov.avg_rating ?? '—'} />
          </div>

          <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0 }}>
            <div className="row between">
              <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                AI Summary — Last 30 Days
              </strong>
              <button className="btn btn-secondary" style={{ minHeight: 32, padding: '6px 12px' }} disabled>Regenerate</button>
            </div>
            <p style={{ margin: '10px 0 0' }} className="subtle">
              AI performance summaries arrive in Phase 7 (Claude API).
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
