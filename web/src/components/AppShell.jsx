/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import Assistant from './Assistant.jsx';

// [label, icon, path|null]
// GymIQ trainer↔client model. Internal roles stay 'coach'/'player'; labels are
// Trainer/Client. Client-centric nav: a client's programme, progress, nutrition
// and session log live INSIDE their detail page, not as top-level items.
const NAV = {
  admin:  [['Dashboard','▚','/admin'],['Teams','👥','/admin/teams'],['Players','⚽','/admin/players'],['Coaches','🏃','/admin/coaches'],['Activity','📒','/admin/activity'],['Broadcast','📣','/admin/broadcast'],['Trials','📋','/admin/trials'],['Settings','⚙','/admin/settings']],
  coach:  [['Dashboard','▚','/coach'],['Clients','👥','/coach/squad'],['Schedule','📅','/coach/schedule'],['Announcements','📣','/coach/announcements'],['Journal','📓','/coach/journal']],
  player: [['Home','🏦','/customer'],['Schedule','📅','/schedule'],['Exercises','🏋','/customer/exercises'],['Nutrition','🍎','/customer/nutrition'],['Log session','➕','/customer/log'],['Progress','📈','/customer/progress'],['Form AI','🎥','/customer/form'],['Journal','📓','/customer/journal'],['Announcements','📣','/announcements']],
};

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function AppShell({ active, title, children }) {
  const { profile, role, session, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[role] || [];
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    if (!session || session.demo) return;
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false)
      .then(({ count }) => setUnread(count || 0));
  }, [session]);

  function exit() { setMenuOpen(false); logout(); navigate('/login'); }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--energy)' }} /> GymIQ</div>
        {items.map(([label, icon, path]) => {
          const cls = `nav-item ${label === active ? 'active' : ''}`;
          const inner = <><span style={{ width: 18, textAlign: 'center' }}>{icon}</span> {label}</>;
          return path
            ? <Link key={label} to={path} className={cls}>{inner}</Link>
            : <div key={label} className={cls} style={{ opacity: .55, cursor: 'default' }} title="Coming soon">{inner}</div>;
        })}
        <div style={{ marginTop: 'auto' }}>
          <div className="nav-item" onClick={exit}><span style={{ width: 18, textAlign: 'center' }}>↩</span> Exit</div>
        </div>
      </aside>

      <div className="app-col" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header className="topbar">
          <div className="row" style={{ gap: 8 }}>
            <button className="hamburger" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
              <span className="hamburger-bars"><i /><i /><i /></span>
            </button>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <div className="row">
            {role === 'player' && (
              <button className="btn btn-ghost" style={{ minHeight: 36, padding: '6px 10px' }}
                onClick={() => setAssistantOpen((v) => !v)} title="Assistant">💬</button>
            )}
            <button className="btn btn-ghost" style={{ position: 'relative', minHeight: 36, padding: '6px 10px' }}
              onClick={() => navigate('/notifications')} title="Notifications">
              🔔
              {unread > 0 && <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--danger)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread}</span>}
            </button>
            <span className="badge badge-neutral hide-mobile">{profile?.org || 'GymIQ'}</span>
            <span className="avatar">{initials(profile?.name)}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      {/* Mobile dropdown menu (all pages) */}
      {menuOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="mobile-menu">
            {items.map(([label, icon, path]) => (
              path
                ? <Link key={label} to={path} className={label === active ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                    <span style={{ width: 22, textAlign: 'center' }}>{icon}</span> {label}
                  </Link>
                : <div key={label} className="m-item" style={{ opacity: .5 }}>
                    <span style={{ width: 22, textAlign: 'center' }}>{icon}</span> {label} <span className="subtle" style={{ fontSize: 12 }}>· soon</span>
                  </div>
            ))}
            <div className="m-item exit" onClick={exit}><span style={{ width: 22, textAlign: 'center' }}>↩</span> Exit</div>
          </nav>
        </>
      )}

      {/* Floating AI assistant window (client) */}
      {role === 'player' && assistantOpen && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 60,
          width: 'min(380px, 92vw)', maxHeight: '76vh', overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border-strong)',
          borderRadius: 16, boxShadow: 'var(--shadow-lg)',
        }}>
          <div className="row between" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
            <strong>Assistant</strong>
            <button className="btn btn-ghost" style={{ minHeight: 28, padding: '0 8px' }} onClick={() => setAssistantOpen(false)}>✕</button>
          </div>
          <div style={{ padding: 12 }}><Assistant /></div>
        </div>
      )}
    </div>
  );
}
