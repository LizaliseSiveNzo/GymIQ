/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ProtectedRoute({ roles, children }) {
  const { session, profile, profileError, role, loading, logout } = useAuth();
  const location = useLocation();
  const [membership, setMembership] = useState(null);
  const [membershipError, setMembershipError] = useState('');
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    supabase.rpc('ensure_membership').then(({ data, error }) => {
      if (cancelled) return;
      if (error) setMembershipError('Could not check your membership. Please reload and try again.');
      else {
        setMembershipError('');
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.expires_at) { setMembershipError('Your membership could not be loaded. Please refresh.'); return; }
        setMembership({ ...row, checkedPath: location.pathname, checkedUser: profile.id });
      }
    });
    return () => { cancelled = true; };
  }, [profile?.id, location.pathname]);

  if (loading) return <div className="container">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  // The profile read finished and failed. Say so — never spin forever.
  if (!session.demo && !profile && profileError) {
    return (
      <div className="container" style={{ maxWidth: 520, padding: '48px 20px' }}>
        <h2 style={{ marginBottom: 8 }}>We couldn't load your account</h2>
        <p className="subtle" style={{ marginBottom: 16 }}>{profileError}</p>
        <button className="btn btn-primary" onClick={logout}>Sign out and try again</button>
      </div>
    );
  }

  // Real session whose profile is still being fetched — wait, don't bounce to login.
  if (!session.demo && !profile) return <div className="container">Loading…</div>;

  if (roles && !roles.includes(role)) return <Navigate to="/login" replace />;

  // MF-rebuild gate (Phase 2): every real account completes the onboarding
  // wizard exactly once before reaching any app surface.
  if (location.pathname !== '/more' && membershipError) return <div className="container"><p role="alert">{membershipError}</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button></div>;
  if (location.pathname !== '/more' && (!membership || membership.checkedPath !== location.pathname || membership.checkedUser !== profile?.id)) return <div className="app-loading" role="status">Preparing your GymIQ membership…</div>;
  const readOnly = location.pathname.startsWith('/workout/history');
  if (location.pathname !== '/more' && !readOnly && membership && new Date(membership.expires_at) <= new Date()) return <Navigate to="/more?membership=expired" replace />;
  if (!session.demo && profile && !profile.onboarded_at && !['/onboarding', '/more'].includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
