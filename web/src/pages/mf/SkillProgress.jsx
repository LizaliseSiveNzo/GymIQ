import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { SKILLS } from '../../../../supabase/functions/_shared/calisthenicsSkills.js';

const LEVEL_LABEL = { not_yet: 'Not yet able', learning: 'Currently learning', able: 'Able · improving' };
const isHold = (ex) => /s\b/.test(String(ex.reps || ''));

export default function SkillProgress() {
  const { profile } = useAuth();
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logOpen, setLogOpen] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState('');
  const [logForm, setLogForm] = useState({ sets: '3', reps: '5', difficulty: 'right', controlled: true });

  useEffect(() => {
    let active = true;
    if (!profile?.id) return;
    supabase.from('calisthenics_skill_selections')
      .select('skill_id, level, priority')
      .eq('user_id', profile.id)
      .order('priority')
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError('Could not load your skills.');
        else setSelections(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [profile?.id]);

  async function saveLog(skill, next, action, payload = {}) {
    setBusy(skill.id);
    const { error: err } = await supabase.from('calisthenics_skill_logs').insert({
      user_id: profile.id,
      skill_id: skill.id,
      variation: next.name,
      sets: payload.sets ?? null,
      reps: payload.reps ?? null,
      hold_seconds: payload.hold ?? null,
      difficulty: payload.difficulty ?? null,
      controlled: payload.controlled,
      action,
    });
    setBusy('');
    if (err) { setError('Could not save your log. Connect and try again.'); return false; }
    return true;
  }

  async function onCompleted(skill, next, e) {
    e.preventDefault();
    const ok = await saveLog(skill, next, 'completed', {
      sets: Number(logForm.sets) || null,
      reps: isHold(next) ? null : Number(logForm.reps) || null,
      hold: isHold(next) ? Number(logForm.reps) || null : null,
      difficulty: logForm.difficulty,
      controlled: logForm.controlled,
    });
    if (ok) { setFeedback({ skill_id: skill.id, message: 'Logged. Keep it controlled and repeat before advancing.' }); setLogOpen(null); }
  }

  async function quickLog(skill, next, stage, action) {
    const guidance = {
      too_difficult: `Logged as too hard. Try ${stage.alternatives?.easier ? `the easier option: ${stage.alternatives.easier}` : 'an easier variation'}. Staying here is fine.`,
      too_easy: `Logged as too easy. Try ${stage.alternatives?.harder ? `the harder option: ${stage.alternatives.harder}` : 'a harder variation'}.`,
      equipment_unavailable: `Logged. This movement needs ${skill.equipment.join(' + ')}. Pick a compatible alternative, or skip it until the setup is available.`,
      pain: 'Stop this movement now. Rest and do not push through pain. This is not a diagnosis — see a qualified professional if it persists.',
    };
    const ok = await saveLog(skill, next, action);
    if (ok) setFeedback({ skill_id: skill.id, message: guidance[action] });
  }

  return (
    <TabShell active="more" title="Skills">
      <Link className="btn btn-ghost" to="/workout">← Training</Link>
      {loading ? <p role="status">Loading your skills…</p>
        : error ? <p className="inline-error">{error}</p>
        : !selections.length ? <p className="mf-card">No skills selected yet. Build a calisthenics programme to choose skills.</p>
        : <div className="stack" style={{ gap: 14 }}>
          {selections.map((sel) => {
            const skill = SKILLS[sel.skill_id];
            if (!skill) return null;
            const stageIndex = sel.level === 'not_yet' ? 0 : sel.level === 'learning' ? 2 : 3;
            const stage = skill.pathway[Math.min(stageIndex, skill.pathway.length - 1)];
            const next = stage.exercises[0];
            return (
              <section key={sel.skill_id} className="mf-card">
                <div className="row between"><h2>{skill.name}</h2><span className="badge badge-neutral">{LEVEL_LABEL[sel.level] || sel.level}</span></div>
                <p className="subtle">Current stage: <strong>{stage.name}</strong> — {stage.purpose}</p>
                {next && (
                  <div style={{ marginTop: 8 }}>
                    <p><strong>Next: {next.name}</strong> · {next.sets} × {next.reps}</p>
                    <p className="subtle" style={{ margin: 0 }}>Why: {next.why}</p>
                  </div>
                )}
                <p className="subtle" style={{ marginTop: 8 }}>Advance when: {stage.advancement}</p>
                <div className="launch-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => setLogOpen(logOpen === sel.skill_id ? null : sel.skill_id)}>Log today</button>
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => quickLog(skill, next, stage, 'too_difficult')}>Too hard</button>
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => quickLog(skill, next, stage, 'too_easy')}>Too easy</button>
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => quickLog(skill, next, stage, 'equipment_unavailable')}>No equipment</button>
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => quickLog(skill, next, stage, 'pain')}>Pain</button>
                </div>
                {logOpen === sel.skill_id && next && (
                  <form onSubmit={(e) => onCompleted(skill, next, e)} className="nutrition-form" style={{ marginTop: 12 }}>
                    <div className="nutrition-fields">
                      <label>Sets<input type="number" min="1" max="20" value={logForm.sets} onChange={(e) => setLogForm((f) => ({ ...f, sets: e.target.value }))} /></label>
                      <label>{isHold(next) ? 'Hold (seconds)' : 'Reps'}<input type="number" min="1" max="300" value={logForm.reps} onChange={(e) => setLogForm((f) => ({ ...f, reps: e.target.value }))} /></label>
                      <label>Difficulty<select value={logForm.difficulty} onChange={(e) => setLogForm((f) => ({ ...f, difficulty: e.target.value }))}><option value="too_easy">Too easy</option><option value="right">About right</option><option value="too_hard">Too hard</option></select></label>
                    </div>
                    <label className="nutrition-check"><input type="checkbox" checked={logForm.controlled} onChange={(e) => setLogForm((f) => ({ ...f, controlled: e.target.checked }))} />Movement was controlled</label>
                    <button type="submit" className="btn btn-primary" disabled={!!busy}>{busy === sel.skill_id ? 'Saving…' : 'Save log'}</button>
                  </form>
                )}
                {feedback && feedback.skill_id === sel.skill_id && <p className="inline-error" role="status" style={{ marginTop: 8 }}>{feedback.message}</p>}
                <details style={{ marginTop: 8 }}><summary>Full path</summary>
                  {skill.pathway.map((s, i) => (
                    <div key={s.id} style={{ marginTop: 8 }}>
                      <strong>{i + 1}. {s.name}</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {s.exercises.map((e) => <li key={e.name}>{e.name} — {e.why}</li>)}
                      </ul>
                    </div>
                  ))}
                </details>
              </section>
            );
          })}
        </div>}
    </TabShell>
  );
}
