/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShortcutsSheet from './ShortcutsSheet.jsx';

// MF-style 5-slot bar: Today · Workout · (+) · Levels · More.
// The FAB does not navigate — it opens the global Shortcuts sheet.
const TABS = [
  { key: 'today', label: 'Today', icon: '▚', path: '/today' },
  { key: 'workout', label: 'Workout', icon: '🏋', path: '/workout' },
  { key: '__fab__' },
  { key: 'bank', label: 'Bank', icon: '🏦', path: '/bank' },
  { key: 'levels', label: 'Levels', icon: '🚀', path: '/levels' },
  { key: 'more', label: 'More', icon: '⋯', path: '/more' },
];

export default function TabShell({ active, title, showKicker = true, children }) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const kicker = new Date()
    .toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

  return (
    <div className="mf-app">
      <header className="mf-header">
        {showKicker && <div className="mf-kicker">{kicker}</div>}
        <h1 className="mf-title">{title}</h1>
      </header>

      <main className="mf-content">{children}</main>

      <nav className="mf-tabbar">
        {TABS.map((t) =>
          t.key === '__fab__' ? (
            <div className="mf-fabwrap" key="fab">
              <button className="mf-fab" aria-label="Shortcuts" onClick={() => setSheetOpen(true)}>+</button>
            </div>
          ) : (
            <button
              key={t.key}
              className={`mf-tab ${active === t.key ? 'active' : ''}`}
              onClick={() => navigate(t.path)}
            >
              <span className="ic">{t.icon}</span>
              {t.label}
            </button>
          )
        )}
      </nav>

      {sheetOpen && <ShortcutsSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
