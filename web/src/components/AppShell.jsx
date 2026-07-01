import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// [label, icon, path|null]  — null path = not built yet (shown, not clickable)
const NAV = {
  admin:  [['Dashboard','▚','/admin'],['Teams','👥','/admin/teams'],['Players','⚽','/admin/players'],['Trials','📋',null],['Reports','📊',null],['Settings','⚙',null]],
  coach:  [['Dashboard','▚','/coach'],['Log Training','➕','/coach/training'],['Log Match','⚽','/coach/match'],['Schedule','📅',null],['Messages','💬',null]],
  parent: [['My Child','⚽','/parent'],['Schedule','📅',null],['Messages','💬',null],['Notifications','🔔',null]],
  player: [['My Profile','⚽','/player'],['Leaderboard','🏆',null],['Schedule','📅',null]],
};

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function AppShell({ active, title, children }) {
  const { profile, role, session, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[role] || [];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--energy)' }} /> PitchIQ</div>
        {items.map(([label, icon, path]) => {
          const cls = `nav-item ${label === active ? 'active' : ''}`;
          const inner = <><span style={{ width: 18, textAlign: 'center' }}>{icon}</span> {label}</>;
          return path
            ? <Link key={label} to={path} className={cls}>{inner}</Link>
            : <div key={label} className={cls} style={{ opacity: .55, cursor: 'default' }} title="Coming soon">{inner}</div>;
        })}
        <div style={{ marginTop: 'auto' }}>
          <div className="nav-item" onClick={() => { logout(); navigate('/login'); }}>
            <span style={{ width: 18, textAlign: 'center' }}>↩</span> Exit
          </div>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="topbar">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div className="row">
            <span className="badge badge-neutral">{profile?.org || 'PitchIQ'}</span>
            {session?.demo && <span className="badge badge-success">Demo mode</span>}
            <span className="avatar">{initials(profile?.name)}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
