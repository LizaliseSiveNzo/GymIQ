import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import ExerciseProgressList from '../../components/ui/ExerciseProgressList.jsx';
import { loadExerciseProgress } from '../../lib/loadExerciseProgress.js';
import { useAuth } from '../../context/AuthContext.jsx';
export default function ExerciseStats() {
  const { profile } = useAuth();
  const [progress,setProgress] = useState(null), [error,setError] = useState(''), [retry,setRetry] = useState(0);
  useEffect(()=>{
    if(!profile?.id) return;
    let cancelled=false;
    setError(''); setProgress(null);
    loadExerciseProgress(()=>cancelled).then(data=>{if(!cancelled)setProgress(data);}).catch(()=>{if(!cancelled)setError('Could not load your exercise stats. Please try again.');});
    return ()=>{cancelled=true;};
  },[profile?.id,retry]);
  return <TabShell title="Your progress."><div className="training-intro"><p>Your weights. Your reps. Your personal records.</p><Link to="/workout">← Workouts</Link></div>
    {error && <div className="inline-error" role="alert">{error} <button className="btn btn-ghost" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>}
    {!progress && !error && <p role="status">Loading exercise records…</p>}
    {progress && <ExerciseProgressList progress={progress}/>}
  </TabShell>;
}
