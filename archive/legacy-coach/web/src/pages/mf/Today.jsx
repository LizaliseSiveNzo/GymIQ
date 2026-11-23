/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import CalorieBankCard from '../../components/ui/CalorieBankCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function HabitGrid({ lit = 0 }) {
  return (
    <div className="habit-grid">
      {Array.from({ length: 30 }, (_, i) => (
        <span key={i} className={`habit-cell ${i < lit ? 'lit' : ''}`} />
      ))}
    </div>
  );
}

// TODAY — customizable widget dashboard (layout scaffold).
// Widget framework + real data + Customize editor: Phase 6.
export default function Today() {
  const { profile } = useAuth();
  return (
    <TabShell active="today" title="Today">
      {/* Calorie Bank — the heart of the app, front and centre on Home */}
      <CalorieBankCard userId={profile?.id} />

      <p className="subtle" style={{ marginTop: 12 }}>
        Widget scaffold — live data and the Customize editor arrive in{' '}
        <strong>Phase&nbsp;6</strong>.
      </p>

      {/* Weekly rings hero */}
      <section className="mf-card">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h4>This week</h4>
          <span className="soon">phase 6</span>
        </div>
        <div className="subtle" style={{ fontSize: 13 }}>Active Program · target — sets</div>
        <div className="rings-row" style={{ marginTop: 14 }}>
          {['Sets', 'Exercises', 'Muscles'].map((label) => (
            <div key={label} className="ring-ph">
              <div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>—</div>
                <div className="subtle" style={{ fontSize: 11 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Insights mini-cards → drill into existing legacy surfaces for now */}
      <div className="grid-2" style={{ marginTop: 12 }}>
        <Link to="/customer/log" className="mf-card">
          <h4>Workouts</h4>
          <div className="subtle" style={{ fontSize: 13 }}>Last 7 workouts · log one →</div>
        </Link>
        <Link to="/customer/progress" className="mf-card">
          <h4>Weight Trend</h4>
          <div className="subtle" style={{ fontSize: 13 }}>Last 7 days · weigh in →</div>
        </Link>
      </div>

      {/* Habit grids */}
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="mf-card">
          <h4>Weigh-In</h4>
          <div className="subtle" style={{ fontSize: 12 }}>Last 30 days</div>
          <HabitGrid lit={1} />
        </div>
        <div className="mf-card">
          <h4>Workouts</h4>
          <div className="subtle" style={{ fontSize: 12 }}>Last 30 days</div>
          <HabitGrid lit={0} />
        </div>
      </div>

      {/* Muscle / exercise cards placeholders */}
      <div className="sec-label">Muscle groups</div>
      <div className="grid-2">
        {['Chest', 'Biceps'].map((m) => (
          <div key={m} className="mf-card">
            <h4>{m}</h4>
            <div className="subtle" style={{ fontSize: 13 }}>Last 7 days · — sets</div>
          </div>
        ))}
      </div>
    </TabShell>
  );
}
