/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {loadMembership,savedMembership} from '../lib/membership.js';

export default function ProtectedRoute({ roles, children }) {
  const { session, profile, profileError, role, loading, logout } = useAuth();
  const location = useLocation();
  const [membership, setMembership] = useState(()=>{const saved=savedMembership(profile?.id);return saved?{...saved.data,checkedUser:profile.id}:null;});
  const [membershipError, setMembershipError] = useState('');
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled=false;
    const saved=savedMembership(profile.id);
    setMembership(saved?{...saved.data,checkedUser:profile.id}:null);
    setMembershipError('');
    const load=()=>{
      if(!navigator.onLine){if(!saved)setMembershipError('Connect once to save your account access on this device.');return;}
      void loadMembership(profile.id).then(row=>{if(!cancelled){setMembershipError('');setMembership({...row,checkedUser:profile.id});}})
       .catch(e=>{if(!cancelled&&!saved)setMembershipError(e.message);});
    };
    load();window.addEventListener('online',load);
    return()=>{cancelled=true;window.removeEventListener('online',load);};
  }, [profile?.id]);

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
  if(!session.demo&&profile?.id!==session.user?.id)return <div className="app-loading" role="status">Opening your account…</div>;

  if (roles && !roles.includes(role)) return <Navigate to="/login" replace />;

  // MF-rebuild gate (Phase 2): every real account completes the onboarding
  // wizard exactly once before reaching any app surface.
  if (location.pathname !== '/more' && membershipError) return <div className="container"><p role="alert">{membershipError}</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button></div>;
  if (location.pathname !== '/more' && (!membership || membership.checkedUser !== profile?.id)) return <div className="app-loading" role="status">Preparing your GymIQ membership…</div>;
  const readOnly = !navigator.onLine&&['/workout','/bank'].includes(location.pathname)||location.pathname.startsWith('/workout/history') || location.pathname === '/workout/stats' || location.pathname === '/workout/analytics' || location.pathname === '/workout/progress-story';
  if (location.pathname !== '/more' && !readOnly && membership && new Date(membership.expires_at) <= new Date()) return <Navigate to="/more?membership=expired" replace />;
  if (!session.demo && profile && !profile.onboarded_at && !['/onboarding', '/more'].includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
