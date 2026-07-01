import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = {
  admin:  [['Dashboard','▚'],['Teams','👥'],['Players','⚽'],['Trials','📋'],['Reports','📊'],['Settings','⚙']],
  coach:  [['Dashboard','▚'],['Squad','👥'],['Log','➕'],['Schedule','📅'],['Messages','💬']],
  parent: [['My Child','⚽'],['Schedule','📅'],['Messages','💬'],['Notifications','🔔']],
  player: [['My Profile','⚽'],['Leaderboard','🏆'],['Schedule','📅']],
};

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function AppShell({ active, title, children }) {
  const { profile, role, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[role] || [];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--energy)' }} /> PitchIQ</div>
        {items.map(([label, icon]) => (
          <div key={label} className={`nav-item ${label === active ? 'active' : ''}`}>
            <span style={{ width: 18, textAlign: 'center' }}>{icon}</span> {label}
          </div>
        ))}
        <div style={{ marginTop: 'auto' }}>
          <div className="nav-item" onClick={() => { logout(); navigate('/login'); }}>
            <span style={{ width: 18, textAlign: 'center' }}>↩</span> Exit demo
          </div>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="topbar">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div className="row">
            <span className="badge badge-neutral">{profile?.org || 'Demo'}</span>
            <span className="badge badge-success">Demo mode</span>
            <span className="avatar">{initials(profile?.name)}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
