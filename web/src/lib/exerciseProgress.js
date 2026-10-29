import { e1rm, topVolume } from './engines/prs.js';
export const progressKey = (row) => row.exercise_id || `name:${String(row.exercise_name || '').trim().toLowerCase()}`;
export function buildExerciseProgress(rows = []) {
  const groups = new Map();
  for (const row of [...rows].sort((a,b) => String(b.completed_at).localeCompare(String(a.completed_at)) || String(b.created_at).localeCompare(String(a.created_at)))) {
    if (!row.completed_at || row.completed === false || row.set_type === 'warmup' || row.cancelled_at || row.excluded) continue;
    const right = { weight: Number(row.weight) || 0, reps: Number(row.reps) || 0, side: row.reps_left != null ? 'R' : null, row };
    const left = { weight: Number(row.weight_left) || 0, reps: Number(row.reps_left) || 0, side: 'L', row };
    const candidates = [right, left].filter(s => s.reps > 0 && s.weight >= 0);
    if (!candidates.length) continue;
    const key = progressKey(row);
    let g = groups.get(key);
    if (!g) { g = { key, exerciseId: row.exercise_id, name: row.exercise_name, sessions: [], sets: [], bestWeight: null, bestReps: null, estimatedMax: 0, topVolume: 0 }; groups.set(key, g); }
    g.sets.push(row);
    let session = g.sessions.find(s => s.id === row.log_id);
    if (!session) { session = { id: row.log_id, date: row.completed_at, sets: [] }; g.sessions.push(session); }
    session.sets.push(row);
    for (const c of candidates) {
      if (!g.bestWeight || c.weight > g.bestWeight.weight || (c.weight === g.bestWeight.weight && c.reps > g.bestWeight.reps)) g.bestWeight = c;
      if (!g.bestReps || c.reps > g.bestReps.reps || (c.reps === g.bestReps.reps && c.weight > g.bestReps.weight)) g.bestReps = c;
      g.estimatedMax = Math.max(g.estimatedMax, e1rm(c.weight, c.reps));
    }
    g.topVolume = Math.max(g.topVolume, topVolume(row.weight,row.reps,row.weight_left,row.reps_left));
  }
  for (const g of groups.values()) {
    g.sessions.forEach(s => s.sets.sort((a,b) => a.set_number-b.set_number || String(a.created_at).localeCompare(String(b.created_at))));
    g.last = g.sessions[0];
    g.lastBest = [...g.last.sets].sort((a,b) => (Number(b.weight)||0)-(Number(a.weight)||0) || (Number(b.reps)||0)-(Number(a.reps)||0))[0];
  }
  return [...groups.values()].sort((a,b) => a.name.localeCompare(b.name));
}
export function previousFor(progress, item, rowIndex = 0) {
  const found = progress.find(p => p.key === (item.exerciseId || `name:${String(item.name).trim().toLowerCase()}`));
  if (!found) return null;
  const set = found.last.sets[rowIndex] || found.lastBest;
  return { weight: Number(set.weight) || 0, reps: Number(set.reps) || 0, progress: found };
}
export function setDescription(row) {
  const load = (weight) => Number(weight) > 0 ? `${Number(weight)} kg` : 'Bodyweight';
  const right = `${load(row.weight)} × ${Number(row.reps) || 0}`;
  return row.reps_left != null ? `R ${right} · L ${load(row.weight_left)} × ${Number(row.reps_left) || 0}` : right;
}
