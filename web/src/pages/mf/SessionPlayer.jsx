/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import ExercisePicker from '../../components/ui/ExercisePicker.jsx';
import ProgressionCoach from '../../components/ui/ProgressionCoach.jsx';
import ExerciseIllustration from '../../components/ui/ExerciseIllustration.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {useLogSync} from '../../context/LogSyncContext.jsx';
import {subscribeSynced,queueStore} from '../../lib/logQueue.js';
import { detectPRs, plateBreakdown } from '../../lib/engines/prs.js';
import useSessionTimer from '../../hooks/useSessionTimer.js';
import SessionTiming from '../../components/ui/SessionTiming.jsx';
import SessionReadinessDialog from '../../components/ui/SessionReadinessDialog.jsx';
import { formatSessionTime } from '../../lib/sessionClock.js';
import { createRestBell } from '../../lib/restBell.js';
import { loadExerciseProgress } from '../../lib/loadExerciseProgress.js';
import { previousFor } from '../../lib/exerciseProgress.js';
import SessionDiscardDialog from '../../components/ui/SessionDiscardDialog.jsx';
import SetEditDialog from '../../components/ui/SetEditDialog.jsx';
import ExerciseTargetDialog from '../../components/ui/ExerciseTargetDialog.jsx';
import { exerciseDefault, loadExerciseTargets, targetKey } from '../../lib/exerciseTargets.js';

import {loadWorkoutWeek,weekStart,dayKey,exerciseIdentity} from '../../lib/workoutWeek.js';
import {loadResumedWorkout,rememberWorkout,forgetWorkout} from '../../lib/workoutRecovery.js';
import {numberedSets,numberForWorkingRow,workingRows,parseSetDraft,upsertSessionSet,saveSetOnce,runSessionWrite,acceptSetTap} from '../../lib/sessionSets.js';

const DEFAULT_SCHEME = { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 90 };
const fmtClock = formatSessionTime;

/**
 * Live workout logger.
 * /workout/session/:dayId  → prescribed day from the active program
 * /workout/session/free    → ad-hoc empty workout
 */
