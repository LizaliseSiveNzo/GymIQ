import { describe, it, expect } from 'vitest';
import { SKILLS, SKILL_CONTENT_VERSION } from '../../../../supabase/functions/_shared/calisthenicsSkills.js';
import { generateSkillProgram, resolveSkillPractice } from '../../../../supabase/functions/_shared/skillGenerator.js';

const exercises = [
  { id: 'a', name: 'Bodyweight Pull-Up', equipment_ids: ['pull_up_bar'] },
  { id: 'b', name: 'Chest-to-Bar Pull-Up', equipment_ids: ['pull_up_bar'] },
  { id: 'c', name: 'Explosive High Pull-Up', equipment_ids: ['pull_up_bar'] },
  { id: 'd', name: 'False-Grip Pull-Up', equipment_ids: ['pull_up_bar'] },
  { id: 'e', name: 'Negative Muscle-Up', equipment_ids: ['pull_up_bar'] },
  { id: 'f', name: 'Muscle-Up', equipment_ids: ['pull_up_bar'] },
  { id: 'g', name: 'Parallel Bar Chest Dips', equipment_ids: ['dip_bars'] },
  { id: 'h', name: 'Bench Dip', equipment_ids: ['flat_bench'] },
  { id: 'i', name: 'Bodyweight Squat', equipment_ids: ['bodyweight'] },
  { id: 'j', name: 'Bodyweight Lunge', equipment_ids: ['bodyweight'] },
  { id: 'k', name: 'Glute Bridge', equipment_ids: ['bodyweight'] },
  { id: 'l', name: 'Bodyweight Push-Up', equipment_ids: ['bodyweight'] },
  { id: 'm', name: 'Inverted Row', equipment_ids: ['pull_up_bar'] },
  { id: 'n', name: 'Plank Hold', equipment_ids: ['bodyweight'] },
];

describe('calisthenics skill content', () => {
  it('is versioned', () => {
    expect(SKILL_CONTENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}-v\d+$/);
  });
  it('distinguishes bar and ring muscle-ups', () => {
    expect(SKILLS.muscle_up_bar.equipment).toEqual(['pull_up_bar']);
    expect(SKILLS.muscle_up_ring.equipment).toEqual(['gymnastic_rings']);
    expect(SKILLS.muscle_up_bar.pathway[0].exercises.map(e => e.name)).not.toContain('Ring Muscle-Up');
  });
  it('flags ring muscle-up content for review', () => {
    expect(SKILLS.muscle_up_ring.status).toBe('content_review');
  });
  it('gives every skill exercise a reason', () => {
    for (const stage of SKILLS.muscle_up_bar.pathway) {
      for (const ex of stage.exercises) expect(ex.why).toBeTruthy();
    }
  });
});

describe('skill program generation', () => {
  it('starts a beginner at pull capacity, not the skill', () => {
    const plan = generateSkillProgram({ skills: [{ id: 'muscle_up_bar', level: 'not_yet', priority: 1 }], equipmentIds: ['pull_up_bar', 'dip_bars', 'bodyweight'], exercises });
    const names = plan.days[0].blocks.flatMap(b => b.exercises.map(e => e.name));
    expect(names).toContain('Chest-to-Bar Pull-Up');
    expect(names).not.toContain('Muscle-Up');
  });
  it('lets an able user practise the skill itself', () => {
    const plan = generateSkillProgram({ skills: [{ id: 'muscle_up_bar', level: 'able', priority: 1 }], equipmentIds: ['pull_up_bar', 'dip_bars', 'bodyweight'], exercises });
    const names = plan.days[0].blocks.flatMap(b => b.exercises.map(e => e.name));
    expect(names).toContain('Muscle-Up');
  });
  it('excludes unavailable equipment', () => {
    const plan = generateSkillProgram({ skills: [{ id: 'muscle_up_bar', level: 'not_yet', priority: 1 }], equipmentIds: ['bodyweight'], exercises });
    expect(plan.missingSkills).toContain('muscle_up_bar');
  });
  it('keeps balanced general training', () => {
    const plan = generateSkillProgram({ skills: [{ id: 'muscle_up_bar', level: 'not_yet', priority: 1 }], equipmentIds: ['pull_up_bar', 'dip_bars', 'bodyweight'], exercises });
    const allNames = plan.days.flatMap(d => d.blocks.flatMap(b => b.exercises.map(e => e.name)));
    expect(allNames).toContain('Bodyweight Squat');
  });
  it('distributes multiple skills across the week', () => {
    const skills = [
      { id: 'muscle_up_bar', level: 'not_yet', priority: 1 },
      { id: 'muscle_up_ring', level: 'not_yet', priority: 2 },
    ];
    // Ring is content_review, so only bar resolves; ring should be missing/not practised.
    const plan = generateSkillProgram({ skills, equipmentIds: ['pull_up_bar', 'dip_bars', 'bodyweight'], exercises });
    expect(plan.skillCount).toBe(1);
    expect(plan.missingSkills).toContain('muscle_up_ring');
  });
});
