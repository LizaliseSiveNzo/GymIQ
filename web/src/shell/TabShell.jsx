import {useState} from 'react';
import { Link, NavLink } from 'react-router-dom';
import LogSyncBanner from '../components/ui/LogSyncBanner.jsx';
import InstallPrompt from '../components/ui/InstallPrompt.jsx';
import Timer from '../components/ui/Timer.jsx';
import './coachFab.css';
const TABS = [
  { label: 'Workouts', icon: '◈', path: '/workout' },
  { label: 'Calorie Bank', icon: '◎', path: '/bank' },
  { label: 'Account', icon: '☰', path: '/more' },
];
export default function TabShell({ title, showKicker = true, showCoachFab = true, headerAction, children }) {
  const [timerOpen, setTimerOpen] = useState(false);
  return <div className="mf-app">
    <header className="mf-header" style={{ position: 'relative' }}>
      <Link className="app-wordmark" to="/workout">GYM<span>IQ</span></Link>
      {showKicker && <div className="mf-kicker">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>{headerAction}<InstallPrompt/></div>
    </header>
    <main id="main-content" className="mf-content"><LogSyncBanner/>{children}</main>
    <nav className="mf-tabbar" aria-label="Main navigation">
      {TABS.map(t => <NavLink key={t.path} to={t.path} className={({ isActive }) => `mf-tab ${isActive ? 'active' : ''}`}>
        <span className="ic" aria-hidden="true">{t.icon}</span>{t.label}
      </NavLink>)}
    </nav>
    {showCoachFab && <button type="button" className="timer-fab" onClick={() => setTimerOpen(true)} aria-label="Open timer" title="Timer">⏱</button>}
    {showCoachFab && <Link className="coach-fab" to="/coach" aria-label="Open your AI coach" title="AI coach">✦</Link>}
    {timerOpen && <Timer onClose={() => setTimerOpen(false)} />}
  </div>;
}
