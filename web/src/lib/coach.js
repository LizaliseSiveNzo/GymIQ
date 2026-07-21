/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { supabase } from './supabaseClient.js';

export async function myTeams(coachId) {
  const { data } = await supabase.from('teams').select('id,name,division').eq('coach_id', coachId).order('division');
  return data || [];
}

export async function teamPlayers(teamId) {
  const { data } = await supabase.from('players')
    .select('id,position,rank_level,child_code,user_id,benched,bench_reason,shirt_number,users(name)').eq('team_id', teamId);
  return (data || []).map((p) => ({
    id: p.id, name: p.users?.name || 'Player', position: p.position, rank: p.rank_level,
    code: p.child_code, benched: p.benched, benchReason: p.bench_reason, shirt: p.shirt_number,
  }));
}

// Squad enriched with attendance %, avg rating, minutes, goals, assists.
// Shared by the coach dashboard and the Squad page so both always agree.
export async function squadWithStats(teamId) {
  const players = await teamPlayers(teamId);
  const [{ data: sessions }, { data: matches }] = await Promise.all([
    supabase.from('training_sessions').select('id').eq('team_id', teamId),
    supabase.from('matches').select('id').eq('team_id', teamId),
  ]);
  const sIds = (sessions || []).map((s) => s.id);
  const mIds = (matches || []).map((m) => m.id);
  const total = sIds.length;

  let att = [], stats = [];
  if (sIds.length) {
    const { data } = await supabase.from('attendance').select('player_id,attended').in('session_id', sIds);
    att = data || [];
  }
  if (mIds.length) {
    const { data } = await supabase.from('player_match_stats')
      .select('player_id,minutes_played,rating,goals,assists').in('match_id', mIds);
    stats = data || [];
  }

  return players.map((p) => {
    const a = att.filter((x) => x.player_id === p.id);
    const rate = total ? Math.round(a.filter((x) => x.attended).length / total * 100) : null;
    const st = stats.filter((x) => x.player_id === p.id);
    const rated = st.filter((x) => x.rating != null);
    return {
      ...p,
      sessions: total,
      rate,
      avg: rated.length ? (rated.reduce((n, x) => n + Number(x.rating), 0) / rated.length).toFixed(1) : null,
      minutes: st.reduce((n, x) => n + (x.minutes_played || 0), 0),
      goals: st.reduce((n, x) => n + (x.goals || 0), 0),
      assists: st.reduce((n, x) => n + (x.assists || 0), 0),
    };
  });
}
