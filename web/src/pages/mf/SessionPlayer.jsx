/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import ExercisePicker from '../../components/ui/ExercisePicker.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { detectPRs, plateBreakdown } from '../../lib/engines/prs.js';

const SET_TYPES = ['normal', 'warmup', 'drop', 'myorep', 'partial', 'failure'];
const DEFAULT_SCHEME = { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 90 };
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

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
  const [startedAt, setStartedAt] = useState(Date.now());
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

  // timers
  const [nowTick, setNowTick] = useState(Date.now());
  const [restLeft, setRestLeft] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setNowTick(Date.now());
      setRestLeft((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ------------------------------ load ------------------------------ */
  useEffect(() => {
    if (!profile?.id || profile.demo) { setStatus('error'); setErrText('Sign in to track workouts.'); return; }
    let cancelled = false;
    (async () => {
      try {
        // Reuse an open (unfinished) log for this day today; else create one.
        let open = await supabase.from('workout_logs')
          .select('id,created_at').eq('client_id', profile.id)
          .eq(isFree ? 'note' : 'day_id', isFree ? 'freeform' : dayId)
          .is('completed_at', null).order('created_at', { ascending: false }).limit(1);
        let log = open.data?.[0];
        if (!log) {
          const ins = await supabase.from('workout_logs').insert({
            client_id: profile.id,
            ...(isFree ? { note: 'freeform' } : { day_id: dayId }),
          }).select('id,created_at').single();
          if (ins.error) throw ins.error;
          log = ins.data;
        }
        if (cancelled) return;
        logIdRef.current = log.id;
        setLogId(log.id);
        setStartedAt(new Date(log.created_at).getTime());

        // Plan
        let items = [];
        if (!isFree) {
          const pes = await supabase.from('programme_exercises')
            .select('id,exercise_id,name,target_sets,target_reps,target_rir,rest_seconds,exercises(laterality,equipment_ids)')
            .eq('day_id', dayId).order('sort_order');
          items = (pes.data || []).map((pe) => {
            const [repMin, repMax] = String(pe.target_reps || '8-12').split('-').map((v) => parseInt(v, 10));
            return {
              key: `pe_${pe.id}`, peId: pe.id, exerciseId: pe.exercise_id || null,
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

        // Resume: sets already logged in THIS log
        const existing = await supabase.from('logged_sets')
          .select('*').eq('log_id', log.id).order('created_at');
        const doneMap = {};
        let counter = {};   // per exercise running set number
        for (const s of existing.data || []) {
          const k = keyFor(s.programme_exercise_id, s.exercise_name);
          (doneMap[k] ||= []).push(s);
          counter[k] = Math.max(counter[k] || 0, s.set_number || 0);
        }
        setCounter(counter);
        setDone(doneMap);

        // Recent performances → suggested loads ("Auto")
        const recent = await supabase.from('logged_sets')
          .select('exercise_name,weight,reps').eq('client_id', profile.id)
          .gte('created_at', new Date(Date.now() - 90 * 864e5).toISOString())
          .order('created_at', { ascending: false }).limit(80);
        const last = {};
        for (const s of recent.data || []) {
          if (s.weight && !last[s.exercise_name]) last[s.exercise_name] = { weight: Number(s.weight), reps: s.reps };
        }
        setLastPerf(last);

        // Prior PRs
        const prs = await supabase.from('personal_records').select('exercise_name,pr_type,value');
        priorPrRef.current = Object.fromEntries(
          Object.entries(groupPrs(prs.data || [])).map(([k, v]) => [k, v]),
        );

        // Bar denominations from default gym profile
        const gp = await supabase.from('gym_profiles').select('id').eq('user_id', profile.id).eq('is_default', true).limit(1);
        if (gp.data?.[0]) {
          const ge = await supabase.from('gym_profile_equipment')
            .select('denominations_kg,equipment_id').eq('profile_id', gp.data[0].id)
            .eq('equipment_id', 'barbell').limit(1);
          const d = ge.data?.[0]?.denominations_kg;
          if (Array.isArray(d) && d.length) setBarDenoms(d.map(Number));
        }

        if (cancelled) return;
        setPlan(items);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error'); setErrText(e?.message || 'Could not open the session.');
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, dayId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----------------------------- state bits ----------------------------- */
  const [counter, setCounter] = useState({});     // key → next set_number - 1
  const [lastPerf, setLastPerf] = useState({});   // name → {weight,reps}
  const drafts = useRef({});                      // key → current draft inputs

  function draftFor(item) {
    return drafts.current[item.key] ||= {
      setType: 'normal', rir: item.scheme.rir,
      weightR: String(lastPerf[item.name]?.weight ?? ''), repsR: '', weightL: '', repsL: '',
    };
  }
  function setDraft(item, patch) {
    drafts.current[item.key] = { ...draftFor(item), ...patch };
    forceRender();
  }
  const [, setTick] = useState(0);
  const forceRender = () => setTick((t) => t + 1);

  const unilateral = (item) => String(item.laterality || '').startsWith('unilateral');

  async function completeSet(item) {
    const d = draftFor(item);
    const wR = parseFloat(d.weightR) || 0;
    const rR = parseInt(d.repsR, 10) || 0;
    const wL = unilateral(item) ? parseFloat(d.weightL) || 0 : 0;
    const rL = unilateral(item) ? parseInt(d.repsL, 10) || 0 : 0;
    if (!rR && !rL) return;

    const n = (counter[item.key] || 0) + 1;
    setCounter((c) => ({ ...c, [item.key]: n }));
    const row = {
      client_id: profile.id, log_id: logIdRef.current,
      exercise_name: item.name, exercise_id: item.exerciseId, programme_exercise_id: item.peId || null,
      set_number: n, set_type: SET_TYPES.includes(d.setType) ? d.setType : 'normal',
      rir: d.rir ?? null,
      weight: wR || null, reps: rR || null,
      ...(unilateral(item) ? { weight_left: wL || null, reps_left: rL || null } : {}),
      target_rep_min: item.scheme.repMin, target_rep_max: item.scheme.repMax,
      target_rir: item.scheme.rir, completed: true,
    };
    const { data, error } = await supabase.from('logged_sets').insert(row).select('*').single();
    if (error) { setErrText(error.message); return; }

    setDone((prev) => ({ ...prev, [item.key]: [...(prev[item.key] || []), data] }));
    drafts.current[item.key] = { ...d, repsR: '', repsL: '' };
    if (d.setType !== 'warmup') setRestLeft(item.scheme.restSeconds || 90);
  }

  async function removeSet(item, setId) {
    await supabase.from('logged_sets').delete().eq('id', setId);
    setDone((prev) => ({ ...prev, [item.key]: (prev[item.key] || []).filter((s) => s.id !== setId) }));
  }

  // Per-set-row drafts for the clean table (namespaced under rows_<key>).
  function rowDraft(item, idx) {
    const k = `rows_${item.key}`;
    const store = (drafts.current[k] ||= {});
    if (!store[idx]) store[idx] = { kg: String(lastPerf[item.name]?.weight ?? ''), reps: '', rir: item.scheme.rir };
    return store[idx];
  }
  function setRowDraft(item, idx, patch) {
    const k = `rows_${item.key}`;
    const store = (drafts.current[k] ||= {});
    store[idx] = { ...rowDraft(item, idx), ...patch };
    forceRender();
  }
  // Commit a set when its tick-box is checked.
  async function logSet(item, idx) {
    const rd = rowDraft(item, idx);
    const reps = parseInt(rd.reps, 10) || 0;
    const kg = parseFloat(rd.kg) || 0;
    if (!reps) { setErrText('Enter reps before ticking the set.'); return; }
    const uni = unilateral(item);
    const n = (done[item.key] || []).length + 1;
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
    if (error) { setErrText(error.message); return; }
    setDone((prev) => ({ ...prev, [item.key]: [...(prev[item.key] || []), data] }));
    setRestLeft(item.scheme.restSeconds || 90);
  }

  function addFreeExercise(ex) {
    setPlan((p) => [...p, {
      key: `free_${ex.id}_${Date.now()}`, peId: null, exerciseId: ex.id,
      name: ex.name, laterality: ex.laterality, equipmentIds: ex.equipment_ids || [],
      scheme: { ...DEFAULT_SCHEME },
    }]);
    setPickerOpen(false);
  }

  /* ------------------------------ finish ------------------------------ */
  const sessionSets = useMemo(() =>
    Object.values(done).flat().map((s) => ({
      exerciseName: s.exercise_name, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0,
      weightLeft: Number(s.weight_left) || 0, repsLeft: Number(s.reps_left) || 0,
      setType: s.set_type,
    })), [done]);

  const summary = useMemo(() => {
    const hard = sessionSets.filter((s) => s.setType !== 'warmup');
    const volume = hard.reduce((a, s) => a + (s.weight * s.reps) + (s.weightLeft * s.repsLeft), 0);
    const durationSec = Math.max(0, Math.round((nowTick - startedAt) / 1000));
    const { prs } = detectPRs(sessionSets, priorPrRef.current);
    return { sets: hard.length, volume: Math.round(volume), durationSec, prs };
  }, [sessionSets, nowTick, startedAt]);

  async function finishWorkout() {
    setFinishing(true);
    try {
      await supabase.from('workout_logs').update({
        completed_at: new Date().toISOString(),
        duration_sec: summary.durationSec,
      }).eq('id', logIdRef.current);

      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('habits').upsert(
        { user_id: profile.id, day: today, worked_out: true },
        { onConflict: 'user_id,day' },
      );

      for (const pr of summary.prs) {
        await supabase.from('personal_records').upsert({
          user_id: profile.id, exercise_name: pr.exerciseName,
          pr_type: pr.type === 'volume' ? 'volume' : 'e1rm',
          value: pr.value, achieved_on: today,
        }, { onConflict: 'user_id,exercise_name,pr_type' });
      }
      navigate(`/workout/history/${logIdRef.current}`, { replace: true });
    } finally {
      setFinishing(false);
    }
  }

  /* ------------------------------- render ------------------------------- */
  if (status === 'loading') return <TabShell active="workout" title="Session"><div className="mf-card"><div className="subtle">Preparing your session…</div></div></TabShell>;
  if (status === 'error') return <TabShell active="workout" title="Session"><div className="mf-card"><h4>⚠️ {errText}</h4></div></TabShell>;

  const elapsed = Math.max(0, Math.round((nowTick - startedAt) / 1000));
  const initials = (name = '') => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  const workingDone = (item) => (done[item.key] || []).filter((s) => s.set_type !== 'warmup').length;
  const targetMet = (item) => workingDone(item) >= (item.scheme.sets || 0);
  const allMet = plan.length > 0 && plan.every(targetMet);
  const active = plan[Math.min(activeIdx, Math.max(0, plan.length - 1))] || null;

  return (
    <TabShell active="workout" title={isFree ? 'Empty Workout' : 'Session'}>
      {/* status chips */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={chipStyle}>⏱ {fmtClock(elapsed)}</span>
        {restLeft > 0 && (
          <span style={{ ...chipStyle, color: restLeft <= 10 ? 'var(--energy)' : undefined }}>
            🔔 Rest {fmtClock(restLeft)}
          </span>
        )}
        {restLeft > 0 && (
          <>
            <button style={miniBtn} onClick={() => setRestLeft((r) => r + 15)}>+15s</button>
            <button style={miniBtn} onClick={() => setRestLeft(0)}>skip</button>
          </>
        )}
        <span style={{ flex: 1 }} />
        {plan.length > 0 && <span className="subtle" style={{ fontSize: 12 }}>{plan.filter(targetMet).length}/{plan.length} done</span>}
      </div>

      {/* exercise filmstrip — tap a card to jump to that exercise */}
      {plan.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
          {plan.map((item, idx) => {
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

      {pickerOpen && (
        <div style={{ marginBottom: 14 }}>
          <ExercisePicker mode="pick" onPick={addFreeExercise} addedIds={plan.map((p) => p.exerciseId)} />
        </div>
      )}

      {!plan.length && (
        <div className="mf-card">
          <h4>{isFree ? 'Empty workout' : 'Rest day'}</h4>
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
        const autoLine = `${lastPerf[item.name]?.weight ? `${lastPerf[item.name].weight} kg × ` : ''}${item.scheme.repMin}–${item.scheme.repMax}`;
        const totalRows = Math.max((item.scheme.sets || 3) + (extraRows[item.key] || 0), committed.length);
        const idxs = [...Array(totalRows).keys()];
        const cellInput = { width: '100%', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 4px', color: 'var(--ink)', font: 'inherit', fontSize: 14, MozAppearance: 'textfield' };
        const firstDraft = idxs.find((i) => !committed[i]);
        const draftKg = firstDraft != null ? parseFloat(rowDraft(item, firstDraft).kg) || 0 : 0;
        const plates = plateBreakdown(draftKg, 20, barDenoms);
        const showPlates = (item.equipmentIds || []).includes('barbell') && plates.length > 0;
        const nextIdx = plan.findIndex((p, i) => i > activeIdx && !targetMet(p));
        return (
          <div className="mf-card" style={{ marginBottom: 96 }}>
            <div style={{ minWidth: 0, marginBottom: 10 }}>
              <b style={{ fontSize: 18 }}>{item.name}</b>
              <div className="subtle" style={{ fontSize: 13, marginTop: 2 }}>
                Set {Math.min(workingDone(item) + 1, item.scheme.sets)} of {item.scheme.sets}
              </div>
            </div>

            {/* table header */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '2px 2px 8px', color: 'var(--text-subtle)', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <span>Set</span><span>Auto</span>
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
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 50, background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: isDone ? 'var(--text-subtle)' : 'var(--ink)' }}>{idx + 1}</span>
                  <span className="subtle" style={{ fontSize: 12.5, lineHeight: 1.25 }}>
                    {autoLine}
                    <span style={{ display: 'block', color: rirColor(item.scheme.rir), fontSize: 11.5 }}>{item.scheme.rir} RIR</span>
                  </span>
                  <input type="number" inputMode="decimal" value={kg} disabled={isDone}
                    onChange={(e) => setRowDraft(item, idx, { kg: e.target.value })} style={cellInput} />
                  <div style={{ position: 'relative' }}>
                    <input type="number" inputMode="numeric" value={reps} disabled={isDone}
                      onChange={(e) => setRowDraft(item, idx, { reps: e.target.value })} style={cellInput} />
                    <button type="button" disabled={isDone}
                      onClick={() => setRowDraft(item, idx, { rir: (((rd.rir ?? 0) + 1) % 5) })}
                      aria-label="Cycle RIR"
                      style={{ position: 'absolute', right: -6, bottom: -6, width: 20, height: 20, borderRadius: 999, background: rirColor(rir), color: '#fff', fontSize: 11, fontWeight: 800, border: '2px solid var(--surface)', cursor: isDone ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rir ?? '–'}</button>
                  </div>
                  <button type="button" onClick={() => (isDone ? removeSet(item, c.id) : logSet(item, idx))}
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

            {activeIdx < plan.length - 1 && (
              <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }}
                onClick={() => setActiveIdx(nextIdx >= 0 ? nextIdx : activeIdx + 1)}>
                Next exercise →
              </button>
            )}
          </div>
        );
      })()}

      {/* sticky complete/finish */}
      {plan.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)', padding: '0 16px', zIndex: 40 }}>
          <button className="btn btn-primary btn-lg btn-block" disabled={summary.sets === 0} onClick={() => setShowFinish(true)}>
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

function groupPrs(rows) {
  const out = {};
  for (const r of rows) {
    (out[r.exercise_name] ||= {})[r.pr_type === 'volume' ? 'volume' : 'e1rm'] = Number(r.value);
  }
  return out;
}
function keyFor(peId, name) { return peId ? `pe_${peId}` : `nm_${name}`; }

const chipStyle = {
  background: 'var(--surface)', border: '1px solid var(--border-strong)',
  borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700,
};
const miniBtn = {
  background: 'var(--surface)', border: '1px solid var(--border-strong)',
  borderRadius: 999, padding: '5px 11px', fontSize: 12, color: 'var(--text-muted)',
  cursor: 'pointer', font: 'inherit', fontWeight: 600,
};

function NumIn({ label, value, onChange }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--surface)', border: '1px solid var(--border-strong)',
      borderRadius: 10, padding: '8px 10px', flex: '0 0 auto',
    }}>
      <input type="number" inputMode="decimal" placeholder={label} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 58, background: 'none', border: 0, outline: 'none', color: 'var(--ink)', font: 'inherit', fontSize: 14 }} />
    </label>
  );
}
