/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import ExercisePicker from '../../components/ui/ExercisePicker.jsx';
import ProgressionCoach from '../../components/ui/ProgressionCoach.jsx';
import ExerciseIllustration from '../../components/ui/ExerciseIllustration.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { detectPRs, plateBreakdown } from '../../lib/engines/prs.js';
import useSessionTimer from '../../hooks/useSessionTimer.js';
import SessionTiming from '../../components/ui/SessionTiming.jsx';
import { formatSessionTime } from '../../lib/sessionClock.js';
import { createRestBell } from '../../lib/restBell.js';
import { loadExerciseProgress } from '../../lib/loadExerciseProgress.js';
import { previousFor, setDescription } from '../../lib/exerciseProgress.js';
import SessionDiscardDialog from '../../components/ui/SessionDiscardDialog.jsx';
import SetEditDialog from '../../components/ui/SetEditDialog.jsx';
import ExerciseTargetDialog from '../../components/ui/ExerciseTargetDialog.jsx';
import { exerciseDefault, loadExerciseTargets, targetKey } from '../../lib/exerciseTargets.js';

import {loadWorkoutWeek,weekStart,dayKey,exerciseIdentity} from '../../lib/workoutWeek.js';

const DEFAULT_SCHEME = { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 90 };
const fmtClock = formatSessionTime;

/**
 * Live workout logger.
 * /workout/session/:dayId  → prescribed day from the active program
 * /workout/session/free    → ad-hoc empty workout
 */
