import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {captureReferral} from './lib/referrals.js';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import RouteLoadBoundary from './components/RouteLoadBoundary.jsx';
import WorkoutRecoveryPrompt from './components/ui/WorkoutRecoveryPrompt.jsx';
// Finishing must not depend on downloading another route after the save.
import {HistoryDetail as Detail} from './pages/mf/HistoryDetail.jsx';
const Landing = lazy(() => import('./pages/Landing.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Terms = lazy(() => import('./pages/TermsOfService.jsx'));
const Glossary = lazy(() => import('./pages/Glossary.jsx'));
const SkillProgress = lazy(() => import('./pages/mf/SkillProgress.jsx'));
const Workout = lazy(() => import('./pages/mf/WorkoutTab.jsx'));
const Bank = lazy(() => import('./pages/mf/BankTab.jsx'));
const Account = lazy(() => import('./pages/mf/MoreMenu.jsx'));
const Onboard = lazy(() => import('./pages/onboarding/Onboard.jsx'));
const Exercises = lazy(() => import('./pages/mf/ExercisesBrowse.jsx'));
const Session = lazy(() => import('./pages/mf/SessionPlayer.jsx'));
const Summary = lazy(() => import('./pages/mf/WorkoutSummary.jsx'));
const History = lazy(() => import('./pages/mf/HistoryList.jsx').then(m => ({ default: m.HistoryList })));
const Stats = lazy(() => import('./pages/mf/ExerciseStats.jsx'));
const Analytics = lazy(() => import('./pages/mf/TrainingAnalytics.jsx'));
const PersonalCoach = lazy(() => import('./pages/mf/PersonalCoach.jsx'));
const Tour = lazy(() => import('./pages/mf/Tour.jsx'));
const OwnerDashboard = lazy(() => import('./pages/mf/OwnerDashboard.jsx'));
const secure = (page, premium=false) => <ProtectedRoute premium={premium}>{page}</ProtectedRoute>;
export default function App() {
  useEffect(()=>{captureReferral();},[]);
  return <RouteLoadBoundary><Suspense fallback={<div className="app-loading" role="status">Opening GymIQ…</div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/glossary" element={<Glossary />} />
      <Route path="/skills" element={secure(<SkillProgress />)} />
      <Route path="/onboarding" element={secure(<Onboard />,true)} />
      <Route path="/workout" element={secure(<Workout />)} />
      <Route path="/bank" element={secure(<Bank />)} />
      <Route path="/more" element={secure(<Account />)} />
      <Route path="/owner" element={secure(<OwnerDashboard />)} />
      <Route path="/coach" element={secure(<PersonalCoach />,true)} />
      <Route path="/tour" element={secure(<Tour />)} />
      <Route path="/exercises" element={secure(<Exercises />)} />
      <Route path="/workout/day/:dayId" element={secure(<Summary />,true)} />
      <Route path="/workout/session/free" element={secure(<Session />)} />
      <Route path="/workout/session/:dayId" element={secure(<Session />)} />
      <Route path="/workout/history" element={secure(<History />)} />
      <Route path="/workout/stats" element={secure(<Stats />)} />
      <Route path="/workout/analytics" element={secure(<Analytics />,true)} />
      <Route path="/workout/progress-story" element={<Navigate to="/workout/analytics" replace />} />
      <Route path="/workout/check-in" element={<Navigate to="/workout/analytics" replace />} />
      <Route path="/workout/history/:logId" element={secure(<Detail />)} />
      <Route path="/customer/calorie-bank" element={<Navigate to="/bank" replace />} />
      <Route path="*" element={<Navigate to="/workout" replace />} />
    </Routes>
  </Suspense><WorkoutRecoveryPrompt/></RouteLoadBoundary>;
}
