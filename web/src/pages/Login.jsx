/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
// Real Supabase auth + master login (123/123) + role demo entry.

const ROLES = ['Coach', 'Player'];

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [role, setRole] = useState('Coach');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        // usernames work too: "coach" -> coach@pitchiq.app
        const loginEmail = email.includes('@') ? email.trim() : `${email.trim().toLowerCase()}@pitchiq.app`;
        const { error, role: r } = await signIn({ email: loginEmail, password });
        if (error) { setError(error); return; }
        navigate(`/${r}`);
      } else {
        const { error, needsConfirmation } = await signUp({
          name, email: email.trim(), password,
          role: role.toLowerCase(),
        });
        if (error) { setError(error); return; }
        if (needsConfirmation) {
          setNotice('Account created. Check your email to confirm, then sign in.');
          setMode('login');
        } else {
          navigate(`/${role.toLowerCase()}`);
        }
      }
    } finally {
      setBusy(false);
    }
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
              <p className="subtle" style={{ fontSize: 13, margin: '0 0 10px' }}>
                👨‍👩‍👧 <strong>Parents:</strong> no separate account needed — sign in with your child's Player account to see their notes, meal plan and schedule.
              </p>
              <label className="label">I am a…</label>
              <div className="segmented" role="tablist">
                {ROLES.map((r) => (
                  <button key={r} type="button" aria-selected={role === r} onClick={() => setRole(r)}>{r}</button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="field">
                <label className="label">Full name</label>
                <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="text"
                placeholder={mode === 'login' ? 'Email or username' : 'director@academy.co.za'}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error &&  <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            {notice && <p style={{ color: 'var(--green-700)', fontSize: 13, margin: '0 0 12px' }}>{notice}</p>}

            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="subtle" style={{ textAlign: 'center', marginTop: 18 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
            <a onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice(''); }} style={{ cursor: 'pointer' }}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
