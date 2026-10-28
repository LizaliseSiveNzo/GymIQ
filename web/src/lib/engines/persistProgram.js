import { supabase } from '../supabaseClient.js';
// A single database transaction keeps the old programme intact if creation fails.
export async function persistProgram(generated, opts) {
  const { data, error } = await supabase.rpc('save_generated_program', {
    p_generated: generated, p_options: opts, p_request_id: opts.requestId,
  });
  if (error) throw error;
  return data;
}
