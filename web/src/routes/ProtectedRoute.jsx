/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Navigate, useLocation } from 'react-router-dom';
import useMembership from '../hooks/useMembership.js';
import PremiumPaywall from '../components/ui/PremiumPaywall.jsx';
import TabShell from '../shell/TabShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, premium=false, children }) {
  const { session, profile, profileError, role, loading, logout } = useAuth();
  const location = useLocation();
  const access=useMembership(profile?.id);

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

  if(premium&&!access.premium){
    if(access.checking)return <div className="app-loading" role="status">Checking your GymIQ access…</div>;
    return <TabShell title="GymIQ Premium"><PremiumPaywall/>{access.error&&<p role="alert">{access.error}</p>}</TabShell>;
  }
  if (!session.demo && profile && !profile.onboarded_at && access.premium && !['/onboarding','/more','/owner'].includes(location.pathname))return <Navigate to="/onboarding" replace/>;
  return children;
}
