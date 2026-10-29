import { supabase } from './supabaseClient.js';
import { buildExerciseProgress } from './exerciseProgress.js';
export async function loadExerciseProgress(isCancelled = () => false) {
  const rows = [];
  for (let offset = 0; !isCancelled(); offset += 500) {
    const { data, error } = await supabase.rpc('exercise_progress_sets', { p_offset: offset, p_limit: 500 });
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return buildExerciseProgress(rows);
}
