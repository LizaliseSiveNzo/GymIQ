/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Wizard, OptionCard, StepperControl } from '../../onboarding/wizard.jsx';
import { generateProgram } from '../../lib/engines/generator.js';
import { persistProgram } from '../../lib/engines/persistProgram.js';
import { SKILLS, SKILL_ORDER } from '../../../../supabase/functions/_shared/calisthenicsSkills.js';
import { buildSkillGeneratedProgram } from '../../../../supabase/functions/_shared/skillGenerator.js';

const DISCLAIMER_VERSION = '2026-10-v2';
const COLORS = ['#C6FF3A', '#FF6A3D', '#60A5FA', '#C084FC', '#F472B6', '#2DD4BF'];
const ICONS = ['💪', '🏋️', '⚡', '🔥', '🦁', '🐺', '🚀', '🎯', '🏆', '🥊'];

const EMPTY = {
  health_link_consent: false, sex: '', dob: '', height_cm: '', body_fat_pct: '',
  training_experience: '', cardio_experience: '',
  gym_location: '', gym_name: '', equipment: {}, // {itemId: {selected, denoms:[num]}}
  goal: '', skills: [], focus: [], deprioritized: [], days_per_week: 4, session_minutes: 60,
  split: 'auto', deload: 'auto', programme_name: '', color: COLORS[0], icon: ICONS[0],
};

