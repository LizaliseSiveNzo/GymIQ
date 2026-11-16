import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { SKILLS } from '../../../../supabase/functions/_shared/calisthenicsSkills.js';

const LEVEL_LABEL = { not_yet: 'Not yet able', learning: 'Currently learning', able: 'Able · improving' };

export default function SkillProgress() {
  const { profile } = useAuth();
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
