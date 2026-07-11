/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { Link } from 'react-router-dom';

const MODULES = [
  ['👤', 'Player profiles', 'Photo, position, medical info, injury history, diet plan — access-controlled.'],
  ['📊', 'Stats & attendance', 'Minutes, ratings, goals, assists. The data that justifies every decision.'],
  ['📅', 'Schedule & alerts', 'Fixtures, lineups, bench lists. Push notifications end the "when’s the game?" texts.'],
  ['🏆', 'Rank system', 'Rookie → Grand Master. A motivation engine players show their friends.'],
  ['📋', 'Trial management', 'QR check-in, digital registration, automated outcomes. No more 800-on-paper.'],
  ['💬', 'Coach–parent chat', 'In-app messaging and automated updates. No more WhatsApp chaos.'],
  ['⭐', 'Leaderboards', 'Top performers per division and a star-player spotlight per age group.'],
  ['➕', 'Multi-sport', 'Soccer, rugby, cricket, chess — same structure, add a sport in a click.'],
];

const PAINS = [
  ['"When’s the game?"', 'Parents flooding coaches with logistics questions.', 'Schedule + push notifications'],
  ['"Why is my kid benched?"', 'Bench decisions that spark arguments with no evidence.', 'Stats + bench reasons parents can see'],
  ['800 people on paper', 'Trial days run on clipboards and lost forms.', 'QR trial check-in + digital registration'],
];

const ROLES = [
  ['Admin', ['Manage all teams', 'View all players', 'Export reports', 'Invite coaches']],
  ['Coach', ['Log training & matches', 'Rate players', 'Notes & diet plans', 'Mark bench reasons']],
  ['Parent', ['See your child only', 'Stats & comments', 'Upcoming games', 'Bench reasons & diet']],
  ['Player', ['Your profile & rank', 'Training history', 'Upcoming fixtures', 'AI performance tips']],
];

const RANKS = ['Rookie', 'Rising Star', 'Elite', 'Master', 'Grand Master'];

export default function Landing() {
  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="inner">
          <div className="lp-logo"><span className="dot" /> PitchIQ</div>
          <div className="row" style={{ gap: 12 }}>
            <Link to="/login" className="btn btn-ghost">Sign in</Link>
            <Link to="/login" className="btn btn-primary">Book a pilot</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="lp-section hero-grid" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div>
            <div className="lp-eyebrow">Sports academy management</div>
            <h1 style={{ margin: '10px 0 16px' }}>Run your academy like a pro club.</h1>
            <p className="lead">
              PitchIQ digitises how academies track players, talk to parents, run trials, and measure
              performance — all in one place. One subscription per school.
            </p>
            <div className="row" style={{ gap: 12, marginTop: 24 }}>
              <Link to="/login" className="btn btn-primary btn-lg">Book a pilot</Link>
              <Link to="/login" className="btn btn-secondary btn-lg">See how it works</Link>
            </div>
            <p className="subtle" style={{ marginTop: 16, fontSize: 13 }}>Starts free · Soccer, rugby, cricket & more</p>
          </div>

          <div className="hero-mock">
            <div className="bar"><i /><i /><i /></div>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="kpi"><div className="kpi-label">Players</div><div className="kpi-value" style={{ fontSize: 26 }}>248</div></div>
              <div className="kpi"><div className="kpi-label">Attendance</div><div className="kpi-value" style={{ fontSize: 26 }}>87%</div></div>
            </div>
            <div className="card" style={{ marginTop: 10, padding: 16 }}>
              <div className="row between"><strong>Thabo Mokoena</strong><span className="rank-badge rank-Elite" style={{ padding: '4px 10px', fontSize: 12 }}>◆ Elite</span></div>
              <div className="progress energy" style={{ marginTop: 10 }}><span style={{ width: '62%' }} /></div>
            </div>
          </div>
        </div>
      </header>

      {/* Trust */}
      <div className="trust">
        <div className="inner">
          <span>Built for academies</span><span>·</span><span>One subscription per school</span><span>·</span><span>Zero capital to start</span>
        </div>
      </div>

      {/* Problem → solution */}
      <section className="lp-section">
        <div className="lp-eyebrow">The problems you know too well</div>
        <h2 style={{ margin: '8px 0 28px' }}>Stop running your academy from a group chat.</h2>
        <div className="pain">
          {PAINS.map(([t, d, s]) => (
            <div key={t} className="card">
              <b>{t}</b>
              <p style={{ margin: '8px 0 14px' }}>{d}</p>
              <span className="badge badge-success">→ {s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-eyebrow">Everything in one platform</div>
        <h2 style={{ margin: '8px 0 28px' }}>Eight modules that run the whole academy.</h2>
        <div className="lp-cards">
          {MODULES.map(([ic, h, p]) => (
            <div key={h} className="lp-card">
              <div className="ic">{ic}</div>
              <h4>{h}</h4>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-eyebrow">Built for everyone at the club</div>
        <h2 style={{ margin: '8px 0 28px' }}>One platform, four tailored experiences.</h2>
        <div className="roles">
          {ROLES.map(([r, items]) => (
            <div key={r} className="card">
              <h4 style={{ color: 'var(--green-700)' }}>{r}</h4>
              <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* Gamification band */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="band">
          <div className="lp-eyebrow" style={{ color: 'var(--energy)' }}>The motivation engine</div>
          <h2 style={{ margin: '8px 0 8px' }}>Players climb the ranks — and bring their friends.</h2>
          <p style={{ color: '#C7D2E1', maxWidth: 620 }}>
            Attendance, minutes, and coach ratings power a rank players are proud to show off.
            Engagement that turns parents and players into your best marketing.
          </p>
          <div className="ladder" style={{ marginTop: 22 }}>
            {RANKS.map((r, i) => (
              <div key={r} className={`step ${i === 2 ? 'active' : ''}`}>{r}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-section pricing" style={{ paddingTop: 0 }}>
        <div className="lp-eyebrow">Simple pricing</div>
        <h2 style={{ margin: '8px 0 4px' }}>One plan. One school. Everything included.</h2>
        <div className="price-card">
          <div className="lp-eyebrow">Per school</div>
          <div className="amt">Starts free</div>
          <p style={{ margin: '8px 0 20px' }}>All modules, all roles, unlimited teams and players. Add sports as you grow.</p>
          <Link to="/login" className="btn btn-primary btn-lg btn-block">Book a pilot</Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="inner">
          <div className="lp-logo" style={{ fontSize: 16 }}><span className="dot" /> PitchIQ</div>
          <span>© 2026 RevidArch · Built with Claude</span>
        </div>
      </footer>
    </div>
  );
}
