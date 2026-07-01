import AppShell from '../components/AppShell.jsx';
import RankBadge from '../components/RankBadge.jsx';
import StatCard from '../components/StatCard.jsx';
// TODO: wire to /api/player/me (Blueprint Prompt 3). Static sample data for now.

const RANKS = ['Rookie', 'Rising_Star', 'Elite', 'Master', 'Grand_Master'];

export default function PlayerProfile() {
  const currentRank = 'Elite';
  const progress = 62;

  return (
    <AppShell role="player" active="My Profile" title="My Profile">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <div className="card">
          <div className="row between">
            <div className="row">
              <span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>TM</span>
              <div>
                <h3 style={{ margin: 0 }}>Thabo Mokoena</h3>
                <div className="subtle">U15 · Winger</div>
              </div>
            </div>
            <RankBadge level={currentRank} />
          </div>

          <div className="progress energy" style={{ margin: '18px 0 6px' }}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="subtle" style={{ fontSize: 13 }}>620 pts to Master</div>

          <div className="ladder" style={{ marginTop: 14 }}>
            {RANKS.map((r) => (
              <div key={r} className={`step ${r === currentRank ? 'active' : ''}`}>
                {r.replace('_', ' ')}
              </div>
            ))}
          </div>

          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <StatCard label="Attendance" value="92%" />
            <StatCard label="Minutes" value="840" />
            <StatCard label="Avg rating" value="4.4" />
          </div>

          <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0 }}>
            <div className="row between">
              <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                AI Summary — Last 30 Days
              </strong>
              <button className="btn btn-secondary" style={{ minHeight: 32, padding: '6px 12px' }}>Regenerate</button>
            </div>
            <p style={{ margin: '10px 0 0' }}>
              Thabo's pace on the wing is creating real chances — three assists this month. Focus area:
              tracking back on defence. Home tip: 10 minutes of shuttle runs, 3× a week.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