export default function Onboard() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rebuilding = params.get('new') === '1';

  const [muscles, setMuscles] = useState([]);
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const gymProfileIdRef = useRef(null);
  const persistedProgramRef = useRef(null);
  const requestIdRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const resumed = useRef(false);

  useEffect(() => {
    if (!profile) return;
    if (resumed.current) return;
    resumed.current = true;
    if (profile.onboarded_at && !rebuilding) { navigate('/workout', { replace: true }); return; }
    if (rebuilding) {
      requestIdRef.current = crypto.randomUUID();
      setStep(0); // start at the goal step
      (async () => {
        try {
          const { data: gym } = await supabase.from('gym_profiles').select('id').eq('user_id', profile.id).eq('is_default', true).limit(1).maybeSingle();
          const equipment = {};
          if (gym) {
            gymProfileIdRef.current = gym.id;
            const { data: rows } = await supabase.from('gym_profile_equipment').select('equipment_id,selected,denominations_kg').eq('profile_id', gym.id);
            (rows || []).forEach((row) => { equipment[row.equipment_id] = { selected: row.selected, denoms: row.denominations_kg || [] }; });
          }
          setForm((f) => ({ ...f, training_experience: profile.training_experience || '', cardio_experience: profile.cardio_experience || '', equipment }));
        } catch { /* keep defaults */ }
      })();
      return;
    }
    const st = profile.onboarding_state || {};
    const draft = st.draft || {};
    requestIdRef.current = draft.program_request_id || crypto.randomUUID();
    setForm((f) => ({ ...f, ...draft }));
    if (typeof st.step === 'number') setStep(Math.min(st.step, TOTAL - 1));
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const [m, e, x] = await Promise.all([
        supabase.from('muscles').select('id,name,region').order('sort_order'),
        supabase.from('equipment_items').select('*').order('sort_order'),
        supabase.from('exercises').select(
          'id,name,primary_muscle_id,secondary_muscle_fraction,movement_pattern,equipment_ids,difficulty,stability_demand,sort_order',
        ).is('owner_user_id', null),
      ]);
      if (m.error || e.error || x.error) { setErr('Could not load your exercise library. Refresh this page to try again.'); return; }
      setMuscles(m.data || []);
      setEquipmentItems(e.data || []);
      setCatalog(x.data || []);
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSkill = (id, checked) => setForm((f) => {
    let skills = f.skills || [];
    if (checked) { if (skills.length >= 4) return f; skills = [...skills, { id, level: 'not_yet', priority: skills.length + 1 }]; }
    else skills = skills.filter((s) => s.id !== id).map((s, i) => ({ ...s, priority: i + 1 }));
    return { ...f, skills };
  });
  const setSkillLevel = (id, level) => setForm((f) => ({ ...f, skills: (f.skills || []).map((s) => s.id === id ? { ...s, level } : s) }));
  const toggleArr = (k, id) => setForm((f) => ({
    ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id],
  }));

  /** Persist a partial patch to users + stash the whole draft & cursor. */
  async function persist(patch, advance = false) {
    if (!profile || profile.demo) return;
    const nextStep = advance ? Math.min(step + 1, TOTAL - 1) : step;
    const payload = {
      ...patch,
      onboarding_state: { phase: S[nextStep].phase, step: nextStep, draft: { ...form, ...patch, program_request_id: requestIdRef.current } },
    };
    const { error } = await supabase.from('users').update(payload).eq('id', profile.id);
    if (error) throw error;
  }

  async function saveGymProfile() {
    if (!profile || profile.demo) return;
    const name = (form.gym_name || '').trim() || 'My Gym';
    const existing = await supabase.from('gym_profiles').select('id').eq('user_id', profile.id).limit(1);
    if (existing.error) throw existing.error;
    let profileId = existing.data?.[0]?.id;
    if (!profileId) {
      const ins = await supabase
        .from('gym_profiles')
        .insert({ user_id: profile.id, name, icon: form.icon || '🏋️', is_default: true })
        .select('id').single();
      if (ins.error) throw ins.error;
      profileId = ins.data.id;
    } else {
      const { error } = await supabase.from('gym_profiles').update({ name }).eq('id', profileId);
      if (error) throw error;
    }
    gymProfileIdRef.current = profileId;
    const rows = equipmentItems.map((it) => {
      const sel = form.equipment[it.id] || {};
      return {
        profile_id: profileId, equipment_id: it.id,
        selected: !!sel.selected,
        denominations_kg: Array.isArray(sel.denoms) ? sel.denoms : (it.default_denominations_kg || []),
      };
    });
    const { error } = await supabase.from('gym_profile_equipment').upsert(rows, { onConflict: 'profile_id,equipment_id' });
    if (error) throw error;
  }

  /* ------------------------------ step definitions ------------------------------ */
  const S = [];
  const add = (o) => S.push(o);

  // ---- PHASE: PROGRAM ----
  add({ key: 'goal', phase: 'program', title: 'Primary goal?',
    sub: 'This shapes your rep ranges, rest periods and progression.',
    valid: (f) => !!f.goal,
    node: (f, st) => (
      <>
        <div className="ob-options">
        <OptionCard icon="📈" title="Muscle Hypertrophy" desc="Size: moderate weights, moderate-high reps" selected={f.goal === 'hypertrophy'} onClick={() => st('goal', 'hypertrophy')} />
        <OptionCard icon="🏋️" title="Muscle Strength" desc="Maximal strength: heavier weights, fewer reps" selected={f.goal === 'strength'} onClick={() => st('goal', 'strength')} />
        <OptionCard icon="⚖️" title="Both Strength & Hypertrophy" desc="Balanced mix of rep schemes" selected={f.goal === 'both'} onClick={() => st('goal', 'both')} />
        <OptionCard icon="🔥" title="Fat Loss" desc="Fat loss: moderate reps, shorter rests to keep muscle" selected={f.goal === 'fat_loss'} onClick={() => st('goal', 'fat_loss')} />
        <OptionCard icon="🤸" title="Calisthenics" desc="Bodyweight training: skill-based path" selected={f.goal === 'calisthenics'} onClick={() => st('goal', 'calisthenics')} />
      </div>
      {f.goal === 'calisthenics' && (
        <div className="skill-picker" style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 16 }}>Choose up to 4 skills to train</h4>
          {SKILL_ORDER.map((skillId) => {
            const skill = SKILLS[skillId];
            const sel = (f.skills || []).find((s) => s.id === skillId);
            return (
              <div key={skillId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={!!sel} disabled={!sel && (f.skills || []).length >= 4} onChange={(e) => toggleSkill(skillId, e.target.checked)} />
                <span style={{ flex: 1 }}>{skill.name}{sel ? ` · priority ${sel.priority}` : ''}</span>
                {sel && (
                  <select value={sel.level} onChange={(e) => setSkillLevel(skillId, e.target.value)} style={{ minHeight: 36 }}>
                    <option value="not_yet">Not yet able</option>
                    <option value="learning">Currently learning</option>
                    <option value="able">Able · improving</option>
                  </select>
                )}
              </div>
            );
          })}
          {(f.skills || []).length === 0 && <p className="subtle" style={{ margin: 0 }}>Pick skills to train toward — or leave empty for general bodyweight training without a specific skill.</p>}
        </div>
      )}
      </>
    ) });

  add({ key: 'exp', phase: 'program', title: 'Training experience?',
    valid: (f) => !!f.training_experience,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="🌱" title="Novice" desc="Under ~1 year of consistent lifting" selected={f.training_experience === 'novice'} onClick={() => st('training_experience', 'novice')} />
        <OptionCard icon="🌿" title="Intermediate" desc="1–3 years, know most movements" selected={f.training_experience === 'intermediate'} onClick={() => st('training_experience', 'intermediate')} />
        <OptionCard icon="🌳" title="Advanced" desc="3+ years, close to your ceiling" selected={f.training_experience === 'advanced'} onClick={() => st('training_experience', 'advanced')} />
      </div>
    ),
    save: () => persist({ training_experience: form.training_experience }) });

  add({ key: 'days', phase: 'program', title: 'Days per week?',
    valid: () => true,
    node: (f, st) => <StepperControl value={f.days_per_week} min={2} max={6} onChange={(v) => st('days_per_week', v)} unit="days / week" /> });

  add({ key: 'time', phase: 'program', title: 'Session length?',
    valid: (f) => !!f.session_minutes,
    node: (f, st) => (
      <div className="ob-options">
        {[30, 45, 60, 75, 90].map((mins) => (
          <OptionCard key={mins} icon="⏱" title={`${mins} minutes`} selected={Number(f.session_minutes) === mins}
            onClick={() => st('session_minutes', mins)} />
        ))}
      </div>
    ) });

  // ---- PHASE: GYM ----
  add({ key: 'where', phase: 'gym', title: 'Where will you train?',
    valid: (f) => !!f.gym_location,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="🏠" title="Home gym" desc="Own equipment, train at home" selected={f.gym_location === 'home'} onClick={() => st('gym_location', 'home')} />
        <OptionCard icon="🏟️" title="Commercial gym" desc="Full equipment selection" selected={f.gym_location === 'commercial'} onClick={() => st('gym_location', 'commercial')} />
        <OptionCard icon="🧳" title="Mixed / travel" desc="Varies week to week" selected={f.gym_location === 'mixed'} onClick={() => st('gym_location', 'mixed')} />
      </div>
    ) });

  add({ key: 'equipment', phase: 'gym', title: 'Pick your equipment',
    sub: 'Tap everything you can use — we’ll only programme what you have.',
    valid: (f) => Object.values(f.equipment).some((e) => e.selected),
    node: (f, st) => <EquipmentPicker items={equipmentItems} value={f.equipment} onChange={(v) => st('equipment', v)} />,
    save: () => persist({}).then(saveGymProfile) });

  // ---- PHASE: BASICS ----
  add({ key: 'about', phase: 'basics', title: 'About you',
    sub: 'Used for energy maths and sensible starting loads.',
    valid: (f) => !!f.sex && dobValid(f.dob),
    node: (f, st) => (
      <>
        <div className="ob-options">
          <OptionCard icon="♀" title="Female" selected={f.sex === 'female'} onClick={() => st('sex', 'female')} />
          <OptionCard icon="♂" title="Male" selected={f.sex === 'male'} onClick={() => st('sex', 'male')} />
        </div>
        <div className="ob-field" style={{ marginTop: 18 }}>
          <label className="ob-label" htmlFor="dob">Date of birth · adults 18+</label>
          <input id="dob" type="date" className="ob-date" value={f.dob} onChange={(e) => st('dob', e.target.value)} />
        </div>
      </>
    ),
    save: () => persist({ sex: form.sex, dob: form.dob }) });

  add({ key: 'body', phase: 'basics', title: 'Body stats',
    sub: 'Your starting measurements for your training profile.',
    valid: (f) => Number(f.height_cm) > 80 && Number(f.height_cm) < 260 && Number(f.weight_now) > 25,
    node: (f, st) => (
      <>
        <div className="ob-field ob-suffix">
          <label className="ob-label" htmlFor="h">Height</label>
          <input id="h" type="number" inputMode="decimal" className="ob-input" style={{ paddingRight: 44 }} placeholder="175" value={f.height_cm} onChange={(e) => st('height_cm', e.target.value)} />
          <em>cm</em>
        </div>
        <div className="ob-field ob-suffix" style={{ marginTop: 18 }}>
          <label className="ob-label" htmlFor="w">Current weight</label>
          <input id="w" type="number" inputMode="decimal" className="ob-input" style={{ paddingRight: 44 }} placeholder="80.0" value={f.weight_now || ''} onChange={(e) => st('weight_now', e.target.value)} />
          <em>kg</em>
        </div>
      </>
    ),
    save: () => persist({ height_cm: Number(form.height_cm) }) });

  // ---- PREVIEW / FINISH ----
  add({ key: 'preview', phase: 'preview', title: 'Your program, generated',
    sub: 'Built by transparent rules from your answers — not AI. Review your plan before saving.',
    valid: () => true, nextLabel: 'Save & continue',
    node: (f) => (
      <>
        <PreviewSummary f={f} muscles={muscles} count={equipmentCount(f)} />
        <GeneratedPreview program={previewProgram} />
      </>
    ),
    save: async () => {
      if (!profile || profile.demo) return;
      if (!previewProgram || previewProgram.error) {
        throw new Error(previewProgram?.error || 'No program drafted yet — go back one step and retry.');
      }
      if (persistedProgramRef.current) return;
      const id = await persistProgram(previewProgram, {
        clientId: profile.id,
        requestId: requestIdRef.current ||= crypto.randomUUID(),
        gymProfileId: gymProfileIdRef.current,
        name: form.programme_name || `${(form.split === 'auto' ? 'Auto' : form.split).replace('_', ' ')} Program`,
        color: form.color,
        icon: form.icon,
      });
      persistedProgramRef.current = id;
    } });

  add({ key: 'finish', phase: 'legal', title: 'Ready to start',
    sub: 'One last thing — please read before training with GymIQ.',
    valid: (f) => !!f.disclaimer_agreed, nextLabel: 'Enter GymIQ',
    node: (f, st) => (
      <>
        <div className="prev-card" style={{ marginBottom: 16 }}><h4>Your 7-day premium trial is ready</h4><p>Personalised programmes, daily meal plans and progress reports. Manage your membership in Account. No automatic debit.</p></div>
        <Disclaimer f={f} st={st} />
      </>
    ),
    save: async () => {
      if (profile && !profile.demo) {
        await persist({ disclaimer_version: DISCLAIMER_VERSION, disclaimer_accepted_at: new Date().toISOString() });
        const { error } = await supabase.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', profile.id);
        if (error) throw error;
      }
      await refreshProfile();
      navigate('/workout', { replace: true });
    } });

  const TOTAL = S.length;
  const cur = S[Math.min(step, TOTAL - 1)];
  const valid = useMemo(() => (cur?.valid ? cur.valid(form) : true), [cur, form]);

  // Live-draft the program while sitting on the preview step ("the aha").
  const previewProgram = useMemo(() => {
    if (!cur || cur.key !== 'preview') return null;
    return safeGenerate(form, catalog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.key, form, catalog]);

  async function next() {
    if (!valid || busy) return;
    setBusy(true); setErr('');
    try {
      if (cur.save) await cur.save();
      if (step < TOTAL - 1 && profile && !profile.demo) await persist({}, true);
      if (step < TOTAL - 1) setStep(step + 1);
    } catch (e) {
      setErr(e?.message || 'Could not save — check your connection and try again.');
    } finally { setBusy(false); }
  }

  function back() { if (step > 0) setStep(step - 1); }

  return (
    <Wizard
      stepIndex={step} totalSteps={TOTAL}
      onBack={back} title={cur.title} sub={cur.sub}
      nextLabel={busy ? 'Saving…' : cur.nextLabel} nextDisabled={!valid || busy}
      onNext={next} skipLabel={cur.skipLabel} onSkip={cur.onSkip}
    >
      {!rebuilding&&<button className="btn btn-ghost" disabled={busy} onClick={async()=>{
        setBusy(true);setErr('');try{const {error}=await supabase.from('users').update({onboarded_at:new Date().toISOString()}).eq('id',profile.id);if(error)throw error;await refreshProfile();navigate('/workout',{replace:true});}catch{setErr('Could not skip setup. Please try again.');}finally{setBusy(false);}
      }}>Skip programme setup</button>}
      {cur.node(form, set)}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{err}</p>}
    </Wizard>
  );
}

