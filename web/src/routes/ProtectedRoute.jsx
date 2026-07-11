/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { session, profile, role, loading } = useAuth();

  if (loading) return <div className="container">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  // Real session whose profile is still being fetched — wait, don't bounce to login.
  if (!session.demo && !profile) return <div className="container">Loading…</div>;

  if (roles && !roles.includes(role)) return <Navigate to="/login" replace />;
  return children;
}
