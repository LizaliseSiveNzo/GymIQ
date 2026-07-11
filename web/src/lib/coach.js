/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { supabase } from './supabaseClient.js';

export async function myTeams(coachId) {
  const { data } = await supabase.from('teams').select('id,name,division').eq('coach_id', coachId).order('division');
  return data || [];
}

export async function teamPlayers(teamId) {
  const { data } = await supabase.from('players')
    .select('id,position,rank_level,child_code,user_id,users(name)').eq('team_id', teamId);
  return (data || []).map((p) => ({ id: p.id, name: p.users?.name || 'Player', position: p.position, rank: p.rank_level, code: p.child_code }));
}