export default function SessionPlayer() {
  const params = useParams();
  const [search]=useSearchParams();
  const resumeId=search.get('resume');
  const dayId = params.dayId && params.dayId !== 'free' ? params.dayId : null;
  const isFree = !dayId;
  const { profile } = useAuth();
  const sync=useLogSync();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errText, setErrText] = useState('');
  const [logId, setLogId] = useState(null);
  const [plan, setPlan] = useState([]);       // [{key,name,exerciseId,peId,laterality,equipmentIds,scheme}]
  const [serverDone, setDone] = useState({});        // key → [inserted set rows]
  const queuedSets=sync.pending.filter(e=>e.kind==='set'&&e.payload.log_id===logId);
  const done=useMemo(()=>{
    const result=Object.fromEntries(Object.entries(serverDone).map(([key,rows])=>[key,[...rows]]));
    for(const entry of queuedSets){const row={...entry.payload,id:entry.id,_queued:true,completed:true,set_type:'normal'},key=keyFor(row.programme_exercise_id,row.exercise_name);if(!Object.values(result).flat().some(s=>s.id===row.id))(result[key]||=[]).push(row);}
    return result;
  },[serverDone,sync.pending,logId]);
  useEffect(()=>subscribeSynced(entry=>{
    if(entry.userId!==profile?.id||entry.kind!=='set'||entry.payload.log_id!==logId)return;
    const row=entry.result?.record;
    if(!row){setDone(old=>Object.fromEntries(Object.entries(old).map(([key,rows])=>[key,rows.filter(s=>s.id!==entry.id)])));return;}
    const key=keyFor(row.programme_exercise_id,row.exercise_name);
    setDone(old=>({...old,[key]:upsertSessionSet(old[key],row)}));
  }),[profile?.id,logId]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [extraRows, setExtraRows] = useState({}); // key → extra set rows beyond target
  const [barDenoms, setBarDenoms] = useState([1.25, 2.5, 5, 10, 20, 25]);
  const priorPrRef = useRef({});
  const logIdRef = useRef(null);
  const pendingSets = useRef(new Set());
  const rowMutationIds=useRef({}),lastSetTap=useRef({});
  const [rowBusy,setRowBusy]=useState({}),[rowErrors,setRowErrors]=useState({});
  const [progress,setProgress] = useState([]);
  const [targets,setTargets]=useState([]);
  const [coachFeedback,setCoachFeedback]=useState([]),[coachPreferences,setCoachPreferences]=useState([]),[coachUnavailable,setCoachUnavailable]=useState(false);
  const [readinessChecked,setReadinessChecked]=useState(false);
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
    getRecovery: () => ({ drafts: drafts.current, activeIdx, extraRows, readinessChecked, rowMutationIds:rowMutationIds.current }),
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
  useEffect(() => { timer.saveRecovery(); }, [activeIdx, extraRows, readinessChecked, timer.saveRecovery]);
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
        let log=await loadResumedWorkout(supabase,{userId:profile.id,dayId,resumeId});
        let weekly=null,programmeId=null,workoutName=isFree?'Freestyle workout':'Your workout';
        if(!isFree){
          const dayLookup=await supabase.from('programme_days').select('programme_id,name').eq('id',dayId).single();
          if(dayLookup.error)throw dayLookup.error;
          programmeId=dayLookup.data.programme_id;workoutName=dayLookup.data.name||workoutName;
          weekly=await loadWorkoutWeek({programmeId});
        }
        // Recover an unfinished log for this day, including an earlier paused workout.
        if(!log){
          const opened = await supabase.rpc('open_workout', { p_day: dayId });
          if (opened.error) throw opened.error;
          log = Array.isArray(opened.data) ? opened.data[0] : opened.data;
        }
        if (!log?.id) throw new Error('Could not open your workout. Please try again.');
        if (cancelled) return;
        rememberWorkout(profile.id,log,workoutName);
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
          startFresh: resumeId===null && log.duration_sec == null && !existing.data?.length && Date.now() - new Date(log.created_at).getTime() < 60000,
        });
        rowMutationIds.current=recovery?.rowMutationIds&&typeof recovery.rowMutationIds==='object'?recovery.rowMutationIds:{};
        drafts.current = recovery?.drafts && typeof recovery.drafts === 'object' ? recovery.drafts : {};
        setActiveIdx(Number.isInteger(recovery?.activeIdx) ? Math.max(0, recovery.activeIdx) : 0);
        setReadinessChecked(!!recovery?.readinessChecked || !!existing.data?.length || Date.now()-new Date(log.created_at).getTime()>60000);
        setExtraRows(recovery?.extraRows && typeof recovery.extraRows === 'object' ? recovery.extraRows : {});
        setPlan(items);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error'); setErrText(e?.message || 'Could not open the session.');
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, dayId,resumeId]); // eslint-disable-line react-hooks/exhaustive-deps
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

  async function removeSet(item, row, idx) {
    if(discardBusy||discard||showFinish||finishing)return;
    const key=`${item.key}_${idx}`;
    const tapKey=`${logIdRef.current}:${key}`;
    if(!acceptSetTap(lastSetTap.current,tapKey))return;
    await saveSetOnce({locks:pendingSets.current,key,save:async()=>{
      if(!sync.online){setRowErrors(e=>({...e,[key]:'Connect to undo a synced set. You can keep logging new sets offline.'}));return;}
      setRowBusy(rows=>({...rows,[key]:true}));setRowErrors(e=>({...e,[key]:''}));
      try{
        const expected=Object.fromEntries(['weight','reps','weight_left','reps_left','rir'].map(field=>[field,row[field]??null]));
        const result=await runSessionWrite(signal=>supabase.rpc('undo_session_set',{p_log:logIdRef.current,p_set:row.id,p_expected:expected}).abortSignal(signal));
        if(result.error)throw result.error;
        drafts.current[`rows_${item.key}`]||={};
        drafts.current[`rows_${item.key}`][idx]={kg:String(row.weight??0),reps:String(row.reps??''),rir:row.rir,source:'manual'};
        delete rowMutationIds.current[key];timer.saveRecovery();
        setDone(prev=>({...prev,[item.key]:(prev[item.key]||[]).filter(s=>s.id!==row.id)}));
      }catch(error){setRowErrors(e=>({...e,[key]:error.message||'Could not undo this set. It is still saved; reconnect and retry.'}));}
      finally{setRowBusy(rows=>({...rows,[key]:false}));}
    }});
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
    setRowErrors(errors=>({...errors,[`${item.key}_${idx}`]:''}));
    const k = `rows_${item.key}`;
    const store = (drafts.current[k] ||= {});
    store[idx] = { ...rowDraft(item, idx), ...patch, source:'manual' };
    timer.saveRecovery();
    forceRender();
  }
  // Commit a set when its tick-box is checked.
  async function logSet(item, idx) {
    if(discardBusy||discard||showFinish||finishing||numberedSets(done[item.key]).has(idx+1))return;
    const key=`${item.key}_${idx}`;
    const tapKey=`${logIdRef.current}:${key}`;
    if(!acceptSetTap(lastSetTap.current,tapKey))return;
    await saveSetOnce({locks:pendingSets.current,key,save:async()=>{
      let values,setNumber;
      try{values=parseSetDraft(rowDraft(item,idx));setNumber=numberForWorkingRow(idx+1,done[item.key]);}catch(error){delete lastSetTap.current[tapKey];setRowErrors(e=>({...e,[key]:error.message}));return;}
      setRowBusy(rows=>({...rows,[key]:true}));setRowErrors(e=>({...e,[key]:''}));setErrText('');
      const id=rowMutationIds.current[key]||crypto.randomUUID();rowMutationIds.current[key]=id;timer.saveRecovery();
      const uni=unilateral(item);
      const row={client_id:profile.id,log_id:logIdRef.current,exercise_name:item.name,exercise_id:item.exerciseId,programme_exercise_id:item.peId||null,
        set_number:setNumber,set_type:'normal',rir:values.rir,weight:values.weight,reps:values.reps,
        ...(uni?{weight_left:values.weight,reps_left:values.reps}:{}),target_rep_min:item.scheme.repMin,target_rep_max:item.scheme.repMax,target_rir:item.scheme.rir,completed:true};
      try{
        await sync.enqueue('set',row,id);
        if(!timer.isPaused())void bellRef.current.unlock();
        beginRest(DEFAULT_SCHEME.restSeconds);
      }catch(error){delete lastSetTap.current[tapKey];setRowErrors(e=>({...e,[key]:error.message||'Could not save on this device. Your inputs are kept; try again.'}));}
      finally{setRowBusy(rows=>({...rows,[key]:false}));}
    }});
  }

  async function addFreeExercise(ex) {
    if(swapBusy)return;setSwapBusy(true);setErrText('');
    const updated=[...plan,{key:keyFor(null,ex.name),peId:null,exerciseId:ex.id,name:ex.name,laterality:ex.laterality,equipmentIds:ex.equipment_ids||[],scheme:{...DEFAULT_SCHEME}}];
    try{const {data,error}=await supabase.rpc('save_workout_session_plan',{p_log:logIdRef.current,p_plan:updated});if(error)throw error;setPlan(data);setPickerOpen(false);}
    catch(e){setErrText(e.message||'Could not save the exercise.');}finally{setSwapBusy(false);}
  }

  async function updateReadiness(value){
    if(readinessBusy)return;setReadinessBusy(true);setErrText('');
    try{const {error}=await supabase.rpc('set_workout_readiness',{p_log:logIdRef.current,p_readiness:value});if(error)throw error;setReadiness(value);setReadinessChecked(true);}
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
      if(store)Object.keys(store).forEach(index=>{if(!numberedSets(done[item.key]).has(Number(index)+1))delete store[index];});
    }
    timer.saveRecovery();forceRender();
  }
  function editSessionSet(row) {
    if(row._queued){setErrText('Sync this set before editing it.');return;}
    if(pendingSets.current.size){setErrText('Wait for your set to finish saving first.');return;}
    pauseSession();setEditingSet(row);
  }

  function requestDiscard(action) {
    if(queuedSets.length){setErrText('Sync or review the queued sets before removing an exercise or cancelling this workout.');return;}
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
        timer.complete();forgetWorkout(profile.id,logIdRef.current);
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
    let pending;try{pending=await queueStore.list(profile.id);}catch{setErrText('Could not check device saves. Keep this workout open and retry.');return;}
    if(pending.some(e=>e.kind==='set'&&e.payload.log_id===logIdRef.current)){setErrText('Your sets are saved on this device. Connect and sync them before finishing the workout.');setShowFinish(false);return;}
    if (pendingSets.current.size) { setErrText('Wait for your set to finish saving, then try again.'); return; }
    setFinishing(true);
    try {
      const day = new Date();
      const today = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
      const { error } = await supabase.rpc('finish_workout', { p_log: logIdRef.current,
        p_duration: timer.getSeconds(), p_day: today, p_prs: summary.prs });
      if (error) throw error;
      timer.complete();forgetWorkout(profile.id,logIdRef.current);
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
  if (status === 'error') return <TabShell active="workout" title="Session"><div className="mf-card"><h4>⚠️ {errText}</h4><Link className="btn btn-secondary" to="/workout">Return to Training</Link></div></TabShell>;

  const initials = (name = '') => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  const workingDone = (item) => numberedSets(done[item.key]).size;
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

      {active&&<ExerciseIllustration key={`image:${active.key}`} exerciseId={active.exerciseId} name={active.name} variant="button" />}
      <SessionReadinessDialog open={!readinessChecked} readiness={readiness} busy={readinessBusy} error={errText} onChoose={updateReadiness} onDismiss={()=>setReadinessChecked(true)} />
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
        const committed = workingRows(done[item.key]);
        const byNumber=numberedSets(done[item.key]);
        const uni = unilateral(item);
        const cols = '28px minmax(0,1fr) minmax(54px,72px) minmax(48px,64px) 44px';
        const kgLabel = uni ? 'kg/Side' : 'kg';
        const repsLabel = uni ? 'Reps/Side' : 'Reps';
        const rirColor = (r) => (r == null ? 'var(--text-subtle)' : r <= 1 ? 'var(--danger)' : r <= 3 ? 'var(--warning)' : 'var(--success)');
        const previous = previousFor(progress,item);
        const totalRows = Math.max((item.scheme.sets || 3) + (extraRows[item.key] || 0), Math.max(0,...byNumber.keys()));
        const idxs = [...Array(totalRows).keys()];
        const cellInput = { width: '100%', minHeight:44, boxSizing:'border-box', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 4px', color: 'var(--ink)', font: 'inherit', fontSize: 16, MozAppearance: 'textfield' };
        const firstDraft = idxs.find((i) => !byNumber.has(i+1));
        const draftKg = firstDraft != null ? parseFloat(rowDraft(item, firstDraft).kg) || 0 : 0;
        const plates = plateBreakdown(draftKg, 20, barDenoms);
        const showPlates = (item.equipmentIds || []).includes('barbell') && plates.length > 0;
        const nextIdx = includedPlan.findIndex((p, i) => i > activeIdx && !targetMet(p));
        return (
          <div className="mf-card" style={{ marginBottom: 96 }}>
            <div style={{ minWidth: 0, marginBottom: 10 }}>
              <div className="session-exercise-heading"><b style={{ fontSize: 18 }}>{item.name}</b>{item.optional&&<span className="badge badge-neutral">Optional make-up · up to 2 sets</span>}<button type="button" className="btn btn-ghost" onClick={()=>{pauseSession();setTargetExercise({exerciseId:item.exerciseId,name:item.name,weight:previous?.weight,reps:previous?.reps});}}>Set target</button><button type="button" className="btn btn-ghost" disabled={discardBusy||swapBusy||committed.length>0} onClick={()=>{pauseSession();setSwapItem(item);}}>Swap exercise</button><button type="button" className="btn btn-ghost" disabled={discardBusy} onClick={()=>requestDiscard({type:'exercise',key:item.key,name:item.name})}>Remove exercise</button></div>
              <div className="subtle" style={{ fontSize: 13, marginTop: 2 }}>
                {workingDone(item)}/{totalRows} sets saved
              </div>
            </div>

            {item.originalName&&<p className="subtle">Session replacement for {item.originalName}. Loads below belong to {item.name}.</p>}
            <ProgressionCoach key={`coach:${targetKey(item)}`} item={item} progress={progress} feedback={coachFeedback} preferences={coachPreferences} readiness={readiness} defaultIncrement={(item.equipmentIds||[]).includes('barbell')?knownBarIncrement:null} userId={profile.id} logId={logId} hasLogged={committed.length>0} locked={readinessBusy||swapBusy||discardBusy||committed.some(s=>s._queued)} unavailable={coachUnavailable||progressUnavailable} onApply={suggestion=>applyCoach(item,suggestion)} onFeedback={row=>setCoachFeedback(rows=>[row,...rows.filter(f=>!(f.log_id===row.log_id&&f.exercise_key===row.exercise_key))])} onPreference={row=>setCoachPreferences(rows=>[row,...rows.filter(p=>p.exercise_key!==row.exercise_key)])}/>
            <Link className="btn btn-secondary btn-block" style={{marginBottom:16}} to="/workout/stats">View exercise records ↗</Link>

            {timer.clock.paused&&<p className="session-entry-status" role="status">Timer paused · entering and logging sets still works.</p>}
            {committed.length>0&&<p className="subtle" style={{fontSize:12}}>Checked rows are saved in this session. Tap a saved weight/reps value or Edit to correct it, or add another set below.</p>}
            {/* table header */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '2px 2px 8px', color: 'var(--text-subtle)', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <span>Set</span><span>{previous ? 'Last session' : 'Target'}</span>
              <span style={{ textAlign: 'center' }}>{kgLabel}</span>
              <span style={{ textAlign: 'center' }}>{repsLabel}</span><span />
            </div>

            {idxs.map((idx) => {
              const c = byNumber.get(idx+1);
              const rowKey=`${item.key}_${idx}`,saving=!!rowBusy[rowKey];
              const isDone = !!c;
              const rd = rowDraft(item, idx);
              const canEditSaved=isDone&&!c._queued;
              const kg = isDone ? (c.weight ?? '') : rd.kg;
              const reps = isDone ? (c.reps ?? '') : rd.reps;
              const rir = isDone ? c.rir : rd.rir;
              const priorSet = previousFor(progress,item,idx);
              const reference = priorSet ? `${priorSet.weight} kg × ${priorSet.reps}` : `${item.scheme.repMin}–${item.scheme.repMax} reps`;
              const openSaved=()=>{if(canEditSaved)editSessionSet(c);else if(c?._queued)setRowErrors(e=>({...e,[rowKey]:'Saved on this device. Sync this set to edit or undo it. Other sets remain available.'}));};
              return <div key={idx}>
                <div style={{display:'grid',gridTemplateColumns:cols,gap:8,alignItems:'center',padding:'9px 2px',borderBottom:'1px solid var(--border)'}} aria-busy={saving}>
                  <span style={{width:28,height:30,borderRadius:50,background:'var(--surface-2)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,color:isDone?'var(--text-subtle)':'var(--ink)'}}>{idx+1}</span>
                  <span className="subtle" style={{fontSize:12.5,lineHeight:1.3,overflowWrap:'anywhere'}}>
                    {reference}
                    {isDone?<span style={{display:'block',color:rirColor(rir),fontSize:12}}>{rir??'–'} RIR</span>:<button type="button" disabled={saving||discardBusy||showFinish||finishing} aria-label={`Set ${idx+1} reps in reserve`} onClick={()=>setRowDraft(item,idx,{rir:((rd.rir??0)+1)%5})} style={{display:'block',minHeight:32,padding:'4px 0',border:0,background:'transparent',color:rirColor(rir),font:'inherit'}}>{rir??'–'} RIR</button>}
                    {c?._queued&&<small style={{display:'block'}}>Saved on device · sync pending</small>}
                    {canEditSaved&&<button type="button" className="set-inline-edit" disabled={saving||discardBusy} onClick={()=>editSessionSet(c)} aria-label={`Edit ${item.name} set ${idx+1}`}>Edit</button>}
                  </span>
                  <input aria-label={`Set ${idx+1} weight in kg`} type="text" inputMode="decimal" maxLength={8} value={kg} readOnly={isDone} disabled={saving||discardBusy||showFinish||finishing} onClick={isDone?openSaved:undefined} onKeyDown={e=>{if(isDone&&e.key==='Enter'){e.preventDefault();openSaved();}}} onChange={e=>setRowDraft(item,idx,{kg:e.target.value})} style={{...cellInput,cursor:isDone?'pointer':'text'}}/>
                  <input aria-label={`Set ${idx+1} reps`} type="text" inputMode="numeric" maxLength={4} value={reps} readOnly={isDone} disabled={saving||discardBusy||showFinish||finishing} onClick={isDone?openSaved:undefined} onKeyDown={e=>{if(isDone&&e.key==='Enter'){e.preventDefault();openSaved();}}} onChange={e=>setRowDraft(item,idx,{reps:e.target.value})} style={{...cellInput,cursor:isDone?'pointer':'text'}}/>
                  <button type="button" disabled={saving||discardBusy||showFinish||finishing||c?._queued} onClick={()=>isDone?removeSet(item,c,idx):logSet(item,idx)} aria-label={saving?`Saving set ${idx+1}`:isDone?`Uncheck set ${idx+1}`:`Complete set ${idx+1}`} aria-pressed={isDone} style={{width:44,height:44,borderRadius:10,border:`2px solid ${isDone?'var(--green-600)':'var(--border-strong)'}`,background:isDone?'var(--green-600)':'transparent',color:'var(--on-accent)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:800}}>{saving?'…':isDone?'✓':''}</button>
                </div>
                {rowErrors[rowKey]&&<p className="inline-error" role="alert" style={{fontSize:13,margin:'6px 0'}}>{rowErrors[rowKey]}</p>}
              </div>;
            })}

            <button type="button" className="btn btn-secondary" disabled={discardBusy||showFinish||finishing||totalRows>=1000} onClick={()=>setExtraRows(e=>({...e,[item.key]:Math.max((e[item.key]||0)+1,totalRows-(item.scheme.sets||3)+1)}))} style={{minHeight:44,marginTop:12}} aria-label={`Add set for ${item.name}`}>+ Add set</button>

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
