import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Workout = lazy(() => import('./pages/mf/WorkoutTab.jsx'));
const Bank = lazy(() => import('./pages/mf/BankTab.jsx'));
const Account = lazy(() => import('./pages/mf/MoreMenu.jsx'));
const Onboard = lazy(() => import('./pages/onboarding/Onboard.jsx'));
const Exercises = lazy(() => import('./pages/mf/ExercisesBrowse.jsx'));
const Session = lazy(() => import('./pages/mf/SessionPlayer.jsx'));
const Summary = lazy(() => import('./pages/mf/WorkoutSummary.jsx'));
const History = lazy(() => import('./pages/mf/HistoryList.jsx').then(m => ({ default: m.HistoryList })));
const Detail = lazy(() => import('./pages/mf/HistoryDetail.jsx').then(m => ({ default: m.HistoryDetail })));
const Stats = lazy(() => import('./pages/mf/ExerciseStats.jsx'));
const secure = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
export default function App() {
  return <Suspense fallback={<div className="app-loading" role="status">Loading GymIQ…</div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/onboarding" element={secure(<Onboard />)} />
      <Route path="/workout" element={secure(<Workout />)} />
      <Route path="/bank" element={secure(<Bank />)} />
      <Route path="/more" element={secure(<Account />)} />
      <Route path="/exercises" element={secure(<Exercises />)} />
      <Route path="/workout/day/:dayId" element={secure(<Summary />)} />
      <Route path="/workout/session/free" element={secure(<Session />)} />
      <Route path="/workout/session/:dayId" element={secure(<Session />)} />
      <Route path="/workout/history" element={secure(<History />)} />
      <Route path="/workout/stats" element={secure(<Stats />)} />
      <Route path="/workout/history/:logId" element={secure(<Detail />)} />
      <Route path="/customer/calorie-bank" element={<Navigate to="/bank" replace />} />
      <Route path="*" element={<Navigate to="/workout" replace />} />
    </Routes>
  </Suspense>;
}
