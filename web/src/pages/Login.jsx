/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
// Supabase auth + role demo entry.

import { CONSENT_VERSION } from './Privacy.jsx';

// Adults-only, two-role product. Internally these map to 'coach' and 'player'
// (see migration 0056) — the enum values were left alone deliberately.
const ROLES = [
  { key: 'trainer',  label: 'Trainer',  blurb: 'I train clients' },
  { key: 'customer', label: 'Customer', blurb: 'I train with a trainer' },
];

// role -> landing route after auth
export const HOME_FOR_ROLE = { coach: '/trainer', player: '/customer', admin: '/trainer' };

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [role, setRole] = useState('trainer');
  const [consent, setConsent] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
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
        // usernames work too: "coach" -> coach@gymiq.app
        const loginEmail = email.includes('@') ? email.trim() : `${email.trim().toLowerCase()}@gymiq.app`;
        const { error, role: r } = await signIn({ email: loginEmail, password });
        if (error) { setError(error); return; }
        navigate(HOME_FOR_ROLE[r] || '/customer');
      } else {
        if (!consent) { setError('Please confirm you accept the privacy policy to continue.'); return; }
        const { error, needsConfirmation } = await signUp({
          name, email: email.trim(), password,
          role,
          consent: true,
          consentVersion: CONSENT_VERSION,
          inviteCode: role === 'customer' ? inviteCode.trim() : null,
        });
        if (error) { setError(error); return; }
        if (needsConfirmation) {
          setNotice('Account created. Check your email to confirm, then sign in.');
          setMode('login');
        } else {
          navigate(role === 'trainer' ? '/trainer' : '/customer');
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
          <span className="dot" /> GymIQ
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
              <label className="label">I'm signing up as</label>
              <div className="row" style={{ gap: 10 }}>
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    aria-pressed={role === r.key}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: role === r.key ? 'var(--brand-50, #fdf2f4)' : 'transparent',
                      border: `1.5px solid ${role === r.key ? 'var(--brand, #C8102E)' : 'var(--border)'}`,
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{r.label}</span>
                    <span className="subtle" style={{ fontSize: 12 }}>{r.blurb}</span>
                  </button>
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

            {mode === 'register' && role === 'customer' && (
              <div className="field">
                <label className="label">Trainer invite code <span className="subtle">(optional)</span></label>
                <input className="input" placeholder="e.g. LZ4K9P"
                  value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
                <p className="subtle" style={{ fontSize: 12, margin: '4px 0 0' }}>
                  If your trainer gave you a code, enter it to link your account to them. You can add it later.
                </p>
              </div>
            )}

            {mode === 'register' && (
              <div className="field" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                  <span style={{ fontSize: 13 }}>
                    I am 18 or over, and I have read and accept the{' '}
                    <Link to="/privacy" target="_blank">privacy policy</Link> and consent to my
                    information being processed.
                  </span>
                </label>
              </div>
            )}

            {error &&  <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            {notice && <p style={{ color: 'var(--green-700)', fontSize: 13, margin: '0 0 12px' }}>{notice}</p>}

            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || (mode === 'register' && !consent)}>
              {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="subtle" style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
            <Link to="/privacy">Privacy policy</Link>
          </p>

          <p className="subtle" style={{ textAlign: 'center', marginTop: 8 }}>
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
