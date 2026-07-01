import AppShell from '../components/AppShell.jsx';
import RankBadge from '../components/RankBadge.jsx';
import StatCard from '../components/StatCard.jsx';

export default function ParentDashboard() {
  return (
    <AppShell role="parent" active="My Child" title="My Child">
      <div className="container" style={{ maxWidth: 680, padding: 0 }}>
        <div className="card">
          <div className="row between">
            <div className="row"><span className="avatar" style={{ width: 48, height: 48 }}>TM</span>
              <div><h3 style={{ margin: 0 }}>Thabo Mokoena</h3><div className="subtle">U15 · Winger</div></div>
            </div>
            <RankBadge level="Elite" />
          </div>
        </div>

        <div className="grid grid-3" style={{ marginTop: 16 }}>
          <StatCard label="Attendance" value="92%" />
          <StatCard label="Minutes" value="840" />
          <StatCard label="Avg rating" value="4.4" />
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h4>Next game</h4>
          <p style={{ margin: 0 }}><strong>U15 vs Rivera FC</strong> · Sat 10:00 · Home</p>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h4>Latest from coach</h4>
          <p style={{ margin: 0 }}>"Great movement off the ball this week. Working with Thabo on defensive tracking — please encourage the shuttle runs at home."</p>
        </div>

        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <h4>Bench status</h4>
            <span className="badge badge-success">Starting XI</span>
          </div>
          <div className="card">
            <h4>Diet plan</h4>
            <p className="subtle" style={{ margin: 0 }}>2 of 3 goals on track this week</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
