import { SKILLS, GENERAL_TRAINING } from './calisthenicsSkills.js';

// Deterministic skill-program generator. No LLM involved.
// Resolves selected skills → practice exercises by level, filters by equipment,
// distributes skills across the training week, and keeps balanced general work.

export function resolveSkillPractice(skills, exercisesByName) {
  const out = [];
  for (const s of skills) {
    const skill = SKILLS[s.id];
    if (!skill || skill.status !== 'reviewed') continue;
    const stages = skill.pathway;
    const idx = s.level === 'not_yet' ? [0, 1] : s.level === 'learning' ? [1, 2] : [3, 0];
    const exs = [];
    for (const i of idx) {
      for (const ex of stages[i].exercises) {
        if (exercisesByName.has(ex.name)) exs.push({ ...ex, skill: skill.id, skillName: skill.name, stage: stages[i].name });
      }
    }
    if (exs.length) out.push({ skill: skill.id, skillName: skill.name, equipment: skill.equipment, exercises: exs });
  }
  return out;
}

export function generateSkillProgram({ skills = [], equipmentIds = [], daysPerWeek = 3, sessionMinutes = 60, exercises = [] }) {
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const available = new Set(equipmentIds);
  const practice = resolveSkillPractice(skills, byName)
    .filter((p) => p.equipment.every((eq) => eq === 'bodyweight' || available.has(eq)));
  const dayCount = Math.min(6, Math.max(2, daysPerWeek || 3));
  const general = GENERAL_TRAINING.map((n) => byName.get(n)).filter(Boolean);

  const days = [];
  for (let d = 0; d < dayCount; d++) {
    // Round-robin by priority order: fewer skills → practised more often.
    const selected = practice.filter((_, i) => (d + i) % Math.max(1, practice.length) === 0);
    const blocks = [];
    for (const p of selected) {
      blocks.push({ role: 'skill', skill: p.skillName, exercises: p.exercises });
    }
    const g = general[d % general.length];
    if (g) blocks.push({ role: 'general', exercises: [{ name: g.name, why: 'Keeps the rest of your training balanced.', type: 'general', sets: '3', reps: '8–15' }] });
    days.push({ day: d + 1, blocks });
  }
  return { days, skillCount: practice.length, missingSkills: skills.filter((s) => !practice.some((p) => p.skill === s.id)).map((s) => s.id), timeBudget: sessionMinutes };
}
