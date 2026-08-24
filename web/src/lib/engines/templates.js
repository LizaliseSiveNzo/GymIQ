/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Split templates. A slot is either:
//   { kind: 'pattern', pattern }        → pick by movement pattern
//   { kind: 'muscle',  muscle }         → pick by primary muscle (accessory)
// Days are taken from the pool in order, cycling until daysPerWeek is filled.

export function autoSplit(days) {
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'ppl';
}

const FB_A = [
  { kind: 'pattern', pattern: 'squat' },
  { kind: 'pattern', pattern: 'horizontal_push' },
  { kind: 'pattern', pattern: 'horizontal_pull' },
  { kind: 'pattern', pattern: 'hinge' },
  { kind: 'muscle', muscle: 'abs' },
  { kind: 'muscle', muscle: 'side_delts' },
  { kind: 'muscle', muscle: 'calves' },
];
const FB_B = [
  { kind: 'pattern', pattern: 'hinge' },
  { kind: 'pattern', pattern: 'vertical_push' },
  { kind: 'pattern', pattern: 'vertical_pull' },
  { kind: 'pattern', pattern: 'lunge' },
  { kind: 'muscle', muscle: 'triceps' },
  { kind: 'muscle', muscle: 'abs' },
  { kind: 'muscle', muscle: 'calves' },
];
const FB_C = [
  { kind: 'pattern', pattern: 'squat' },
  { kind: 'pattern', pattern: 'horizontal_push' },
  { kind: 'pattern', pattern: 'horizontal_pull' },
  { kind: 'pattern', pattern: 'lunge' },
  { kind: 'muscle', muscle: 'biceps' },
  { kind: 'muscle', muscle: 'side_delts' },
  { kind: 'muscle', muscle: 'obliques' },
];
const UPPER_A = [
  { kind: 'pattern', pattern: 'horizontal_push' },
  { kind: 'pattern', pattern: 'horizontal_pull' },
  { kind: 'pattern', pattern: 'vertical_push' },
  { kind: 'pattern', pattern: 'vertical_pull' },
  { kind: 'muscle', muscle: 'side_delts' },
  { kind: 'muscle', muscle: 'triceps' },
  { kind: 'muscle', muscle: 'biceps' },
];
const UPPER_B = [
  { kind: 'pattern', pattern: 'vertical_push' },
  { kind: 'pattern', pattern: 'vertical_pull' },
  { kind: 'pattern', pattern: 'horizontal_push' },
  { kind: 'pattern', pattern: 'horizontal_pull' },
  { kind: 'muscle', muscle: 'rear_delts' },
  { kind: 'muscle', muscle: 'biceps' },
  { kind: 'muscle', muscle: 'triceps' },
];
const LOWER_A = [
  { kind: 'pattern', pattern: 'squat' },
  { kind: 'pattern', pattern: 'hinge' },
  { kind: 'pattern', pattern: 'lunge' },
  { kind: 'muscle', muscle: 'quads' },
  { kind: 'muscle', muscle: 'hamstrings' },
  { kind: 'muscle', muscle: 'calves' },
  { kind: 'muscle', muscle: 'abs' },
];
const LOWER_B = [
  { kind: 'pattern', pattern: 'hinge' },
  { kind: 'pattern', pattern: 'squat' },
  { kind: 'pattern', pattern: 'lunge' },
  { kind: 'muscle', muscle: 'glutes' },
  { kind: 'muscle', muscle: 'hamstrings' },
  { kind: 'muscle', muscle: 'calves' },
  { kind: 'muscle', muscle: 'obliques' },
];
const PUSH = [
  { kind: 'pattern', pattern: 'horizontal_push' },
  { kind: 'pattern', pattern: 'vertical_push' },
  { kind: 'pattern', pattern: 'horizontal_push' }, // variant pick (different exercise)
  { kind: 'muscle', muscle: 'side_delts' },
  { kind: 'muscle', muscle: 'triceps' },
  { kind: 'muscle', muscle: 'triceps' },           // second triceps entry
  { kind: 'muscle', muscle: 'forearms' },
];
const PULL = [
  { kind: 'pattern', pattern: 'vertical_pull' },
  { kind: 'pattern', pattern: 'horizontal_pull' },
  { kind: 'pattern', pattern: 'horizontal_pull' }, // variant
  { kind: 'muscle', muscle: 'rear_delts' },
  { kind: 'muscle', muscle: 'biceps' },
  { kind: 'muscle', muscle: 'biceps' },
  { kind: 'muscle', muscle: 'traps' },
];
const LEGS = [
  { kind: 'pattern', pattern: 'squat' },
  { kind: 'pattern', pattern: 'hinge' },
  { kind: 'pattern', pattern: 'lunge' },
  { kind: 'muscle', muscle: 'hamstrings' },
  { kind: 'muscle', muscle: 'glutes' },
  { kind: 'muscle', muscle: 'calves' },
  { kind: 'muscle', muscle: 'abs' },
];

const POOLS = {
  full_body: [FB_A, FB_B, FB_C],
  upper_lower: [UPPER_A, LOWER_A, UPPER_B, LOWER_B],
  ppl: [PUSH, PULL, LEGS],
};

/** Day names per split for labels/subtitles. */
export const DAY_NAMES = {
  full_body: ['Full Body A', 'Full Body B', 'Full Body C'],
  upper_lower: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  ppl: ['Push', 'Pull', 'Legs'],
};

/**
 * @returns [{label:'A', name:'Push', slots:[…]}, …] length === daysPerWeek
 */
export function buildDays(split, daysPerWeek) {
  const pool = POOLS[split] || POOLS.full_body;
  const names = DAY_NAMES[split] || DAY_NAMES.full_body;
  const days = [];
  for (let i = 0; i < daysPerWeek; i++) {
    days.push({
      label: String.fromCharCode(65 + i), // A, B, C…
      name: names[i % names.length],
      slots: pool[i % pool.length],
    });
  }
  return days;
}

/** Session capacity in exercise slots from the time budget. */
export function slotBudget(sessionMinutes) {
  return Math.max(4, Math.min(7, Math.ceil((sessionMinutes || 60) / 13)));
}
