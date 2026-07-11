/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminTeams from './pages/AdminTeams.jsx';
import AdminPlayers from './pages/AdminPlayers.jsx';
import AdminTrials from './pages/AdminTrials.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import AdminActivity from './pages/AdminActivity.jsx';
import AdminStats from './pages/AdminStats.jsx';
import AdminCoaches from './pages/AdminCoaches.jsx';
import AdminBroadcast from './pages/AdminBroadcast.jsx';
import AdminPlayerDetail from './pages/AdminPlayerDetail.jsx';
import AdminCoachDetail from './pages/AdminCoachDetail.jsx';
import CoachDashboard from './pages/CoachDashboard.jsx';
import CoachLogTraining from './pages/CoachLogTraining.jsx';
import CoachLogMatch from './pages/CoachLogMatch.jsx';
import CoachSchedule from './pages/CoachSchedule.jsx';
import CoachLineup from './pages/CoachLineup.jsx';
import CoachCheckin from './pages/CoachCheckin.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import CoachAnnouncements from './pages/CoachAnnouncements.jsx';
import CoachPlayerDetail from './pages/CoachPlayerDetail.jsx';
import Announcements from './pages/Announcements.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import ScheduleView from './pages/ScheduleView.jsx';
import Notifications from './pages/Notifications.jsx';
import TrialRegister from './pages/TrialRegister.jsx';

const ANY = ['admin','coach','player'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/trial/:qrToken" element={<TrialRegister />} />

      <Route path="/admin"          element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/teams"    element={<ProtectedRoute roles={['admin']}><AdminTeams /></ProtectedRoute>} />
      <Route path="/admin/players"  element={<ProtectedRoute roles={['admin']}><AdminPlayers /></ProtectedRoute>} />
      <Route path="/admin/coaches"  element={<ProtectedRoute roles={['admin']}><AdminCoaches /></ProtectedRoute>} />
      <Route path="/admin/coach/:id" element={<ProtectedRoute roles={['admin']}><AdminCoachDetail /></ProtectedRoute>} />
      <Route path="/admin/activity" element={<ProtectedRoute roles={['admin']}><AdminActivity /></ProtectedRoute>} />
      <Route path="/admin/stats"    element={<ProtectedRoute roles={['admin']}><AdminStats /></ProtectedRoute>} />
      <Route path="/admin/player/:id" element={<ProtectedRoute roles={['admin']}><AdminPlayerDetail /></ProtectedRoute>} />
      <Route path="/admin/broadcast" element={<ProtectedRoute roles={['admin']}><AdminBroadcast /></ProtectedRoute>} />
      <Route path="/admin/trials"   element={<ProtectedRoute roles={['admin']}><AdminTrials /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />

      <Route path="/coach"          element={<ProtectedRoute roles={['coach','admin']}><CoachDashboard /></ProtectedRoute>} />
      <Route path="/coach/training" element={<ProtectedRoute roles={['coach','admin']}><CoachLogTraining /></ProtectedRoute>} />
      <Route path="/coach/match"    element={<ProtectedRoute roles={['coach','admin']}><CoachLogMatch /></ProtectedRoute>} />
      <Route path="/coach/schedule" element={<ProtectedRoute roles={['coach','admin']}><CoachSchedule /></ProtectedRoute>} />
      <Route path="/coach/lineup"   element={<ProtectedRoute roles={['coach','admin']}><CoachLineup /></ProtectedRoute>} />
      <Route path="/coach/checkin"  element={<ProtectedRoute roles={['coach','admin']}><CoachCheckin /></ProtectedRoute>} />
      <Route path="/coach/announcements" element={<ProtectedRoute roles={['coach','admin']}><CoachAnnouncements /></ProtectedRoute>} />
      <Route path="/coach/player/:id" element={<ProtectedRoute roles={['coach','admin']}><CoachPlayerDetail /></ProtectedRoute>} />

      <Route path="/player"        element={<ProtectedRoute roles={['player','admin']}><PlayerProfile /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute roles={['player','admin']}><Announcements /></ProtectedRoute>} />

      <Route path="/leaderboard"   element={<ProtectedRoute roles={ANY}><Leaderboard /></ProtectedRoute>} />
      <Route path="/schedule"      element={<ProtectedRoute roles={ANY}><ScheduleView /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute roles={ANY}><Notifications /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
