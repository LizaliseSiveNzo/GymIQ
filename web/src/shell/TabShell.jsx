import { Link, NavLink } from 'react-router-dom';
import LogSyncBanner from '../components/ui/LogSyncBanner.jsx';
const TABS = [
  { label: 'Workouts', icon: '◈', path: '/workout' },
  { label: 'Calorie Bank', icon: '◎', path: '/bank' },
  { label: 'Account', icon: '☰', path: '/more' },
];
export default function TabShell({ title, showKicker = true, children }) {
  return <div className="mf-app">
    <header className="mf-header">
      <Link className="app-wordmark" to="/workout">GYM<span>IQ</span><span className="wordmark-note">YOUR DAILY EDGE</span></Link>
      {showKicker && <div className="mf-kicker">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
      <h1 className="mf-title">{title}</h1>
    </header>
    <main id="main-content" className="mf-content"><LogSyncBanner/>{children}</main>
    <nav className="mf-tabbar" aria-label="Main navigation">
      {TABS.map(t => <NavLink key={t.path} to={t.path} className={({ isActive }) => `mf-tab ${isActive ? 'active' : ''}`}>
        <span className="ic" aria-hidden="true">{t.icon}</span>{t.label}
      </NavLink>)}
    </nav>
  </div>;
}