/* --------------------------------- helpers --------------------------------- */

function dobValid(dob) {
  const d = new Date(dob);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return Number.isFinite(d.getTime()) && d <= cutoff && d.getFullYear() > 1900;
}

function equipmentCount(f) {
  return Object.values(f.equipment).filter((e) => e.selected).length;
}

function EquipmentPicker({ items, value, onChange }) {
  const byCat = useMemo(() => {
    const g = {};
    items.forEach((it) => { (g[it.category] ||= []).push(it); });
    return g;
  }, [items]);

  function toggleItem(it) {
    const cur = value[it.id] || {};
    const turningOn = !cur.selected;
    onChange({
      ...value,
      [it.id]: {
        selected: turningOn,
        denoms: turningOn ? (it.default_denominations_kg || []) : (cur.denoms || []),
      },
    });
  }

  return (
    <>
      {Object.entries(byCat).map(([cat, list]) => (
        <div key={cat}>
          <div className="eq-cat">{cat}</div>
          <div className="eq-grid">
            {list.map((it) => (
              <button key={it.id} type="button" className={`eq-item ${value[it.id]?.selected ? 'on' : ''}`} onClick={() => toggleItem(it)}>
                {value[it.id]?.selected ? '✓' : '+'} {it.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function PreviewSummary({ f, muscles, count }) {
  const nameOf = (ids) => ids.map((id) => muscles.find((m) => m.id === id)?.name).filter(Boolean).join(', ') || '—';
  const splitLabel = { auto: 'Auto (best fit)', full_body: 'Full Body', upper_lower: 'Upper / Lower', ppl: 'Push Pull Legs' };
  return (
    <>
      <div className="prev-card">
        <h4>{f.icon} {f.programme_name || 'My Program'}</h4>
        <div className="prev-row"><b>Goal</b><span>{{ hypertrophy: 'Hypertrophy', strength: 'Strength', both: 'Strength + Hypertrophy', fat_loss: 'Fat Loss', calisthenics: 'Calisthenics' }[f.goal] || '—'}</span></div>
        <div className="prev-row"><b>Schedule</b><span>{f.days_per_week} days · {f.session_minutes} min</span></div>
        <div className="prev-row"><b>Split</b><span>{splitLabel[f.split]}</span></div>
        <div className="prev-row"><b>Deload</b><span>{{ auto: 'Auto', never: 'None' }[f.deload] || (f.deload || '').replace('_', ' ')}</span></div>
        <div className="prev-row"><b>Focus</b><span>{nameOf(f.focus)}</span></div>
        <div className="prev-row"><b>Deprioritized</b><span>{nameOf(f.deprioritized)}</span></div>
        <div className="prev-row"><b>Equipment</b><span>{count} items · “{f.gym_name || 'My Gym'}”</span></div>
      </div>
      <div className="prev-card" style={{ opacity: .8 }}>
        <h4>⚡ Personal training targets</h4>
        <div className="prev-row"><b>Per-set targets</b><span>weight × reps × RIR</span></div>
        <div className="prev-row"><b>Transparent rules</b><span>based on your goals</span></div>
        <div className="prev-row"><b>Fully editable</b><span>override anything</span></div>
      </div>
    </>
  );
}

function Disclaimer({ f, st }) {
  return (
    <>
      <div className="disclaimer-box">
        <h5>Not medical advice</h5>
        GymIQ provides general fitness information, not medical advice. Consult a qualified
        health professional before starting any exercise or nutrition program.
        <h5>Train at your own risk</h5>
        Resistance training carries inherent risk of injury. Use spotters, safety pins and
        sensible loads; stop immediately if you feel pain, dizziness or shortness of breath.
        <h5>RIR targets are guidance</h5>
        Reps-in-reserve targets and previous loads are training references. Choose a sensible weight for every lift.
        <h5>Data & privacy</h5>
        Your logs stay in your account. You can export your data, contact support or delete your account from Account.
      </div>
      <label className="agree-row">
        <input type="checkbox" checked={!!f.disclaimer_agreed} onChange={(e) => st('disclaimer_agreed', e.target.checked)} />
        I have read and accept this disclaimer ({DISCLAIMER_VERSION}).
      </label>
    </>
  );
}

/* --------------------------- live generation --------------------------- */

const prettyMuscle = (id) => (id || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function safeGenerate(f, catalogRows) {
  try {
    const equipmentIds = Object.entries(f.equipment || {}).filter(([, v]) => v.selected).map(([id]) => id);
    if (f.goal === 'calisthenics' && (f.skills || []).length) {
      return buildSkillGeneratedProgram({
        skills: f.skills.map((s) => ({ id: s.id, level: s.level, priority: s.priority })),
        equipmentIds,
        daysPerWeek: f.days_per_week || 3,
        sessionMinutes: Number(f.session_minutes) || 60,
        exercises: catalogRows,
        name: f.programme_name || 'Calisthenics Skills',
      });
    }
    return generateProgram({
      goal: f.goal || 'hypertrophy',
      daysPerWeek: f.days_per_week || 4,
      sessionMinutes: Number(f.session_minutes) || 60,
      split: f.split || 'auto',
      experience: f.training_experience || 'intermediate',
      focus: f.focus || [],
      deprioritized: f.deprioritized || [],
      equipmentIds,
      name: f.programme_name || '',
    }, { exercises: catalogRows });
  } catch (e) {
    return { error: e?.message || 'Generation failed' };
  }
}

function GeneratedPreview({ program }) {
  if (!program) {
    return (
      <div className="prev-card" style={{ opacity: .6 }}>
        <h4>⏳ Drafting your program…</h4>
        <div className="subtle" style={{ fontSize: 13 }}>Loading the exercise catalog.</div>
      </div>
    );
  }
  if (program.error) {
    return (
      <div className="prev-card">
        <h4>⚠️ Couldn&apos;t draft a program</h4>
        <div className="subtle" style={{ fontSize: 13 }}>{program.error} — check your equipment selection has at least one item.</div>
      </div>
    );
  }
  const weekly = Object.entries(program.weeklySets)
    .filter(([, v]) => v >= 1)
    .sort((a, b) => b[1] - a[1]);
  const deloads = program.weeks.filter((w) => w.kind === 'deload').map((w) => `W${w.weekNumber}`);

  return (
    <>
      {program.days.map((d) => (
        <div key={d.label} className="prev-card">
          <h4>{d.label} · {d.name}</h4>
          <div className="chiprow" style={{ margin: '7px 0 9px' }}>
            {(d.focusSummary || []).map((m) => <span key={m} className="chip on">{prettyMuscle(m)}</span>)}
          </div>
          {d.exercises.map((x) => (
            <div key={x.exerciseId} className="prev-row">
              <b>{x.sets} × {x.repMin}–{x.repMax}</b>
              <span>{x.name}{x.role === 'main' ? ' · main lift' : ''} · RIR {x.rir}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="prev-card">
        <h4>📊 Weekly sets per muscle</h4>
        {weekly.map(([m, v]) => (
          <div key={m} className="prev-row">
            <span style={{ textAlign: 'left' }}>{prettyMuscle(m)}</span>
            <b>{Math.round(v)}</b>
          </div>
        ))}
        <div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>
          Deload weeks: {deloads.length ? deloads.join(' · ') : 'none'}
        </div>
      </div>
    </>
  );
}
import '../../styles/onboarding.css';
