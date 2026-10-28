/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Calorie Bank maths. All on-device; the DB just stores the results + ledger.

export const ACTIVITY = [
  { key: 'sedentary', label: 'Sedentary (little/no exercise)', mult: 1.2 },
  { key: 'light', label: 'Light (1–3 days/week)', mult: 1.375 },
  { key: 'moderate', label: 'Moderate (3–5 days/week)', mult: 1.55 },
  { key: 'active', label: 'Active (6–7 days/week)', mult: 1.725 },
  { key: 'very_active', label: 'Very active (hard training/physical job)', mult: 1.9 },
];
const MULT = Object.fromEntries(ACTIVITY.map((a) => [a.key, a.mult]));

const KCAL_PER_KG = 7700; // approx energy in 1 kg of body mass

// Mifflin–St Jeor BMR, TDEE, and a goal-adjusted daily calorie target.
export function computeTargets({ sex, age, height_cm, weight_kg, goal_weight_kg, activity_level, rate_kg_per_week }) {
  const w = Number(weight_kg), h = Number(height_cm), a = Number(age);
  if (!w || !h || !a) return { bmr: null, tdee: null, dailyTarget: null };
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'female' ? -161 : 5);
  const tdee = bmr * (MULT[activity_level] || 1.55);
  const goal = Number(goal_weight_kg) || w;
  const rate = Number(rate_kg_per_week) || 0;
  const dailyDelta = (rate * KCAL_PER_KG) / 7; // magnitude
  let target = tdee;
  if (goal < w) target = tdee - dailyDelta;      // cut
  else if (goal > w) target = tdee + dailyDelta; // bulk
  target = Math.max(1200, target);               // safety floor
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), dailyTarget: Math.round(target) };
}

export function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
export const monthlyAllowance = (dailyTarget, d = new Date()) => Math.round((dailyTarget || 0) * daysInMonth(d));

// METs for quick exercise → calories. kcal = MET × kg × hours.
export const METS = [
  { key: 'Walking', met: 3.5 }, { key: 'Running', met: 9.8 }, { key: 'Cycling', met: 7.5 },
  { key: 'Swimming', met: 8.0 }, { key: 'Weightlifting', met: 5.0 }, { key: 'HIIT', met: 8.0 },
  { key: 'Rowing', met: 7.0 }, { key: 'Elliptical', met: 5.0 }, { key: 'Jump Rope', met: 11.0 },
  { key: 'Yoga', met: 3.0 },
];
export function exerciseKcal(activityKey, minutes, weightKg) {
  const m = METS.find((x) => x.key === activityKey);
  if (!m || !minutes || !weightKg) return 0;
  return Math.round(m.met * Number(weightKg) * (Number(minutes) / 60));
}
