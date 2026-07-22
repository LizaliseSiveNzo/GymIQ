/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { TONE } from '../lib/insights.js';

export default function InsightCards({ items = [], loading = false, empty = 'No insights yet.' }) {
  if (loading) return <p className="subtle" style={{ margin: 0 }}>Working out what matters…</p>;
  if (!items.length) return <p className="subtle" style={{ margin: 0 }}>{empty}</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((c, i) => {
        const t = TONE[c.tone] || TONE.neutral;
        return (
          <div key={i} style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${t.border}`, borderRadius: 12, padding: '10px 12px' }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 17, lineHeight: 1.3 }}>{c.icon}</span>
              <div>
                <strong style={{ fontSize: 13.5 }}>{c.title}</strong>
                <div className="subtle" style={{ fontSize: 12.5, marginTop: 2 }}>{c.detail}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
