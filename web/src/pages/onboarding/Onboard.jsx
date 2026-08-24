/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Wizard, OptionCard, StepperControl } from '../../onboarding/wizard.jsx';
import { generateProgram } from '../../lib/engines/generator.js';
import { persistProgram } from '../../lib/engines/persistProgram.js';

const DISCLAIMER_VERSION = '2026-08-v1';
const COLORS = ['#C6FF3A', '#FF6A3D', '#60A5FA', '#C084FC', '#F472B6', '#2DD4BF'];
const ICONS = ['💪', '🏋️', '⚡', '🔥', '🦁', '🐺', '🚀', '🎯', '🏆', '🥊'];

const EMPTY = {
  // basics
  health_link_consent: false, sex: '', dob: '', height_cm: '', body_fat_pct: '',
  training_experience: '', cardio_experience: '',
  // gym
  gym_location: '', gym_name: '', equipment: {}, // {itemId: {selected, denoms:[num]}}
  // program (consumed by the Phase 3 generator)
  goal: '', focus: [], deprioritized: [], days_per_week: 4, session_minutes: 60,
  split: 'auto', deload: 'auto', programme_name: '', color: COLORS[0], icon: ICONS[0],
};

export default function Onboard() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [muscles, setMuscles] = useState([]);
  const [equipmentItems, setEquipmentItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const gymProfileIdRef = useRef(null);
  const persistedProgramRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const resumed = useRef(false);

  useEffect(() => {
    if (!profile) return;
    if (resumed.current) return;
    resumed.current = true;
    if (profile.onboarded_at) { navigate('/today', { replace: true }); return; }
    const st = profile.onboarding_state || {};
    const draft = st.draft || {};
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
      setMuscles(m.data || []);
      setEquipmentItems(e.data || []);
      setCatalog(x.data || []);
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleArr = (k, id) => setForm((f) => ({
    ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id],
  }));

  /** Persist a partial patch to users + stash the whole draft & cursor. */
  async function persist(patch) {
    if (!profile || profile.demo) return;
    const nextStep = Math.min(step + 1, TOTAL - 1);
    const payload = {
      ...patch,
      onboarding_state: { phase: STEPS[nextStep].phase, step: nextStep, draft: { ...form, ...patch } },
    };
    const { error } = await supabase.from('users').update(payload).eq('id', profile.id);
    if (error) throw error;
  }

  async function saveGymProfile() {
    if (!profile || profile.demo) return;
    const name = (form.gym_name || '').trim() || 'My Gym';
    const existing = await supabase.from('gym_profiles').select('id').eq('user_id', profile.id).limit(1);
    let profileId = existing.data?.[0]?.id;
    if (!profileId) {
      const ins = await supabase
        .from('gym_profiles')
        .insert({ user_id: profile.id, name, icon: form.icon || '🏋️', is_default: true })
        .select('id').single();
      if (ins.error) throw ins.error;
      profileId = ins.data.id;
    } else {
      await supabase.from('gym_profiles').update({ name }).eq('id', profileId);
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
    await supabase.from('gym_profile_equipment').delete().eq('profile_id', profileId);
    const { error } = await supabase.from('gym_profile_equipment').insert(rows);
    if (error) throw error;
  }

  /* ------------------------------ step definitions ------------------------------ */
  const S = [];
  const add = (o) => S.push(o);

  // ---- PHASE: BASICS ----
  add({ key: 'health', phase: 'basics', title: 'Link your health data',
    sub: 'GymIQ can sync weigh-ins and activity. On web we store your consent and sync manually — mobile integrations arrive later.',
    valid: () => true,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="🔗" title="Yes, link my health data" desc="Sync weigh-ins and steps where supported"
          selected={!!f.health_link_consent} onClick={() => st('health_link_consent', true)} />
        <OptionCard icon="🚫" title="Not now" desc="You can enable integrations anytime in More"
          selected={!f.health_link_consent} onClick={() => st('health_link_consent', false)} />
      </div>
    ),
    save: () => persist({ health_link_consent: form.health_link_consent }) });

  add({ key: 'sex', phase: 'basics', title: 'What is your sex?',
    sub: 'Used for energy maths and sensible starting loads.',
    valid: (f) => !!f.sex,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="♀" title="Female" selected={f.sex === 'female'} onClick={() => st('sex', 'female')} />
        <OptionCard icon="♂" title="Male" selected={f.sex === 'male'} onClick={() => st('sex', 'male')} />
      </div>
    ),
    save: () => persist({ sex: form.sex }) });

  add({ key: 'dob', phase: 'basics', title: 'When were you born?',
    sub: 'Age calibrates your starting estimates.',
    valid: (f) => !!f.dob,
    node: (f, st) => (
      <div className="ob-field">
        <label className="ob-label" htmlFor="dob">Date of birth</label>
        <input id="dob" type="date" className="ob-date" value={f.dob} onChange={(e) => st('dob', e.target.value)} />
      </div>
    ),
    save: () => persist({ dob: form.dob }) });

  add({ key: 'height', phase: 'basics', title: 'How tall are you?',
    valid: (f) => Number(f.height_cm) > 80 && Number(f.height_cm) < 260,
    node: (f, st) => (
      <div className="ob-field ob-suffix">
        <label className="ob-label" htmlFor="h">Height</label>
        <input id="h" type="number" inputMode="decimal" className="ob-input" style={{ paddingRight: 44 }}
          placeholder="175" value={f.height_cm} onChange={(e) => st('height_cm', e.target.value)} />
        <em>cm</em>
      </div>
    ),
    save: () => persist({ height_cm: Number(form.height_cm) }) });

  add({ key: 'weight', phase: 'basics', title: 'How much do you weigh?',
    sub: 'Your first weigh-in — you can log a better one any day.',
    valid: (f) => Number(f.weight_now) > 25,
    node: (f, st) => (
      <div className="ob-field ob-suffix">
        <label className="ob-label" htmlFor="w">Current weight</label>
        <input id="w" type="number" inputMode="decimal" className="ob-input" style={{ paddingRight: 44 }}
          placeholder="80.0" value={f.weight_now || ''} onChange={(e) => st('weight_now', e.target.value)} />
        <em>kg</em>
      </div>
    ) });

  add({ key: 'bf', phase: 'basics', title: 'Estimated body fat?',
    sub: 'A rough visual estimate is fine — this is optional.',
    valid: () => true, skipLabel: 'Skip',
    onSkip: () => set('body_fat_pct', ''),
    node: (f, st) => (
      <div className="ob-field ob-suffix">
        <label className="ob-label" htmlFor="bf">Body fat %</label>
        <input id="bf" type="number" inputMode="decimal" className="ob-input" style={{ paddingRight: 44 }}
          placeholder="20" value={f.body_fat_pct} onChange={(e) => st('body_fat_pct', e.target.value)} />
        <em>%</em>
      </div>
    ),
    save: () => persist({ body_fat_pct: form.body_fat_pct === '' ? null : Number(form.body_fat_pct) }) });

  add({ key: 'exp', phase: 'basics', title: 'Training experience?',
    valid: (f) => !!f.training_experience,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="🌱" title="Novice" desc="Under ~1 year of consistent lifting" selected={f.training_experience === 'novice'} onClick={() => st('training_experience', 'novice')} />
        <OptionCard icon="🌿" title="Intermediate" desc="1–3 years, know most movements" selected={f.training_experience === 'intermediate'} onClick={() => st('training_experience', 'intermediate')} />
        <OptionCard icon="🌳" title="Advanced" desc="3+ years, close to your ceiling" selected={f.training_experience === 'advanced'} onClick={() => st('training_experience', 'advanced')} />
      </div>
    ),
    save: () => persist({ training_experience: form.training_experience }) });

  add({ key: 'cardio', phase: 'basics', title: 'Cardio conditioning?',
    sub: 'Affects rest periods and work capacity assumptions.', skipLabel: 'Skip', valid: () => true,
    onSkip: () => set('cardio_experience', ''),
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="🚶" title="Low" desc="Little regular cardio" selected={f.cardio_experience === 'low'} onClick={() => st('cardio_experience', 'low')} />
        <OptionCard icon="🏃" title="Moderate" desc="Some cardio most weeks" selected={f.cardio_experience === 'moderate'} onClick={() => st('cardio_experience', 'moderate')} />
        <OptionCard icon="🏃‍♂️💨" title="High" desc="Trained endurance athlete" selected={f.cardio_experience === 'high'} onClick={() => st('cardio_experience', 'high')} />
      </div>
    ),
    save: () => persist({ cardio_experience: form.cardio_experience }) });

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

  add({ key: 'nickname', phase: 'gym', title: 'Name your gym',
    sub: 'You can add more gyms later — each keeps its own equipment.',
    valid: () => true,
    node: (f, st) => (
      <div className="ob-field">
        <label className="ob-label" htmlFor="gn">Gym nickname</label>
        <input id="gn" className="ob-input" placeholder={f.gym_location === 'home' ? 'Home Gym' : 'My Gym'}
          value={f.gym_name} onChange={(e) => st('gym_name', e.target.value)} />
      </div>
    ) });

  add({ key: 'equipment', phase: 'gym', title: 'Pick your equipment',
    sub: 'Only exercises you can actually load will be programmed.',
    valid: (f) => Object.values(f.equipment).some((e) => e.selected),
    node: (f, st) => <EquipmentPicker items={equipmentItems} value={f.equipment} onChange={(v) => st('equipment', v)} />,
    save: () => persist({}).then(saveGymProfile) });

  // ---- PHASE: PROGRAM ----
  add({ key: 'goal', phase: 'program', title: 'Primary goal?',
    valid: (f) => !!f.goal,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="📈" title="Muscle Hypertrophy" desc="Size: moderate weights, moderate-high reps" selected={f.goal === 'hypertrophy'} onClick={() => st('goal', 'hypertrophy')} />
        <OptionCard icon="🏋️" title="Muscle Strength" desc="Maximal strength: heavier weights, fewer reps" selected={f.goal === 'strength'} onClick={() => st('goal', 'strength')} />
        <OptionCard icon="⚖️" title="Both Strength & Hypertrophy" desc="Balanced mix of rep schemes" selected={f.goal === 'both'} onClick={() => st('goal', 'both')} />
      </div>
    ) });

  add({ key: 'focus', phase: 'program', title: 'Focus muscles',
    sub: 'Priority areas get extra weekly volume.',
    valid: () => true, skipLabel: 'No priority',
    onSkip: () => set('focus', []),
    node: (f, st) => (
      <div className="muscle-grid">
        {muscles.map((m) => (
          <button key={m.id} type="button" className={`muscle-chip ${f.focus.includes(m.id) ? 'on' : ''}`}
            onClick={() => toggleArr('focus', m.id)}>{m.name}</button>
        ))}
      </div>
    ) });

  add({ key: 'depri', phase: 'program', title: 'Deprioritize muscles',
    sub: 'These get minimum effective volume.',
    valid: () => true, skipLabel: 'None',
    onSkip: () => set('deprioritized', []),
    node: (f, st) => (
      <div className="muscle-grid">
        {muscles.filter((m) => !f.focus.includes(m.id)).map((m) => (
          <button key={m.id} type="button" className={`muscle-chip ${f.deprioritized.includes(m.id) ? 'on' : ''}`}
            onClick={() => toggleArr('deprioritized', m.id)}>{m.name}</button>
        ))}
      </div>
    ) });

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

  add({ key: 'split', phase: 'program', title: 'Training split',
    sub: 'Not sure? Auto picks the best fit for your days.',
    valid: (f) => !!f.split,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="✨" title="Auto" desc="Best split for your availability" selected={f.split === 'auto'} onClick={() => st('split', 'auto')} />
        <OptionCard icon="🧍" title="Full Body" desc="Every major muscle, each session" selected={f.split === 'full_body'} onClick={() => st('split', 'full_body')} />
        <OptionCard icon="🔀" title="Upper / Lower" desc="Alternating upper and lower days" selected={f.split === 'upper_lower'} onClick={() => st('split', 'upper_lower')} />
        <OptionCard icon="🔁" title="Push Pull Legs" desc="Movement-type split" selected={f.split === 'ppl'} onClick={() => st('split', 'ppl')} />
      </div>
    ) });

  add({ key: 'deload', phase: 'program', title: 'Deload weeks?',
    sub: 'Planned lighter recovery weeks keep progress steady.',
    valid: (f) => !!f.deload,
    node: (f, st) => (
      <div className="ob-options">
        <OptionCard icon="🤖" title="Auto" desc="Scheduled when fatigue accumulates" selected={f.deload === 'auto'} onClick={() => st('deload', 'auto')} />
        <OptionCard icon="4️⃣" title="Every 4 weeks" selected={f.deload === 'every_4w'} onClick={() => st('deload', 'every_4w')} />
        <OptionCard icon="6️⃣" title="Every 6 weeks" selected={f.deload === 'every_6w'} onClick={() => st('deload', 'every_6w')} />
        <OptionCard icon="🚫" title="Never" desc="I'll manage recovery myself" selected={f.deload === 'never'} onClick={() => st('deload', 'never')} />
      </div>
    ) });

  add({ key: 'pname', phase: 'program', title: 'Name your program',
    valid: () => true,
    node: (f, st) => (
      <div className="ob-field">
        <label className="ob-label" htmlFor="pn">Program name</label>
        <input id="pn" className="ob-input" placeholder={`${f.training_experience ? f.training_experience[0].toUpperCase() + f.training_experience.slice(1) : 'My'} ${f.split === 'ppl' ? 'PPL' : f.split === 'upper_lower' ? 'Upper/Lower' : f.split === 'full_body' ? 'Full Body' : 'Program'}`}
          value={f.programme_name} onChange={(e) => st('programme_name', e.target.value)} />
      </div>
    ) });

  add({ key: 'theme', phase: 'program', title: 'Make it yours',
    sub: 'Color and icon for your program card.',
    valid: () => true,
    node: (f, st) => (
      <>
        <div className="swatch-row" style={{ marginBottom: 20 }}>
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={c} className={`swatch ${f.color === c ? 'on' : ''}`}
              style={{ background: c }} onClick={() => st('color', c)} />
          ))}
        </div>
        <div className="icon-grid">
          {ICONS.map((i) => (
            <button key={i} type="button" className={`icon-tile ${f.icon === i ? 'on' : ''}`} onClick={() => st('icon', i)}>{i}</button>
          ))}
        </div>
      </>
    ) });

  // ---- PREVIEW / PAYWALL / LEGAL / FINISH ----
  add({ key: 'preview', phase: 'preview', title: 'Your program, generated',
    sub: 'Built by transparent rules from your answers — not AI. Everything stays editable.',
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
        gymProfileId: gymProfileIdRef.current,
        name: form.programme_name || `${(form.split === 'auto' ? 'Auto' : form.split).replace('_', ' ')} Program`,
        color: form.color,
        icon: form.icon,
      });
      persistedProgramRef.current = id;
    } });

  add({ key: 'paywall', phase: 'preview', title: 'Choose your plan',
    sub: 'Structure preview — real billing arrives post-Phase 7. Trials activate instantly.',
    valid: (f) => !!f.plan,
    node: (f, st) => <PlanCards f={f} st={st} />,
    save: async () => {
      if (!profile || profile.demo) return;
      const now = new Date();
      const end = new Date(now.getTime() + 7 * 864e5);
      const { error } = await supabase.from('entitlements').upsert({
        user_id: profile.id, plan: form.plan === 'yearly' ? 'premium_yearly' : form.plan === 'monthly' ? 'premium_monthly' : 'trial',
        status: 'active', trial_started_at: now.toISOString(), trial_ends_at: end.toISOString(), updated_at: now.toISOString(),
      });
      if (error) throw error;
    } });

  add({ key: 'disclaimer', phase: 'legal', title: 'Health disclaimer',
    sub: 'Please read before training with GymIQ.',
    valid: (f) => !!f.disclaimer_agreed,
    node: (f, st) => <Disclaimer f={f} st={st} />,
    save: () => persist({ disclaimer_version: DISCLAIMER_VERSION, disclaimer_accepted_at: new Date().toISOString() }) });

  add({ key: 'first30', phase: 'legal', title: 'Your first 30 days',
    sub: 'GymIQ learns as you train — here is what to expect.',
    valid: () => true,
    node: () => <FirstThirty /> });

  add({ key: 'done', phase: 'done', title: "You're set",
    sub: 'Your answers are saved. Generation begins in Phase 3 — then every set gets an Auto target.',
    valid: () => true, nextLabel: 'Enter GymIQ',
    node: () => <div className="check-big">✅</div>,
    save: async () => {
      if (profile && !profile.demo) {
        await persist({});
        await supabase.from('users').update({ onboarded_at: new Date().toISOString() }).eq('id', profile.id);
      }
      await refreshProfile();
      navigate('/today', { replace: true });
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
      {cur.node(form, set)}
      {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{err}</p>}
    </Wizard>
  );
}

/* --------------------------------- helpers --------------------------------- */

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
        denoms: turningOn ? (cur.denoms?.length ? cur.denoms : (it.default_denominations_kg || [])) : (cur.denoms || []),
      },
    });
  }

  function setDenoms(id, denoms) {
    onChange({ ...value, [id]: { ...(value[id] || {}), selected: true, denoms } });
  }

  const weighted = items.filter((it) => value[it.id]?.selected && (it.category === 'barbell' || it.category === 'dumbbell' || it.category === 'kettlebell'));

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

      {weighted.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="eq-cat">Weights available (editable)</div>
          {weighted.map((it) => (
            <div key={it.id} className="ob-field" style={{ marginBottom: 12 }}>
              <span className="ob-label">{it.name}</span>
              <DenomEditor denoms={value[it.id].denoms || []} onChange={(d) => setDenoms(it.id, d)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DenomEditor({ denoms, onChange }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const sorted = [...denoms].sort((a, b) => a - b);
  return (
    <div className="denoms">
      {sorted.map((d) => (
        <span key={d} className="denom-chip">
          {d}
          <button aria-label={`Remove ${d}`} onClick={() => onChange(sorted.filter((x) => x !== d))}>✕</button>
        </span>
      ))}
      {adding ? (
        <input autoFocus className="denom-input" type="number" inputMode="decimal" value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { const n = parseFloat(val); if (n > 0 && !sorted.includes(n)) onChange([...sorted, n]); setAdding(false); setVal(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
      ) : (
        <button className="denom-add" onClick={() => setAdding(true)}>+ add kg</button>
      )}
    </div>
  );
}

function PreviewSummary({ f, muscles, count }) {
  const nameOf = (ids) => ids.map((id) => muscles.find((m) => m.id === id)?.name).filter(Boolean).join(', ') || '—';
  const splitLabel = { auto: 'Auto (best fit)', full_body: 'Full Body', upper_lower: 'Upper / Lower', ppl: 'Push Pull Legs' };
  return (
    <>
      <div className="prev-card">
        <h4>{f.icon} {f.programme_name || 'My Program'}</h4>
        <div className="prev-row"><b>Goal</b><span>{{ hypertrophy: 'Hypertrophy', strength: 'Strength', both: 'Strength + Hypertrophy' }[f.goal] || '—'}</span></div>
        <div className="prev-row"><b>Schedule</b><span>{f.days_per_week} days · {f.session_minutes} min</span></div>
        <div className="prev-row"><b>Split</b><span>{splitLabel[f.split]}</span></div>
        <div className="prev-row"><b>Deload</b><span>{{ auto: 'Auto', never: 'None' }[f.deload] || (f.deload || '').replace('_', ' ')}</span></div>
        <div className="prev-row"><b>Focus</b><span>{nameOf(f.focus)}</span></div>
        <div className="prev-row"><b>Deprioritized</b><span>{nameOf(f.deprioritized)}</span></div>
        <div className="prev-row"><b>Equipment</b><span>{count} items · “{f.gym_name || 'My Gym'}”</span></div>
      </div>
      <div className="prev-card" style={{ opacity: .8 }}>
        <h4>⚡ Rule-based auto-progression</h4>
        <div className="prev-row"><b>Per-set targets</b><span>weight × reps × RIR</span></div>
        <div className="prev-row"><b>Transparent rules</b><span>no black-box AI</span></div>
        <div className="prev-row"><b>Fully editable</b><span>override anything</span></div>
      </div>
    </>
  );
}

function PlanCards({ f, st }) {
  const plans = [
    { id: 'monthly', price: '$11.99', per: '/month' },
    { id: 'sixmonth', price: '$47.99', per: '6 months', save: '~$7.99/mo' },
    { id: 'yearly', price: '$71.99', per: '/year', save: 'best value' },
  ];
  return (
    <div className="ob-options">
      {plans.map((p) => (
        <button key={p.id} type="button" className={`plan-card ${f.plan === p.id ? 'on' : ''}`} onClick={() => st('plan', p.id)}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{p.id === 'sixmonth' ? '6-Month' : p.id}</span>
            {p.save && <span className="badge-save">{p.save.toUpperCase()}</span>}
            <div className="plan-per">7-day free trial included</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="plan-price">{p.price}</div>
            <div className="plan-per">{p.per}</div>
          </div>
        </button>
      ))}
    </div>
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
        Reps-in-reserve targets are estimates. Auto-adjusted weights follow transparent rules
        applied to your logged performance — you remain responsible for every lift you attempt.
        <h5>Data & privacy</h5>
        Your logs stay in your account, protected by row-level security. You can export or
        permanently delete your data from More → Data management at any time.
      </div>
      <label className="agree-row">
        <input type="checkbox" checked={!!f.disclaimer_agreed} onChange={(e) => st('disclaimer_agreed', e.target.checked)} />
        I have read and accept this disclaimer ({DISCLAIMER_VERSION}).
      </label>
    </>
  );
}

function FirstThirty() {
  const items = [
    ['Week 1', 'Log workouts honestly — including RIR. The engine baselines every lift.'],
    ['Weeks 2–3', 'Auto targets tune to your actual rep strength. Expect small load bumps.'],
    ['Week 4', 'First deload checkpoint (if enabled). Volume drops, progress sticks.'],
    ['Day 30+', 'With food + weigh-ins logged, adaptive expenditure starts learning your true TDEE.'],
  ];
  return (
    <div className="t30">
      {items.map(([t, d], i) => (
        <div className="t30-item" key={t}>
          <div className="t30-rail"><div className="t30-dot" />{i < items.length - 1 && <div className="t30-line" />}</div>
          <div className="t30-body"><b>{t}</b><span>{d}</span></div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- live generation --------------------------- */

const prettyMuscle = (id) => (id || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function safeGenerate(f, catalogRows) {
  try {
    return generateProgram({
      goal: f.goal || 'hypertrophy',
      daysPerWeek: f.days_per_week || 4,
      sessionMinutes: Number(f.session_minutes) || 60,
      split: f.split || 'auto',
      experience: f.training_experience || 'intermediate',
      focus: f.focus || [],
      deprioritized: f.deprioritized || [],
      equipmentIds: Object.entries(f.equipment || {}).filter(([, v]) => v.selected).map(([id]) => id),
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
