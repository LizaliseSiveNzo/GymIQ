/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Privacy from './pages/Privacy.jsx';
import CoachDashboard from './pages/CoachDashboard.jsx';
import CoachSquad from './pages/CoachSquad.jsx';
import CoachJournal from './pages/CoachJournal.jsx';
import CoachSchedule from './pages/CoachSchedule.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import CoachAnnouncements from './pages/CoachAnnouncements.jsx';
import CoachPlayerDetail from './pages/CoachPlayerDetail.jsx';
import Announcements from './pages/Announcements.jsx';
import ScheduleView from './pages/ScheduleView.jsx';
import Notifications from './pages/Notifications.jsx';

// Two-role model (0056): internal 'coach' shows as Trainer, 'player' as Client.
const TRAINER = ['coach', 'admin'];
const CLIENT = ['player', 'admin'];
const ANY = ['admin', 'coach', 'player'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Trainer */}
      <Route path="/trainer" element={<ProtectedRoute roles={TRAINER}><CoachDashboard /></ProtectedRoute>} />
      <Route path="/coach" element={<Navigate to="/trainer" replace />} />
      <Route path="/coach/dashboard" element={<ProtectedRoute roles={TRAINER}><CoachDashboard /></ProtectedRoute>} />
      <Route path="/coach/squad" element={<ProtectedRoute roles={TRAINER}><CoachSquad /></ProtectedRoute>} />
      <Route path="/coach/schedule" element={<ProtectedRoute roles={TRAINER}><CoachSchedule /></ProtectedRoute>} />
      <Route path="/coach/announcements" element={<ProtectedRoute roles={TRAINER}><CoachAnnouncements /></ProtectedRoute>} />
      <Route path="/coach/journal" element={<ProtectedRoute roles={TRAINER}><CoachJournal /></ProtectedRoute>} />
      <Route path="/coach/player/:id" element={<ProtectedRoute roles={TRAINER}><CoachPlayerDetail /></ProtectedRoute>} />

      {/* Client */}
      <Route path="/customer" element={<ProtectedRoute roles={CLIENT}><PlayerProfile /></ProtectedRoute>} />
      <Route path="/player" element={<Navigate to="/customer" replace />} />
      <Route path="/announcements" element={<ProtectedRoute roles={CLIENT}><Announcements /></ProtectedRoute>} />

      {/* Shared */}
      <Route path="/schedule" element={<ProtectedRoute roles={ANY}><ScheduleView /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute roles={ANY}><Notifications /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
