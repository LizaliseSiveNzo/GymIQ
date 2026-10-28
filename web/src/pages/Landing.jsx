import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function Landing() {
  const { session } = useAuth();
  if (session) return <Navigate to="/workout" replace />;
  return <div className="launch-site">
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
          <div className="launch-actions"><Link className="btn btn-primary btn-lg" to="/login?mode=register">Build my programme ↗</Link><a className="btn btn-secondary btn-lg" href="#inside">Explore GymIQ</a></div>
          <p className="launch-caption">Built for your phone. Ready for your next session.</p>
        </div>
        <div className="product-preview" aria-label="Illustrative workout preview">
          <div className="preview-top"><span>GYMIQ / WORKOUTS</span><span className="live-pill">YOUR NEXT MOVE</span></div>
          <h2>A plan.<br />A purpose.<br /><span>A stronger you.</span></h2>
          <div className="preview-session"><span className="preview-letter">A</span><div><strong>Upper body</strong><p>Programme preview · 3 exercises</p></div><span>↗</span></div>
          {['Bench press', 'Seated cable row', 'Lateral raise'].map((name, i) => <div className="preview-exercise" key={name}><span>0{i + 1}</span><strong>{name}</strong><span>3 × 8–12</span></div>)}
          <div className="preview-bank"><span>◎ &nbsp; CALORIE BANK</span><strong>Your fuel, in focus.</strong><p>Food, activity and your calorie balance in one place.</p></div>
        </div>
      </section>
      <section id="inside" className="launch-features">
        <div className="launch-section-heading"><div className="launch-eyebrow">ONE APP. TWO ESSENTIALS.</div><h2>Train with intent.<br />Fuel with perspective.</h2></div>
        <article className="launch-feature flagship"><span className="feature-number">01 / WORKOUTS</span><h3>Your programme.<br />Your next personal best.</h3><p>A programme shaped by your goal, available equipment and training schedule. Track weights, reps and effort, use rest timers, and revisit every session in your history.</p><div className="feature-tags"><span>Personal programmes</span><span>Live set logging</span><span>Workout history</span></div><Link to="/login?mode=register">Find your next session ↗</Link></article>
        <article className="launch-feature"><span className="feature-number">02 / CALORIE BANK</span><h3>The bigger picture<br />behind every meal.</h3><p>Set a calorie target, log food and activity, and follow your running balance. A simple way to keep nutrition alongside your training.</p><div className="feature-tags"><span>Calorie targets</span><span>Food & activity</span><span>Balance & ledger</span></div><Link to="/login?mode=register">Put your fuel in focus ↗</Link></article>
      </section>
      <section className="launch-price"><div><div className="launch-eyebrow">KEEP IT SIMPLE</div><h2>One membership.<br />Both essentials.</h2><p>Workouts and Calorie Bank. Together, where they belong.</p></div><div className="membership-card"><span>GYMIQ MEMBERSHIP</span><div className="membership-price">R100 <small>/ 30 days</small></div><p>Renew manually through Yoco. No automatic debit.</p><ul><li>Personal workout programmes</li><li>Set logging, timers and session history</li><li>Calorie Bank, food and activity logging</li></ul><Link to="/login?mode=register" className="btn btn-primary btn-lg btn-block">Create your account ↗</Link></div></section>
    </main>
    <footer className="launch-footer"><span>© {new Date().getFullYear()} GymIQ · Lizalise Nzo</span><Link to="/privacy">Privacy & terms</Link></footer>
  </div>;
}
