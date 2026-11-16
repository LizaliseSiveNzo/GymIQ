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

function parseReps(reps) {
  const m = String(reps).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { repMin: Number(m[1]), repMax: Number(m[2]) };
  const single = String(reps).match(/(\d+)/);
  return { repMin: single ? Number(single[1]) : 8, repMax: single ? Number(single[1]) : 12 };
}
function parseSets(sets) {
  const m = String(sets).match(/(\d+)/);
  return m ? Number(m[1]) : 3;
}

// Build a `generated` object in the exact shape save_generated_program expects,
// so the existing persist path can save a skill program unchanged.
export function buildSkillGeneratedProgram({ skills = [], equipmentIds = [], daysPerWeek = 3, sessionMinutes = 60, exercises = [], name = 'Calisthenics Skills' }) {
  const plan = generateSkillProgram({ skills, equipmentIds, daysPerWeek, sessionMinutes, exercises });
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const days = plan.days.map((d, i) => {
    const exs = [];
    let sort = 0;
    for (const block of d.blocks) {
      for (const ex of block.exercises) {
        const entry = byName.get(ex.name);
        if (!entry) continue;
        const { repMin, repMax } = parseReps(ex.reps);
        exs.push({
          exerciseId: entry.id,
          name: entry.name,
          sets: parseSets(ex.sets),
          repMin,
          repMax,
          rir: ex.type === 'skill' ? 3 : ex.type === 'strength' ? 2 : 1,
          restSeconds: ex.type === 'skill' ? 120 : ex.type === 'strength' ? 90 : 60,
          pattern: entry.movement_pattern || null,
          sort: sort++,
        });
      }
    }
    return { dayIndex: i, label: String.fromCharCode(65 + i), name: d.blocks.map((b) => b.skill || 'General training').join(' · ') || name, exercises: exs };
  });
  return {
    goal: 'calisthenics',
    split: 'skill',
    daysPerWeek: plan.days.length,
    sessionMinutes: sessionMinutes || 60,
    deloadPolicy: 'auto',
    weeks: Array.from({ length: 8 }, (_, i) => ({ weekNumber: i + 1, kind: (i + 1) % 4 === 0 ? 'deload' : 'accumulate', volumeMultiplier: (i + 1) % 4 === 0 ? 0.5 : 1 })),
    days,
    weeklySets: {},
  };
}
