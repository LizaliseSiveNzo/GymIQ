/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useNavigate } from 'react-router-dom';

// Global quick-add sheet from the center FAB. MF parity structure:
// circular actions row · Up Next card · list actions · configure.
// Items marked "phase n" are intentional scaffolds until that phase lands.
export default function ShortcutsSheet({ onClose }) {
  const navigate = useNavigate();

  const rings = [
    { icon: '⚖️', label: 'Weight', go: () => navigate('/customer/progress') },
    { icon: '📷', label: 'Photos', soon: 'phase 6' },
    { icon: '📏', label: 'Metrics', go: () => navigate('/customer/progress') },
    { icon: '🕘', label: 'History', soon: 'phase 4' },
  ];
  const rows = [
    { icon: '📝', label: 'Empty Workout', soon: 'phase 4' },
    { icon: '🧩', label: 'New Program', soon: 'phase 3' },
    { icon: '🏋', label: 'New Workout', soon: 'phase 4' },
  ];

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Shortcuts">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <strong>Shortcuts</strong>
          <button className="btn btn-ghost" style={{ minHeight: 30 }} aria-label="Configure shortcuts">⚙</button>
        </div>

        <div className="ring-actions">
          {rings.map((r) => (
            <button key={r.label} className="ring-action" disabled={!r.go} onClick={r.go}>
              <span className="orb">{r.icon}</span>
              {r.label}
              {r.soon && <span className="soon">{r.soon}</span>}
            </button>
          ))}
        </div>

        <div
          className="mf-card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: .75 }}
        >
          <div>
            <h4>Up Next · Workout A</h4>
            <div className="subtle" style={{ fontSize: 13 }}>
              Connects to your generated program in Phase 3–4.
            </div>
          </div>
          <span className="chev" style={{ color: 'var(--text-subtle)', fontSize: 20 }}>›</span>
        </div>

        <div style={{ marginTop: 10 }}>
          {rows.map((r) => (
            <button key={r.label} className="list-row" disabled={!!r.soon}>
              <span className="ic">{r.icon}</span>
              <span className="grow">{r.label}</span>
              {r.soon && <span className="soon">{r.soon}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
