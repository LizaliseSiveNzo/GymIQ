/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import './tour.css';

const STEPS = [
  { icon: '📋', title: 'Build your programme', to: '/onboarding?new=1', desc: 'Answer a few questions and GymIQ builds a plan around your goal, schedule and equipment.' },
  { icon: '🏋️', title: 'Log a workout', to: '/workout', desc: 'Start a session, log sets and reps, use the rest timer and follow the progression coach.' },
  { icon: '🥗', title: 'Log your food', to: '/bank', desc: 'Set a monthly goal, build meals and log what you eat in the Calorie Bank.' },
  { icon: '📅', title: 'Review your week', to: '/workout/check-in', desc: 'Each week, review what you completed and accept suggested target changes.' },
  { icon: '📈', title: 'See your progress', to: '/workout/stats', desc: 'Track personal records, exercise history and your monthly progress story.' },
  { icon: '✦', title: 'Talk to your coach', to: '/coach', desc: 'Ask your personal AI coach for meals and workouts built from your own data.' },
];

export default function Tour() {
  return <TabShell title="How GymIQ works">
    <p className="tour-intro">A quick tour of your daily edge — tap any step to go there now.</p>
    <section className="mf-card">
      <div className="list-card">
        {STEPS.map((s) => (
          <Link key={s.to} className="list-row tour-row" to={s.to}>
            <span className="tour-icon" aria-hidden="true">{s.icon}</span>
            <span className="tour-body"><strong>{s.title}</strong><small>{s.desc}</small></span>
            <span className="chev" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </section>
    <p className="tour-footer">This guide lives here under Account → How GymIQ works, so you can come back anytime.</p>
  </TabShell>;
}
