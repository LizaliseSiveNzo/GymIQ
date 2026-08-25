/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

// ---- MF-rebuild shell (Phases 0–7). Rollback: set VITE_LEGACY_UI=1 in web/.env ----
import Today from './pages/mf/Today.jsx';
import WorkoutTab from './pages/mf/WorkoutTab.jsx';
import SetLevels from './pages/mf/SetLevels.jsx';
import MoreMenu from './pages/mf/MoreMenu.jsx';
import ExercisesBrowse from './pages/mf/ExercisesBrowse.jsx';
import BankTab from './pages/mf/BankTab.jsx';
import Onboard from './pages/onboarding/Onboard.jsx';
import SessionPlayer from './pages/mf/SessionPlayer.jsx';
import WorkoutSummary from './pages/mf/WorkoutSummary.jsx';
import { HistoryList } from './pages/mf/HistoryList.jsx';
import { HistoryDetail } from './pages/mf/HistoryDetail.jsx';

// ---- Legacy app (trainer↔client). Mounted until Phase 7 cutover; kept working. ----
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Privacy from './pages/Privacy.jsx';
import CoachDashboard from './pages/CoachDashboard.jsx';
import CoachSquad from './pages/CoachSquad.jsx';
import CoachJournal from './pages/CoachJournal.jsx';
import CoachSchedule from './pages/CoachSchedule.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import ClientLog from './pages/ClientLog.jsx';
import ClientProgress from './pages/ClientProgress.jsx';
import ClientNutritionPage from './pages/ClientNutritionPage.jsx';
import ClientForm from './pages/ClientForm.jsx';
import ClientJournalPage from './pages/ClientJournalPage.jsx';
import ClientExercises from './pages/ClientExercises.jsx';
import ClientCalorieBank from './pages/ClientCalorieBank.jsx';
import CoachAnnouncements from './pages/CoachAnnouncements.jsx';
import CoachPlayerDetail from './pages/CoachPlayerDetail.jsx';
import Announcements from './pages/Announcements.jsx';
import ScheduleView from './pages/ScheduleView.jsx';
import Notifications from './pages/Notifications.jsx';

// VITE_LEGACY_UI=1 hides the new MF experience entirely (rollback hatch).
const LEGACY_ONLY = import.meta.env.VITE_LEGACY_UI === '1';

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

      {!LEGACY_ONLY && (
        <>
          {/* MF-rebuild five-tab experience */}
          <Route path="/onboarding" element={<ProtectedRoute roles={ANY}><Onboard /></ProtectedRoute>} />
          <Route path="/today" element={<ProtectedRoute roles={ANY}><Today /></ProtectedRoute>} />
          <Route path="/workout" element={<ProtectedRoute roles={ANY}><WorkoutTab /></ProtectedRoute>} />
          <Route path="/workout/day/:dayId" element={<ProtectedRoute roles={ANY}><WorkoutSummary /></ProtectedRoute>} />
          <Route path="/workout/session/free" element={<ProtectedRoute roles={ANY}><SessionPlayer /></ProtectedRoute>} />
          <Route path="/workout/session/:dayId" element={<ProtectedRoute roles={ANY}><SessionPlayer /></ProtectedRoute>} />
          <Route path="/workout/history" element={<ProtectedRoute roles={ANY}><HistoryList /></ProtectedRoute>} />
          <Route path="/workout/history/:logId" element={<ProtectedRoute roles={ANY}><HistoryDetail /></ProtectedRoute>} />
          <Route path="/levels" element={<ProtectedRoute roles={ANY}><SetLevels /></ProtectedRoute>} />
          <Route path="/more" element={<ProtectedRoute roles={ANY}><MoreMenu /></ProtectedRoute>} />
          <Route path="/exercises" element={<ProtectedRoute roles={ANY}><ExercisesBrowse /></ProtectedRoute>} />
          <Route path="/bank" element={<ProtectedRoute roles={ANY}><BankTab /></ProtectedRoute>} />
        </>
      )}

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
      <Route path="/customer/exercises" element={<ProtectedRoute roles={CLIENT}><ClientExercises /></ProtectedRoute>} />
      <Route path="/customer/log" element={<ProtectedRoute roles={CLIENT}><ClientLog /></ProtectedRoute>} />
      <Route path="/customer/progress" element={<ProtectedRoute roles={CLIENT}><ClientProgress /></ProtectedRoute>} />
      <Route path="/customer/nutrition" element={<ProtectedRoute roles={CLIENT}><ClientNutritionPage /></ProtectedRoute>} />
      <Route path="/customer/calorie-bank" element={<ProtectedRoute roles={CLIENT}><ClientCalorieBank /></ProtectedRoute>} />
      <Route path="/customer/form" element={<ProtectedRoute roles={CLIENT}><ClientForm /></ProtectedRoute>} />
      <Route path="/customer/journal" element={<ProtectedRoute roles={CLIENT}><ClientJournalPage /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute roles={CLIENT}><Announcements /></ProtectedRoute>} />

      {/* Shared */}
      <Route path="/schedule" element={<ProtectedRoute roles={ANY}><ScheduleView /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute roles={ANY}><Notifications /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
