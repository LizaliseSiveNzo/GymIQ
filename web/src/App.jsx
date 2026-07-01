import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminTeams from './pages/AdminTeams.jsx';
import AdminPlayers from './pages/AdminPlayers.jsx';
import CoachDashboard from './pages/CoachDashboard.jsx';
import CoachLogTraining from './pages/CoachLogTraining.jsx';
import CoachLogMatch from './pages/CoachLogMatch.jsx';
import ParentDashboard from './pages/ParentDashboard.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import TrialRegister from './pages/TrialRegister.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/trial/:qrToken" element={<TrialRegister />} />

      <Route path="/admin"         element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/teams"   element={<ProtectedRoute roles={['admin']}><AdminTeams /></ProtectedRoute>} />
      <Route path="/admin/players" element={<ProtectedRoute roles={['admin']}><AdminPlayers /></ProtectedRoute>} />

      <Route path="/coach"          element={<ProtectedRoute roles={['coach','admin']}><CoachDashboard /></ProtectedRoute>} />
      <Route path="/coach/training" element={<ProtectedRoute roles={['coach','admin']}><CoachLogTraining /></ProtectedRoute>} />
      <Route path="/coach/match"    element={<ProtectedRoute roles={['coach','admin']}><CoachLogMatch /></ProtectedRoute>} />

      <Route path="/parent" element={<ProtectedRoute roles={['parent','admin']}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/player" element={<ProtectedRoute roles={['player','admin']}><PlayerProfile /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
