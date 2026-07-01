import AppShell from '../components/AppShell.jsx';
import StatCard from '../components/StatCard.jsx';

const FIXTURES = [
  ['U15 vs Rivera FC', 'Sat 10:00', 'Home'],
  ['U13 vs Coastal Academy', 'Sat 12:30', 'Away'],
  ['First Team vs Metro United', 'Sun 15:00', 'Home'],
];
const TRIALS = [
  ['Lwazi Dube', 'U13', 'Striker', 'pending'],
  ['Aya Nkosi', 'U15', 'Midfield', 'accepted'],
  ['Ben Carter', 'U11', 'Keeper', 'declined'],
];
const chip = { accepted: 'chip-accepted', declined: 'chip-declined', pending: 'chip-pending' };

export default function AdminDashboard() {
  return (
    <AppShell role="admin" active="Dashboard" title="Dashboard">
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Total players" value="248" />
        <StatCard label="Teams" value="16" />
        <StatCard label="Avg attendance" value="87%" />
        <StatCard label="Trial pipeline" value="34" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Upcoming fixtures</h4><a>View all</a></div>
          <div className="stack" style={{ gap: 10 }}>
            {FIXTURES.map(([m, t, v]) => (
              <div key={m} className="row between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <div><strong>{m}</strong><div className="subtle" style={{ fontSize: 13 }}>{t}</div></div>
                <span className="badge badge-neutral">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header"><h4 style={{ margin: 0 }}>Star player spotlight</h4><span className="badge badge-success">U13</span></div>
          <div className="row"><span className="avatar" style={{ width: 48, height: 48 }}>LK</span>
            <div><strong>Lerato Khumalo</strong><div className="subtle" style={{ fontSize: 13 }}>Master · 4.7 avg rating</div></div>
          </div>
          <div className="progress" style={{ marginTop: 14 }}><span style={{ width: '84%' }} /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Recent trial registrations</h4><a>Manage trials</a></div>
        <table className="table">
          <thead><tr><th>Child</th><th>Division</th><th>Position</th><th>Outcome</th></tr></thead>
          <tbody>
            {TRIALS.map(([n, d, p, o]) => (
              <tr key={n}><td>{n}</td><td>{d}</td><td>{p}</td><td><span className={`badge ${chip[o]}`}>{o}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
