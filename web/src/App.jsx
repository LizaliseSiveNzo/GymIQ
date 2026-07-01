import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import CoachDashboard from './pages/CoachDashboard.jsx';
import ParentDashboard from './pages/ParentDashboard.jsx';
import PlayerProfile from './pages/PlayerProfile.jsx';
import TrialRegister from './pages/TrialRegister.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/trial/:qrToken" element={<TrialRegister />} />

      <Route path="/admin"  element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/coach"  element={<ProtectedRoute roles={['coach','admin']}><CoachDashboard /></ProtectedRoute>} />
      <Route path="/parent" element={<ProtectedRoute roles={['parent','admin']}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/player" element={<ProtectedRoute roles={['player','admin']}><PlayerProfile /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