export default function SessionPlayer() {
  const params = useParams();
  const dayId = params.dayId && params.dayId !== 'free' ? params.dayId : null;
  const isFree = !dayId;
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errText, setErrText] = useState('');
  const [logId, setLogId] = useState(null);
  const [plan, setPlan] = useState([]);       // [{key,name,exerciseId,peId,laterality,equipmentIds,scheme}]
  const [done, setDone] = useState({});        // key → [inserted set rows]
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [extraRows, setExtraRows] = useState({}); // key → extra set rows beyond target
  const [barDenoms, setBarDenoms] = useState([1.25, 2.5, 5, 10, 20, 25]);
  const priorPrRef = useRef({});
  const logIdRef = useRef(null);
  const pendingSets = useRef(new Set());
  const [progress,setProgress] = useState([]);
  const [targets,setTargets]=useState([]);
  const [coachFeedback,setCoachFeedback]=useState([]),[coachPreferences,setCoachPreferences]=useState([]),[coachUnavailable,setCoachUnavailable]=useState(false);
  const [readiness,setReadiness]=useState('ready'),[readinessBusy,setReadinessBusy]=useState(false);
  const [knownBarIncrement,setKnownBarIncrement]=useState(null),[availableEquipment,setAvailableEquipment]=useState(null);
  const [swapItem,setSwapItem]=useState(null),[swapBusy,setSwapBusy]=useState(false);
  const [targetsUnavailable,setTargetsUnavailable]=useState(false);
  const [editingSet,setEditingSet]=useState(null);
  const [targetExercise,setTargetExercise]=useState(null);
  const [progressUnavailable,setProgressUnavailable] = useState(false);
  const [excludedKeys,setExcludedKeys] = useState([]);
  const [discard,setDiscard] = useState(null);
  const [discardBusy,setDiscardBusy] = useState(false);
  const [discardError,setDiscardError] = useState('');
  const includedPlan = plan.filter(item=>!excludedKeys.includes(item.key));

  const bellRef = useRef(null);
  if (!bellRef.current) bellRef.current = createRestBell();
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('gymiq_rest_bell') !== 'off'; } catch { return true; }
  });
  const [restComplete, setRestComplete] = useState(false);
  const [soundUnavailable, setSoundUnavailable] = useState(false);
  const [timingSyncError, setTimingSyncError] = useState(false);
  const timer = useSessionTimer({
    getRecovery: () => ({ drafts: drafts.current, activeIdx, extraRows }),
    onRestEnd: () => {
      setRestComplete(true);
      void bellRef.current.play().then((played) => { if (soundOn && !played) setSoundUnavailable(true); });
    },
    onCheckpoint: async (seconds) => {
      if (!logIdRef.current) return;
      try {
        const { error } = await supabase.rpc('checkpoint_workout_duration', { p_log: logIdRef.current, p_duration: seconds });
        setTimingSyncError(!!error);
      } catch { setTimingSyncError(true); }
    },
  });
  useEffect(() => {
    bellRef.current.setEnabled(soundOn);
    try { localStorage.setItem('gymiq_rest_bell', soundOn ? 'on' : 'off'); } catch { /* optional preference */ }
  }, [soundOn]);
  useEffect(() => { if (timer.clock.paused) bellRef.current.stop(); }, [timer.clock.paused]);
  useEffect(() => () => bellRef.current.dispose(), []);
  useEffect(() => { timer.saveRecovery(); }, [activeIdx, extraRows, timer.saveRecovery]);
  const beginRest = (seconds) => { setRestComplete(false); timer.changeRest(seconds); };
  const pauseSession = () => { timer.pause(); bellRef.current.stop(); };
  const resumeSession = () => { void bellRef.current.unlock(); timer.resume(); };
  const testBell = async () => { setSoundUnavailable(!await bellRef.current.play()); };

  /* ------------------------------ load ------------------------------ */
  useEffect(() => {
    if (!profile?.id || profile.demo) { setStatus('error'); setErrText('Sign in to track workouts.'); return; }
    timer.pause();
    setStatus('loading');
    let cancelled = false;
    (async () => {
      try {
        let weekly=null,programmeId=null;
        if(!isFree){
          const dayLookup=await supabase.from('programme_days').select('programme_id').eq('id',dayId).single();
          if(dayLookup.error)throw dayLookup.error;
          programmeId=dayLookup.data.programme_id;
          weekly=await loadWorkoutWeek({programmeId});
        }
        // Recover an unfinished log for this day, including an earlier paused workout.
        const opened = await supabase.rpc('open_workout', { p_day: dayId });
        if (opened.error) throw opened.error;
        const log = Array.isArray(opened.data) ? opened.data[0] : opened.data;
        if (!log?.id) throw new Error('Could not open your workout. Please try again.');
        if (cancelled) return;
        logIdRef.current = log.id;
        setLogId(log.id);setReadiness(log.coach_readiness||'ready');
        setExcludedKeys(log.excluded_exercises || []);
        if(!isFree){
          const logWeek=weekStart(dayKey(new Date(log.created_at)));
          if(weekly?.week_start!==logWeek)weekly=await loadWorkoutWeek({programmeId,week:logWeek});
        }

        // Plan
        let items = [];
        if (!isFree) {
          const pes = await supabase.from('programme_exercises')
            .select('id,exercise_id,name,target_sets,target_reps,target_rir,rest_seconds,exercises(laterality,equipment_ids)')
            .eq('day_id', dayId).order('sort_order');
          if (pes.error) throw pes.error;
          items = [...(pes.data||[]),...(weekly?.extras||[]).filter(e=>e.day_id===dayId&&!weekly.sessions.some(session=>session.id!==log.id&&(session.sets||[]).some(set=>exerciseIdentity(set)===exerciseIdentity(e))))].map((pe) => {
            const [repMin, repMax] = String(pe.target_reps || '8-12').split('-').map((v) => parseInt(v, 10));
            return {
              key: pe.optional?keyFor(null,pe.name):`pe_${pe.id}`, peId: pe.optional?null:pe.id, exerciseId: pe.exercise_id || null,optional:pe.optional,sourceWeek:pe.source_week,
              name: pe.name, laterality: pe.exercises?.laterality || 'bilateral',
              equipmentIds: pe.exercises?.equipment_ids || [],
              scheme: {
                sets: pe.target_sets || 3,
                repMin: repMin || 8, repMax: repMax || 12,
                rir: pe.target_rir ?? 2, restSeconds: pe.rest_seconds || 90,
              },
            };
          });
        }

        if(!isFree&&Array.isArray(log.session_plan))items=log.session_plan;

        // Resume: sets already logged in THIS log
        const existing = await supabase.from('logged_sets')
          .select('*').eq('log_id', log.id).order('created_at');
        if (existing.error) throw existing.error;
        if (isFree) {
          let saved = [];
          try { saved = JSON.parse(localStorage.getItem(`gymiq_session_${profile.id}_${log.id}`) || '[]'); } catch { /* use logged sets */ }
          items = Array.isArray(log.session_plan)?log.session_plan:Array.isArray(saved)?saved:[];
          for (const s of existing.data || []) {
            const key = keyFor(null, s.exercise_name);
            if (!items.some(item => item.key === key)) items.push({ key, name: s.exercise_name,
              exerciseId: s.exercise_id, peId: null, laterality: s.reps_left != null ? 'unilateral' : 'bilateral', scheme: { ...DEFAULT_SCHEME } });
          }
        }
        const doneMap = {};
        for (const s of existing.data || []) {
          const k = keyFor(s.programme_exercise_id, s.exercise_name);
          (doneMap[k] ||= []).push(s);
        }
        setDone(doneMap);

        // Planned defaults and performed records stay separate.
        const [historyResult,targetResult,feedbackResult,preferencesResult]=await Promise.allSettled([loadExerciseProgress(()=>cancelled),loadExerciseTargets(),
          supabase.from('exercise_coach_feedback').select('*').eq('user_id',profile.id).order('updated_at',{ascending:false}).limit(1000),
          supabase.from('exercise_coach_preferences').select('*').eq('user_id',profile.id)]);
        if(cancelled)return;
        if(historyResult.status==='fulfilled') {
          setProgress(historyResult.value);setProgressUnavailable(false);
          priorPrRef.current=Object.fromEntries(historyResult.value.map(p=>[p.name,{e1rm:p.estimatedMax,volume:p.topVolume}]));
        }else{setProgress([]);setProgressUnavailable(true);priorPrRef.current={};}
        setTargets(targetResult.status==='fulfilled'?targetResult.value:[]);
        setTargetsUnavailable(targetResult.status!=='fulfilled');
        const coachFailed=feedbackResult.status!=='fulfilled'||preferencesResult.status!=='fulfilled'||feedbackResult.value?.error||preferencesResult.value?.error;
        setCoachUnavailable(!!coachFailed);
        setCoachFeedback(feedbackResult.status==='fulfilled'&&!feedbackResult.value.error?feedbackResult.value.data||[]:[]);
        setCoachPreferences(preferencesResult.status==='fulfilled'&&!preferencesResult.value.error?preferencesResult.value.data||[]:[]);

        // Bar denominations from default gym profile
        const gp = await supabase.from('gym_profiles').select('id').eq('user_id', profile.id).eq('is_default', true).limit(1);
        if (gp.data?.[0]) {
          const kit=await supabase.from('gym_profile_equipment').select('equipment_id').eq('profile_id',gp.data[0].id);
          if(!kit.error)setAvailableEquipment((kit.data||[]).map(e=>e.equipment_id));
          const ge = await supabase.from('gym_profile_equipment')
            .select('denominations_kg,equipment_id').eq('profile_id', gp.data[0].id)
            .eq('equipment_id', 'barbell').limit(1);
          const d = ge.data?.[0]?.denominations_kg;
          if (Array.isArray(d) && d.length){setBarDenoms(d.map(Number));const smallest=Math.min(...d.map(Number).filter(n=>n>0));if(Number.isFinite(smallest))setKnownBarIncrement(smallest*2);}
        }

        if (cancelled) return;
        const recovery = timer.initialize({
          key: `gymiq_timing_${profile.id}_${log.id}`,
          serverSeconds: Number(log.duration_sec) || 0,
          startFresh: log.duration_sec == null && !existing.data?.length && Date.now() - new Date(log.created_at).getTime() < 60000,
        });
        drafts.current = recovery?.drafts && typeof recovery.drafts === 'object' ? recovery.drafts : {};
        setActiveIdx(Number.isInteger(recovery?.activeIdx) ? Math.max(0, recovery.activeIdx) : 0);
        setExtraRows(recovery?.extraRows && typeof recovery.extraRows === 'object' ? recovery.extraRows : {});
        setPlan(items);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error'); setErrText(e?.message || 'Could not open the session.');
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, dayId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isFree && logId && status === 'ready') {
      try { localStorage.setItem(`gymiq_session_${profile.id}_${logId}`, JSON.stringify(plan)); } catch { /* saved sets remain on server */ }
    }
  }, [plan, isFree, logId, status, profile?.id]);

  /* ----------------------------- state bits ----------------------------- */
  const drafts = useRef({});
  const [, setTick] = useState(0);
  const forceRender = () => setTick((t) => t + 1);
  const unilateral = (item) => String(item.laterality || '').startsWith('unilateral');

  async function removeSet(item, setId) {
    if (timer.isPaused() || discardBusy || discard) return;
    const { error } = await supabase.from('logged_sets').delete().eq('id', setId);
    if (error) { setErrText(error.message); return; }
    setDone((prev) => ({ ...prev, [item.key]: (prev[item.key] || []).filter((s) => s.id !== setId) }));
  }

  // Per-set-row drafts for the clean table (namespaced under rows_<key>).
  function rowDraft(item, idx) {
    const k = `rows_${item.key}`;
    const store = (drafts.current[k] ||= {});
    const initial=exerciseDefault(progress,targets,item,idx);
    if (!store[idx] || (store[idx].source && store[idx].source!=='manual' && store[idx].signature!==initial.signature)) {
      store[idx]={kg:String(initial.weight),reps:String(initial.reps),rir:item.scheme.rir,source:initial.source,signature:initial.signature};
    }
    return store[idx];
  }
  function setRowDraft(item, idx, patch) {
    const k = `rows_${item.key}`;
    const store = (drafts.current[k] ||= {});
    store[idx] = { ...rowDraft(item, idx), ...patch, source:'manual' };
    timer.saveRecovery();
    forceRender();
  }
  // Commit a set when its tick-box is checked.
  async function logSet(item, idx) {
    if (timer.isPaused() || discardBusy || discard) return;
    void bellRef.current.unlock();
    const pendingKey = `${item.key}_${idx}`;
    if (pendingSets.current.has(pendingKey)) return;
    const rd = rowDraft(item, idx);
    const reps = parseInt(rd.reps, 10) || 0;
    const kg = parseFloat(rd.kg) || 0;
    if (reps <= 0 || kg < 0) { setErrText('Enter positive reps and a weight of zero or more.'); return; }
    pendingSets.current.add(pendingKey);
    setErrText('');
    const uni = unilateral(item);
    const n = Math.max(0,...(done[item.key] || []).map(s=>s.set_number || 0)) + 1;
    const row = {
      client_id: profile.id, log_id: logIdRef.current,
      exercise_name: item.name, exercise_id: item.exerciseId, programme_exercise_id: item.peId || null,
      set_number: n, set_type: 'normal', rir: rd.rir ?? null,
      weight: kg || null, reps: reps || null,
      ...(uni ? { weight_left: kg || null, reps_left: reps || null } : {}),
      target_rep_min: item.scheme.repMin, target_rep_max: item.scheme.repMax,
      target_rir: item.scheme.rir, completed: true,
    };
    const { data, error } = await supabase.from('logged_sets').insert(row).select('*').single();
    pendingSets.current.delete(pendingKey);
    if (error) { setErrText(error.message); return; }
    setDone((prev) => ({ ...prev, [item.key]: [...(prev[item.key] || []), data] }));
    beginRest(item.scheme.restSeconds || 90);
  }

  async function addFreeExercise(ex) {
    if(swapBusy)return;setSwapBusy(true);setErrText('');
    const updated=[...plan,{key:keyFor(null,ex.name),peId:null,exerciseId:ex.id,name:ex.name,laterality:ex.laterality,equipmentIds:ex.equipment_ids||[],scheme:{...DEFAULT_SCHEME}}];
    try{const {data,error}=await supabase.rpc('save_workout_session_plan',{p_log:logIdRef.current,p_plan:updated});if(error)throw error;setPlan(data);setPickerOpen(false);}
    catch(e){setErrText(e.message||'Could not save the exercise.');}finally{setSwapBusy(false);}
  }

  async function updateReadiness(value){
    if(readinessBusy)return;setReadinessBusy(true);setErrText('');
    try{const {error}=await supabase.rpc('set_workout_readiness',{p_log:logIdRef.current,p_readiness:value});if(error)throw error;setReadiness(value);}
    catch{setErrText('Could not save your readiness check-in. Please retry.');}finally{setReadinessBusy(false);}
  }
  function applyCoach(item,suggestion){
    if((done[item.key]||[]).length||pendingSets.current.size||discardBusy)return;
    const k=`rows_${item.key}`;drafts.current[k]||={};
    for(let i=0;i<(item.scheme.sets||3);i++)drafts.current[k][i]={...rowDraft(item,i),kg:String(suggestion.weight),reps:String(suggestion.rowReps?.[i]??suggestion.reps),source:'manual',coachSignature:suggestion.signature};
    timer.saveRecovery();forceRender();
  }
  async function replaceExercise(ex){
    if(!swapItem||swapBusy||pendingSets.current.size)return;
    if((done[swapItem.key]||[]).length){setErrText('Remove the logged sets before swapping this exercise.');return;}
    setSwapBusy(true);setErrText('');
    const replacement={...swapItem,key:swapItem.peId?swapItem.key:keyFor(null,ex.name),exerciseId:ex.id,name:ex.name,laterality:ex.laterality,equipmentIds:ex.equipment_ids||[],replacesKey:swapItem.key,originalName:swapItem.originalName||swapItem.name};
    try{
      const updated=plan.map(item=>item.key===swapItem.key?replacement:item);
      const {data,error}=await supabase.rpc('save_workout_session_plan',{p_log:logIdRef.current,p_plan:updated});
      if(error)throw error;
      delete drafts.current[`rows_${swapItem.key}`];delete drafts.current[`rows_${replacement.key}`];
      setExtraRows(rows=>{const next={...rows};delete next[swapItem.key];return next;});
      setPlan(data);setSwapItem(null);timer.saveRecovery();forceRender();
    }catch(e){setErrText(e.message||'Could not save this exercise replacement.');}finally{setSwapBusy(false);}
  }
  function correctSessionSet(row) {
    setDone(done=>Object.fromEntries(Object.entries(done).map(([key,sets])=>[key,sets.map(s=>s.id===row.id?row:s)])));
  }
  function savedTarget(target,key) {
    setTargets(items=>[...items.filter(t=>t.exercise_key!==key),...(target?[target]:[])]);
    const item=plan.find(item=>targetKey(item)===key);
    if(item) {
      const store=drafts.current[`rows_${item.key}`];
      if(store)Object.keys(store).forEach(index=>{if(!(done[item.key]||[])[Number(index)])delete store[index];});
    }
    timer.saveRecovery();forceRender();
  }
  function editSessionSet(row) {
    if(pendingSets.current.size){setErrText('Wait for your set to finish saving first.');return;}
    pauseSession();setEditingSet(row);
  }

  function requestDiscard(action) {
    if (pendingSets.current.size) { setErrText('Wait for your set to finish saving, then try again.'); return; }
    pauseSession(); setDiscardError(''); setDiscard(action);
  }
  async function confirmDiscard() {
    if (!discard || discardBusy || pendingSets.current.size) return;
    setDiscardBusy(true); setDiscardError('');
    try {
      const {error} = discard.type==='workout'
        ? await supabase.rpc('cancel_workout',{p_log:logIdRef.current,p_restore:false})
        : await supabase.rpc('set_workout_exercise_excluded',{p_log:logIdRef.current,p_key:discard.key,p_excluded:true});
      if(error)throw error;
      timer.changeRest(0); setRestComplete(false); bellRef.current.stop();
      if(discard.type==='workout') {
        timer.complete();
        try {localStorage.removeItem(`gymiq_session_${profile.id}_${logIdRef.current}`);}catch{/* retained on server */}
        navigate('/workout',{replace:true});
      } else { setExcludedKeys(keys=>[...new Set([...keys,discard.key])]); setActiveIdx(0); setDiscard(null); }
    } catch(error) {setDiscardError(error.message || 'Could not cancel. Your session is still saved.');}
    finally {setDiscardBusy(false);}
  }
  async function restoreExercise(item) {
    if(discardBusy)return;
    setDiscardBusy(true);
    try {
      const {error}=await supabase.rpc('set_workout_exercise_excluded',{p_log:logIdRef.current,p_key:item.key,p_excluded:false});
      if(error)throw error;
      setExcludedKeys(keys=>keys.filter(key=>key!==item.key));
    } catch(error){setErrText(error.message || 'Could not restore exercise.');}
    finally{setDiscardBusy(false);}
  }

  /* ------------------------------ finish ------------------------------ */
  const sessionSets = useMemo(() =>
    Object.entries(done).filter(([key])=>!excludedKeys.includes(key)).flatMap(([,sets])=>sets).map((s) => ({
      exerciseName: s.exercise_name, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0,
      weightLeft: Number(s.weight_left) || 0, repsLeft: Number(s.reps_left) || 0,
      setType: s.set_type,
    })), [done,excludedKeys]);

  const summary = useMemo(() => {
    const hard = sessionSets.filter((s) => s.setType !== 'warmup');
    const volume = hard.reduce((a, s) => a + (s.weight * s.reps) + (s.weightLeft * s.repsLeft), 0);
    const durationSec = Math.floor(timer.clock.elapsedMs / 1000);
    const { prs } = progressUnavailable ? { prs: [] } : detectPRs(sessionSets.filter(s=>s.setType !== 'warmup'), priorPrRef.current);
    return { sets: hard.length, volume: Math.round(volume), durationSec, prs };
  }, [sessionSets, timer.clock.elapsedMs, progressUnavailable]);

  async function finishWorkout() {
    if (pendingSets.current.size) { setErrText('Wait for your set to finish saving, then try again.'); return; }
    setFinishing(true);
    try {
      const day = new Date();
      const today = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const { error } = await supabase.rpc('finish_workout', { p_log: logIdRef.current,
        p_duration: timer.getSeconds(), p_day: today, p_prs: summary.prs });
      if (error) throw error;
      timer.complete();
      try { localStorage.removeItem(`gymiq_session_${profile.id}_${logIdRef.current}`); } catch { /* ignore */ }
      navigate(`/workout/history/${logIdRef.current}`, { replace: true });
    } catch (e) {
      setErrText(e.message || 'Could not finish saving. Your sets are retained; please try again.');
      setShowFinish(false);
    } finally {
      setFinishing(false);
    }
  }

  /* ------------------------------- render ------------------------------- */
  if (status === 'loading') return <TabShell active="workout" title="Session"><div className="mf-card"><div className="subtle">Preparing your session…</div></div></TabShell>;
  if (status === 'error') return <TabShell active="workout" title="Session"><div className="mf-card"><h4>⚠️ {errText}</h4></div></TabShell>;

  const initials = (name = '') => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  const workingDone = (item) => (done[item.key] || []).filter((s) => s.set_type !== 'warmup').length;
  const targetMet = (item) => workingDone(item) >= (item.scheme.sets || 0);
  const allMet = includedPlan.length > 0 && includedPlan.every(targetMet);
  const active = includedPlan[Math.min(activeIdx, Math.max(0, includedPlan.length - 1))] || null;

  return (
    <TabShell active="workout" title={isFree ? 'Freestyle workout' : 'Your session'}>
      {errText && <div className="inline-error" role="alert">{errText}</div>}
      <SessionTiming clock={timer.clock} soundOn={soundOn} restComplete={restComplete}
        onPause={pauseSession} onResume={resumeSession}
        onAddRest={() => timer.addRest(15)}
        onSkipRest={() => { setRestComplete(false); timer.changeRest(0); bellRef.current.stop(); }}
        onSoundToggle={() => {
          const enabled = !soundOn;
          bellRef.current.setEnabled(enabled);
          if (enabled) void bellRef.current.unlock();
          setSoundOn(enabled); setSoundUnavailable(false);
        }} onTestBell={testBell} />
      {soundUnavailable && <p className="subtle" role="status">Bell audio is unavailable in this browser. The rest-complete message will still appear.</p>}
      {(timingSyncError || timer.storageError) && <p className="subtle" role="status">{timer.storageError ? 'Device recovery storage is unavailable. Keep this session open until it finishes saving online.' : 'Active time is saved on this device. Cloud sync will retry when connected.'}</p>}
      {plan.length > 0 && <p className="subtle" style={{ fontSize: 12 }}>{includedPlan.filter(targetMet).length}/{includedPlan.length} exercises done</p>}

      {/* exercise filmstrip — tap a card to jump to that exercise */}
      {(plan.length > 0 || isFree) && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
          {includedPlan.map((item, idx) => {
            const on = idx === activeIdx;
            const met = targetMet(item);
            return (
              <button key={item.key} type="button" onClick={() => setActiveIdx(idx)} style={{
                all: 'unset', cursor: 'pointer', position: 'relative', flex: '0 0 auto',
                width: 68, height: 78, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-2)',
                border: `2px solid ${on ? 'var(--green-600)' : 'var(--border)'}`,
                color: met && !on ? 'var(--text-subtle)' : 'var(--ink)',
                fontWeight: 800, fontSize: 20, letterSpacing: '.02em',
              }}>
                {initials(item.name)}
                {met && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999,
                    background: 'var(--green-600)', color: 'var(--on-accent)', fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✓</span>
                )}
              </button>
            );
          })}
          {isFree && (
            <button type="button" onClick={() => setPickerOpen((v) => !v)} style={{
              all: 'unset', cursor: 'pointer', flex: '0 0 auto', width: 68, height: 78, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)',
              border: '2px dashed var(--border-strong)', color: 'var(--text-muted)', fontSize: 26, fontWeight: 700,
            }}>+</button>
          )}
        </div>
      )}

      <section className="mf-card coach-readiness" aria-label="Workout readiness"><strong>How are you feeling today?</strong><div className="launch-actions">{[['ready','Ready'],['tired','Tired'],['sore','Sore']].map(([value,label])=><button type="button" key={value} className={`btn ${readiness===value?'btn-primary':'btn-ghost'}`} aria-pressed={readiness===value} disabled={readinessBusy||discardBusy} onClick={()=>updateReadiness(value)}>{label}</button>)}</div><p className="subtle">Tired or sore days do not receive progression increases. Review your recovery before training; stop movements that cause pain.</p></section>
      {swapItem&&<section className="mf-card session-swap-panel" aria-label="Exercise replacement"><div className="row between"><h3>Replace {swapItem.name}</h3><button type="button" className="btn btn-ghost" disabled={swapBusy} onClick={()=>setSwapItem(null)}>Cancel replacement</button></div><p className="subtle">Choose an alternative with the same primary muscle and movement pattern. This session only; your base programme and previous records stay intact. Use the equipment filter for the kit available today.</p>{swapBusy?<p role="status">Saving replacement…</p>:<ExercisePicker mode="pick" pickLabel="Use instead" swapFor={swapItem} availableEquipment={availableEquipment} addedIds={plan.map(p=>p.exerciseId)} onPick={replaceExercise}/>}</section>}
      {pickerOpen && (
        <div style={{ marginBottom: 14 }}>
          {swapBusy?<p role="status">Saving exercise…</p>:<ExercisePicker mode="pick" onPick={addFreeExercise} addedIds={plan.map((p) => p.exerciseId)} />}
        </div>
      )}

      {!includedPlan.length && (
        <div className="mf-card">
          <h4>{plan.length ? 'All exercises removed' : isFree ? 'Empty workout' : 'Rest day'}</h4>
          <div className="subtle">{isFree ? 'Tap + above to add your first exercise.' : 'This program day has no exercises.'}</div>
        </div>
      )}

      {/* the ACTIVE exercise only — clean set table with tick-boxes */}
      {active && (() => {
        const item = active;
        const committed = done[item.key] || [];
        const uni = unilateral(item);
        const cols = '32px 1fr 60px 60px 30px';
        const kgLabel = uni ? 'kg/Side' : 'kg';
        const repsLabel = uni ? 'Reps/Side' : 'Reps';
        const rirColor = (r) => (r == null ? 'var(--text-subtle)' : r <= 1 ? 'var(--danger)' : r <= 3 ? 'var(--warning)' : 'var(--success)');
        const previous = previousFor(progress,item);
        const planned=targets.find(t=>t.exercise_key===targetKey(item));
        const totalRows = Math.max((item.scheme.sets || 3) + (extraRows[item.key] || 0), committed.length);
        const idxs = [...Array(totalRows).keys()];
        const cellInput = { width: '100%', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 4px', color: 'var(--ink)', font: 'inherit', fontSize: 14, MozAppearance: 'textfield' };
        const firstDraft = idxs.find((i) => !committed[i]);
        const draftKg = firstDraft != null ? parseFloat(rowDraft(item, firstDraft).kg) || 0 : 0;
        const plates = plateBreakdown(draftKg, 20, barDenoms);
        const showPlates = (item.equipmentIds || []).includes('barbell') && plates.length > 0;
        const nextIdx = includedPlan.findIndex((p, i) => i > activeIdx && !targetMet(p));
        return (
          <div className="mf-card" style={{ marginBottom: 96 }}>
            <div style={{ minWidth: 0, marginBottom: 10 }}>
              <div className="session-exercise-heading"><b style={{ fontSize: 18 }}>{item.name}</b>{item.optional&&<span className="badge badge-neutral">Optional make-up · up to 2 sets</span>}<button type="button" className="btn btn-ghost" onClick={()=>{pauseSession();setTargetExercise({exerciseId:item.exerciseId,name:item.name,weight:previous?.weight,reps:previous?.reps});}}>Set target</button><button type="button" className="btn btn-ghost" disabled={discardBusy||swapBusy||committed.length>0} onClick={()=>{pauseSession();setSwapItem(item);}}>Swap exercise</button><button type="button" className="btn btn-ghost" disabled={discardBusy} onClick={()=>requestDiscard({type:'exercise',key:item.key,name:item.name})}>Remove exercise</button></div>
              <div className="subtle" style={{ fontSize: 13, marginTop: 2 }}>
                Set {Math.min(workingDone(item) + 1, item.scheme.sets)} of {item.scheme.sets}
              </div>
            </div>

            {item.originalName&&<p className="subtle">Session replacement for {item.originalName}. Loads below belong to {item.name}.</p>}
            <ProgressionCoach key={`coach:${targetKey(item)}`} item={item} progress={progress} feedback={coachFeedback} preferences={coachPreferences} readiness={readiness} defaultIncrement={(item.equipmentIds||[]).includes('barbell')?knownBarIncrement:null} userId={profile.id} logId={logId} hasLogged={committed.length>0} locked={readinessBusy||swapBusy||discardBusy} unavailable={coachUnavailable||progressUnavailable} onApply={suggestion=>applyCoach(item,suggestion)} onFeedback={row=>setCoachFeedback(rows=>[row,...rows.filter(f=>!(f.log_id===row.log_id&&f.exercise_key===row.exercise_key))])} onPreference={row=>setCoachPreferences(rows=>[row,...rows.filter(p=>p.exercise_key!==row.exercise_key)])}/>
            {planned&&<div className="exercise-previous planned-target"><strong>Planned target · {Number(planned.weight)} kg × {planned.reps}</strong><p>Saved as your starting default. Session edits or accepted coach suggestions do not change this saved target or count as a PR.</p></div>}
            {previous && <div className="exercise-previous"><strong>Last session · {setDescription(previous.progress.lastBest)}</strong><p>{planned ? 'Your saved target is shown above. Review the inputs; an accepted coach suggestion applies to this session only.' : 'Previous working sets are your starting defaults. Review a coach suggestion or edit the inputs; tick a set only after performing it.'}</p><Link to="/workout/stats">View exercise records ↗</Link></div>}
            {!previous && !planned && <p className="subtle" style={{fontSize:12}}>Enter your starting weight and reps. Finished working sets become your defaults next time.</p>}
            <p className="subtle" style={{fontSize:12}}>Target: {item.scheme.repMin}–{item.scheme.repMax} reps @ {item.scheme.rir} RIR. Build reps within your range; review the load when your working sets reach the upper end with good form.</p>
            <ExerciseIllustration key={item.exerciseId || item.key} exerciseId={item.exerciseId} name={item.name} variant="guide" />

            {/* table header */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '2px 2px 8px', color: 'var(--text-subtle)', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <span>Set</span><span>{previous ? 'Last session' : 'Target'}</span>
              <span style={{ textAlign: 'center' }}>{kgLabel}</span>
              <span style={{ textAlign: 'center' }}>{repsLabel}</span><span />
            </div>

            {idxs.map((idx) => {
              const c = committed[idx];
              const isDone = !!c;
              const rd = rowDraft(item, idx);
              const kg = isDone ? (c.weight ?? '') : rd.kg;
              const reps = isDone ? (c.reps ?? '') : rd.reps;
              const rir = isDone ? c.rir : rd.rir;
              const priorSet = previousFor(progress,item,idx);
              const reference = priorSet ? `${priorSet.weight} kg × ${priorSet.reps}` : `${item.scheme.repMin}–${item.scheme.repMax} reps`;
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 50, background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: isDone ? 'var(--text-subtle)' : 'var(--ink)' }}>{idx + 1}</span>
                  <span className="subtle" style={{ fontSize: 12.5, lineHeight: 1.25 }}>
                    {reference}
                    <span style={{ display: 'block', color: rirColor(item.scheme.rir), fontSize: 11.5 }}>{item.scheme.rir} RIR</span>
                    {isDone&&<button type="button" className="set-inline-edit" onClick={()=>editSessionSet(c)} aria-label={`Edit ${item.name} set ${idx+1}`}>Edit</button>}
                  </span>
                  <input aria-label={`Set ${idx+1} weight in kg`} type="number" inputMode="decimal" value={kg} disabled={isDone || timer.clock.paused || discardBusy}
                    onChange={(e) => setRowDraft(item, idx, { kg: e.target.value })} style={cellInput} />
                  <div style={{ position: 'relative' }}>
                    <input aria-label={`Set ${idx+1} reps`} type="number" inputMode="numeric" value={reps} disabled={isDone || timer.clock.paused || discardBusy}
                      onChange={(e) => setRowDraft(item, idx, { reps: e.target.value })} style={cellInput} />
                    <button type="button" disabled={isDone || timer.clock.paused || discardBusy}
                      onClick={() => setRowDraft(item, idx, { rir: (((rd.rir ?? 0) + 1) % 5) })}
                      aria-label="Cycle RIR"
                      style={{ position: 'absolute', right: -6, bottom: -6, width: 20, height: 20, borderRadius: 999, background: rirColor(rir), color: '#fff', fontSize: 11, fontWeight: 800, border: '2px solid var(--surface)', cursor: isDone ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rir ?? '–'}</button>
                  </div>
                  <button type="button" disabled={timer.clock.paused || discardBusy} onClick={() => (isDone ? removeSet(item, c.id) : logSet(item, idx))}
                    aria-label={isDone ? 'Uncheck set' : 'Complete set'}
                    style={{ width: 26, height: 26, borderRadius: 7, border: `2px solid ${isDone ? 'var(--green-600)' : 'var(--border-strong)'}`, background: isDone ? 'var(--green-600)' : 'transparent', color: 'var(--on-accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, justifySelf: 'center' }}>{isDone ? '✓' : ''}</button>
                </div>
              );
            })}

            <button type="button" onClick={() => setExtraRows((e) => ({ ...e, [item.key]: (e[item.key] || 0) + 1 }))}
              style={{ width: 30, height: 30, borderRadius: 50, background: 'var(--surface-2)', border: 0, color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', marginTop: 10 }}>+</button>

            {showPlates && (
              <div className="subtle" style={{ fontSize: 11.5, marginTop: 8 }}>Per side: {plates.join(' + ')} kg</div>
            )}

            {activeIdx < includedPlan.length - 1 && (
              <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }}
                onClick={() => setActiveIdx(nextIdx >= 0 ? nextIdx : activeIdx + 1)}>
                Next exercise →
              </button>
            )}
          </div>
        );
      })()}

      {plan.some(item=>excludedKeys.includes(item.key)) && <div className="mf-card"><h3>Removed from this session</h3><p className="subtle">These exercises and their sets won’t count when you finish.</p>{plan.filter(item=>excludedKeys.includes(item.key)).map(item=><div className="prev-row" key={item.key}><span>{item.name}</span><button className="btn btn-ghost" disabled={discardBusy} onClick={()=>restoreExercise(item)}>Restore</button></div>)}</div>}
      {progressUnavailable && <p className="subtle" role="status">Previous exercise records are unavailable. Enter your weights and reps manually for this session.</p>}
      <button className="btn btn-ghost session-cancel-button" disabled={discardBusy || finishing} onClick={()=>requestDiscard({type:'workout'})}>Cancel workout</button>
      {targetsUnavailable&&<p className="subtle" role="status">Saved targets are unavailable. Your previous working sets are shown instead.</p>}
      <SetEditDialog row={editingSet} onClose={()=>setEditingSet(null)} onSaved={correctSessionSet}/>
      <ExerciseTargetDialog exercise={targetExercise} target={targetExercise?targets.find(t=>t.exercise_key===targetKey(targetExercise)):null} onClose={()=>setTargetExercise(null)} onSaved={savedTarget}/>
      <SessionDiscardDialog action={discard} busy={discardBusy} error={discardError} onClose={()=>setDiscard(null)} onConfirm={confirmDiscard}/>
      {/* sticky complete/finish */}
      {plan.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)', padding: '0 16px', zIndex: 40 }}>
          <button className="btn btn-primary btn-lg btn-block" disabled={summary.sets === 0 || discardBusy} onClick={() => { pauseSession(); setShowFinish(true); }}>
            {allMet ? 'Complete workout' : 'Finish workout'}
          </button>
        </div>
      )}

      {/* finish sheet */}
      {showFinish && (
        <>
          <div className="sheet-backdrop" onClick={() => setShowFinish(false)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div className="sheet-head"><strong>Session summary</strong></div>
            <div className="prev-row"><b>{summary.sets}</b><span>hard sets</span></div>
            <div className="prev-row"><b>{summary.volume.toLocaleString()} kg</b><span>total volume</span></div>
            <div className="prev-row"><b>{fmtClock(summary.durationSec)}</b><span>duration</span></div>
            {summary.prs.length > 0 && (
              <div style={{ margin: '10px 0' }}>
                {summary.prs.map((p, i) => (
                  <div key={i} className="prev-row">
                    <b style={{ color: 'var(--energy)' }}>🏆 {p.type.toUpperCase()}</b>
                    <span>{p.exerciseName} · {Math.round(p.value)}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="ob-next" disabled={finishing} onClick={finishWorkout}>
              {finishing ? 'Saving…' : 'Save & finish workout'}
            </button>
          </div>
        </>
      )}
    </TabShell>
  );
}

function keyFor(peId, name) { return peId ? `pe_${peId}` : `nm_${name}`; }
