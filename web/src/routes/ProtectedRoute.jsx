/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { session, profile, profileError, role, loading, logout } = useAuth();

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
  return children;
}
