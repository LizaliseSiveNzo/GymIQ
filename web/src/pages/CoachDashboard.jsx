import AppShell from '../components/AppShell.jsx';

const SQUAD = [
  ['Thabo Mokoena', 'Winger', '92%', '4.4', 'Elite'],
  ['Sipho Ndlovu', 'Midfield', '78%', '3.8', 'Rising Star'],
  ['Kabelo Sithole', 'Defender', '88%', '4.1', 'Elite'],
  ['Junior Adams', 'Striker', '64%', '3.2', 'Rookie'],
];

export default function CoachDashboard() {
  return (
    <AppShell role="coach" active="Dashboard" title="Coach Dashboard">
      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--green-600)' }}>
        <div className="row between">
          <div>
            <div className="subtle" style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Today · Training</div>
            <h3 style={{ margin: '4px 0 0' }}>U15 — 16:00 at Main Pitch</h3>
          </div>
          <button className="btn btn-primary">➕ Log session</button>
        </div>
      </div>

      <div className="card">
        <div className="section-header"><h4 style={{ margin: 0 }}>My squad — U15</h4><span className="badge badge-warning">1 low attendance</span></div>
        <table className="table">
          <thead><tr><th>Player</th><th>Position</th><th>Attendance</th><th>Avg rating</th><th>Rank</th></tr></thead>
          <tbody>
            {SQUAD.map(([n, pos, att, r, rank]) => (
              <tr key={n}>
                <td><span className="row"><span className="avatar">{n.split(' ').map(w=>w[0]).join('')}</span> {n}</span></td>
                <td>{pos}</td><td>{att}</td><td>{r}</td>
                <td><span className="badge badge-neutral">{rank}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
