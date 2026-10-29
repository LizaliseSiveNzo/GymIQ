import { supabase } from './supabaseClient.js';
import { previousFor } from './exerciseProgress.js';
export const targetKey = item => item.exerciseId || `name:${String(item.name).trim().toLowerCase()}`;
export async function loadExerciseTargets() {
  const {data,error}=await supabase.from('exercise_targets').select('*').order('exercise_name');
  if(error)throw error;
  return data || [];
}
export function exerciseDefault(progress,targets,item,index=0) {
  const target=targets.find(t=>t.exercise_key===targetKey(item));
  if(target)return {weight:Number(target.weight),reps:Number(target.reps),source:'target',signature:`target:${target.weight}:${target.reps}`};
  const previous=previousFor(progress,item,index);
  if(previous)return {...previous,source:'previous',signature:`previous:${previous.weight}:${previous.reps}`};
  return {weight:'',reps:'',source:'empty',signature:'empty'};
}
