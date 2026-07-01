import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
// Branded login/register screen + demo entry. Real auth lands in Phase 1 (Blueprint Prompt 2).

const ROLES = ['Admin', 'Coach', 'Parent', 'Player'];

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [role, setRole] = useState('Admin');
  const { demoLogin } = useAuth();
  const navigate = useNavigate();

  function enterDemo(r) {
    demoLogin(r);
    navigate(r === 'player' ? '/player' : `/${r}`);
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="row" style={{ gap: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>
          <span className="dot" /> PitchIQ
        </div>
        <div>
          <h2>Run your academy like a pro club.</h2>
          <p style={{ color: '#C7D2E1', maxWidth: 420 }}>
            Track players, keep parents in the loop, run trials, and measure performance —
            all in one place. One subscription per school.
          </p>
        </div>
        <p className="subtle" style={{ color: '#8FA0B6', margin: 0 }}>Built with Claude · RevidArch</p>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h1 style={{ fontSize: 26 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p>{mode === 'login' ? 'Sign in to your academy dashboard.' : 'Choose your role to get started.'}</p>

          {mode === 'register' && (
            <div className="field">
              <label className="label">I am a…</label>
              <div className="segmented" role="tablist">
                {ROLES.map((r) => (
                  <button key={r} aria-selected={role === r} onClick={() => setRole(r)}>{r}</button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {mode === 'register' && (
              <div className="field">
                <label className="label">Full name</label>
                <input className="input" placeholder="Your name" />
              </div>
            )}
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="director@academy.co.za" />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" />
            </div>

            {mode === 'register' && role === 'Parent' && (
              <div className="field">
                <label className="label">Child code</label>
                <input className="input" placeholder="Code from your academy" />
              </div>
            )}

            <button className="btn btn-primary btn-lg btn-block" type="submit">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Demo entry — explore the app without an account */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 14px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="subtle" style={{ fontSize: 12 }}>Or explore a live demo</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => enterDemo('admin')}>View as Admin</button>
            <button className="btn btn-secondary" onClick={() => enterDemo('coach')}>View as Coach</button>
            <button className="btn btn-secondary" onClick={() => enterDemo('parent')}>View as Parent</button>
            <button className="btn btn-secondary" onClick={() => enterDemo('player')}>View as Player</button>
          </div>

          <p className="subtle" style={{ textAlign: 'center', marginTop: 18 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
            <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ cursor: 'pointer' }}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
