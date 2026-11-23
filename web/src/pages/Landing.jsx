import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Phone({ src, alt }) {
  return <div className="phone-frame"><img src={src} alt={alt} loading="lazy" decoding="async" /></div>;
}

function Feature({ number, eyebrow, title, copy, tags, badge, media, reverse, video }) {
  const premium = /premium/i.test(badge || '');
  return (
    <section className={`landing-row${reverse ? ' reverse' : ''}`}>
      <div className="landing-copy">
        <div className="feature-number">{number}</div>
        <div className="launch-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="feature-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
        {badge && <span className={`feature-badge${premium ? ' is-premium' : ' is-free'}`}>{badge}</span>}
      </div>
      <div className="landing-media">
        <Phone src={media} alt={title} />
        {video && <video className="landing-video" src={video} poster={media} muted loop playsInline autoPlay preload="metadata" aria-label={`${eyebrow} in action`} />}
      </div>
    </section>
  );
}

export default function Landing() {
  const { session } = useAuth();
  if (session) return <Navigate to="/workout" replace />;
  return (
    <div className="launch-site">
      <nav className="launch-nav" aria-label="Website navigation">
        <Link to="/" className="app-wordmark">GYM<span>IQ</span></Link>
        <div className="row"><Link to="/login" className="btn btn-ghost">Sign in</Link><Link to="/login?mode=register" className="btn btn-primary">Get started ↗</Link></div>
      </nav>
      <main>
        <section className="launch-hero">
          <div>
            <div className="launch-eyebrow">THE WORKOUT. THE FUEL. THE PROGRESS.</div>
            <h1>Show up.<br />Get stronger.<br /><span>Make it count.</span></h1>
            <p className="launch-lead">Your training deserves a plan. Build workouts around your goals and equipment, log every set, and fuel your progress with Calorie Bank.</p>
            <div className="launch-actions"><Link className="btn btn-primary btn-lg" to="/login?mode=register">Build my programme ↗</Link><a className="btn btn-secondary btn-lg" href="#features">Explore GymIQ</a></div>
            <p className="launch-caption">7-day free trial · No card needed.</p>
          </div>
          <Phone src="/landing/workout-today.jpg" alt="GymIQ training week view" />
        </section>

        <section id="features" className="landing-features">
          <Feature number="01 / WORKOUTS" eyebrow="PERSONAL WORKOUTS" title="Your programme. Your next personal best." copy="A programme shaped by your goal, available equipment and training schedule. Log weights, reps and effort, use rest timers, and revisit every session in your history." tags={['Personal programmes', 'Live set logging', 'Rest timers', 'Workout history']} badge="PREMIUM" media="/landing/live-session.jpg" />
          <Feature reverse number="02 / CALORIE BANK" eyebrow="CALORIE BANK" title="The bigger picture behind every meal." copy="Set a calorie target, log food and activity, and follow your running balance. Weight check-ins and your full food ledger stay free." tags={['Calorie targets', 'Food & activity', 'Weight check-ins', 'Balance ledger']} badge="FREE" media="/landing/calorie-bank.jpg" />
          <Feature number="03 / SNAP YOUR MEAL" eyebrow="SNAP YOUR MEAL" title="Point. Shoot. Know your calories." copy="Photograph any meal or packaged product — an Oreo, a KFC Zinger, a home-cooked plate — and GymIQ returns calories and macros using a local South African food database." tags={['Photo analysis', 'SA food & fast food', 'Serving sizes', 'Packaged products']} badge="FREE 3/day · PREMIUM unlimited" media="/landing/snap-result.jpg" video="/landing/snap-flow.mp4" />
          <Feature reverse number="04 / AI COACH" eyebrow="AI COACH" title="A coach in your pocket." copy="Talk to your personal coach about meals, training and your next step. Dictate a message and hear the reply read aloud." tags={['Personal coach', 'Voice dictation', 'Read-aloud replies', 'Meal & workout plans']} badge="PREMIUM" media="/landing/coach-conversation.jpg" video="/landing/coach-preview.mp4" />
          <Feature number="05 / PROGRESS" eyebrow="PROGRESS & INSIGHTS" title="See your progress. Stay motivated." copy="Training analytics, exercise stats and personal records — so you can see exactly how far you've come." tags={['Training analytics', 'Exercise stats', 'Personal records', 'Progress reports']} badge="PREMIUM" media="/landing/analytics.jpg" />
        </section>

        <section className="launch-plans">
          <div className="launch-section-heading"><div className="launch-eyebrow">FREE VS PREMIUM</div><h2>What's free. What's premium.</h2></div>
          <div className="plans-grid">
            <div className="plan-col">
              <h3>Free forever</h3>
              <ul>
                <li>Freestyle workouts</li>
                <li>Exercise records & history</li>
                <li>Manual food logging</li>
                <li>Calorie targets</li>
                <li>3 photo scans a day</li>
              </ul>
            </div>
            <div className="plan-col premium">
              <h3>Premium <span>· 7-day free trial</span></h3>
              <ul>
                <li>Personal workout programmes</li>
                <li>Daily meal plans</li>
                <li>AI coach with voice replies</li>
                <li>Advanced training analytics</li>
                <li>Unlimited photo scans</li>
              </ul>
              <Link className="btn btn-primary" to="/login?mode=register">Start free trial ↗</Link>
            </div>
          </div>
        </section>

        <section className="launch-price"><div><div className="launch-eyebrow">KEEP IT SIMPLE</div><h2>Start free.<br />Grow with premium.</h2><p>Freestyle workouts, exercise records and manual food logging are free. Try premium free for your first 7 days.</p></div><div className="membership-card"><span>GYMIQ PREMIUM</span><div className="membership-price">R100 <small>/ month</small></div><p>R300 for 3 months · R600 for 6 months · R1200 for 12 months. Renew manually through Yoco. No automatic debit.</p><ul><li>Personal workout programmes</li><li>Daily meal plans and AI insights</li><li>Advanced training and progress reports</li></ul><Link to="/login?mode=register" className="btn btn-primary btn-lg btn-block">Create your account ↗</Link></div></section>
      </main>
      <footer className="launch-footer"><span>© {new Date().getFullYear()} GymIQ · Lizalise Nzo</span><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></footer>
    </div>
  );
}
