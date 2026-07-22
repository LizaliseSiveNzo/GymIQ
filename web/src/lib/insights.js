/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { supabase } from './supabaseClient.js';
import { ATTR_LABEL } from './attributes.js';

// Plain-language coaching insights (item 13).
// Tone rule: these are children. Findings are framed as opportunities,
// never as judgements — "needs support" rather than "is bad".

const DAY = 86400e3;
const pct = (n) => `${Math.round(n)}%`;

function card(tone, icon, title, detail) { return { tone, icon, title, detail }; }

// ---------- one player ----------
export async function playerInsights(playerId, teamId) {
  const since = new Date(Date.now() - 90 * DAY).toISOString();

  const [{ data: hist }, { data: sessions }, { data: att }, { data: stats }, { data: injuries }] = await Promise.all([
    supabase.from('player_attribute_history').select('attribute,rating,recorded_at').eq('player_id', playerId).order('recorded_at'),
    supabase.from('training_sessions').select('id,starts_at,date').eq('team_id', teamId).order('starts_at', { ascending: false, nullsFirst: false }).limit(40),
    supabase.from('attendance').select('session_id,attended').eq('player_id', playerId),
    supabase.from('player_match_stats').select('match_id,minutes_played,rating,goals,assists').eq('player_id', playerId),
    supabase.from('injuries').select('injury_type,resolved_at,expected_return').eq('player_id', playerId).is('resolved_at', null),
  ]);

  const out = [];

  // --- attribute development ---
  const byAttr = {};
  (hist || []).forEach((r) => { (byAttr[r.attribute] = byAttr[r.attribute] || []).push(r); });
  const moves = Object.entries(byAttr)
    .map(([k, list]) => [k, list[list.length - 1].rating - list[0].rating])
    .filter(([, d]) => d !== 0)
    .sort((a, b) => b[1] - a[1]);
  if (moves.length) {
    const [topK, topD] = moves[0];
    if (topD > 0) out.push(card('success', '📈', `${ATTR_LABEL[topK] || topK} is improving`,
      `Up ${topD} point${topD === 1 ? '' : 's'} since the first rating — worth telling them you've noticed.`));
    const [lowK, lowD] = moves[moves.length - 1];
    if (lowD < 0) out.push(card('warning', '🎯', `${ATTR_LABEL[lowK] || lowK} has dipped`,
      `Down ${Math.abs(lowD)} point${Math.abs(lowD) === 1 ? '' : 's'}. Could be a good focus for the next few sessions.`));
  }

  // --- strengths & areas to work on (current ratings) ---
  const current = Object.entries(byAttr).map(([k, l]) => [k, l[l.length - 1].rating]);
  if (current.length >= 3) {
    const sorted = [...current].sort((a, b) => b[1] - a[1]);
    out.push(card('accent', '💪', 'Biggest strengths',
      sorted.slice(0, 3).map(([k, v]) => `${ATTR_LABEL[k] || k} (${v}/5)`).join(', ') + '.'));
    out.push(card('neutral', '🔧', 'Room to grow',
      sorted.slice(-3).reverse().map(([k, v]) => `${ATTR_LABEL[k] || k} (${v}/5)`).join(', ') + '.'));
  }

  // --- attendance trend: last 5 vs previous 5 ---
  const ordered = (sessions || []).filter((s) => s.starts_at || s.date);
  const attMap = Object.fromEntries((att || []).map((a) => [a.session_id, a.attended]));
  const logged = ordered.filter((s) => s.id in attMap);
  if (logged.length >= 4) {
    const recent = logged.slice(0, 5), prior = logged.slice(5, 10);
    const rate = (arr) => arr.length ? arr.filter((s) => attMap[s.id]).length / arr.length * 100 : null;
    const r = rate(recent), p = rate(prior);
    if (p != null && r != null && Math.abs(r - p) >= 20) {
      out.push(r < p
        ? card('warning', '📉', 'Attendance has dropped',
            `${pct(r)} across the last ${recent.length} sessions, down from ${pct(p)}. Might be worth a friendly check-in with the family.`)
        : card('success', '📊', 'Attendance is climbing',
            `${pct(r)} across the last ${recent.length} sessions, up from ${pct(p)}. Good moment to acknowledge the effort.`));
    } else if (r != null && r >= 90) {
      out.push(card('success', '🏅', 'Excellent attendance', `${pct(r)} across recent sessions — very reliable.`));
    }
  }

  // --- playing time ---
  const mins = (stats || []).reduce((n, s) => n + (s.minutes_played || 0), 0);
  const apps = (stats || []).filter((s) => (s.minutes_played || 0) > 0).length;
  if (apps > 0) {
    out.push(card('neutral', '⏱️', 'Playing time',
      `${mins} minutes across ${apps} appearance${apps === 1 ? '' : 's'} (about ${Math.round(mins / apps)} min a game).`));
  }

  // --- injuries ---
  (injuries || []).forEach((i) => out.push(card('danger', '🩹', `Currently out — ${i.injury_type}`,
    i.expected_return ? `Expected back around ${new Date(i.expected_return).toLocaleDateString()}.` : 'No expected return date set yet.')));

  return out;
}

// ---------- whole squad ----------
export async function teamInsights(teamId, squad = []) {
  const [{ data: sessions }, { data: matches }] = await Promise.all([
    supabase.from('training_sessions').select('id,starts_at,date').eq('team_id', teamId).order('starts_at', { ascending: false, nullsFirst: false }).limit(40),
    supabase.from('matches').select('id,date').eq('team_id', teamId),
  ]);
  const sIds = (sessions || []).map((s) => s.id);
  const mIds = (matches || []).map((m) => m.id);

  let att = [], stats = [], hist = [];
  if (sIds.length) {
    const { data } = await supabase.from('attendance').select('session_id,player_id,attended').in('session_id', sIds);
    att = data || [];
  }
  if (mIds.length) {
    const { data } = await supabase.from('player_match_stats').select('player_id,minutes_played').in('match_id', mIds);
    stats = data || [];
  }
  const pIds = squad.map((p) => p.id);
  if (pIds.length) {
    const { data } = await supabase.from('player_attribute_history')
      .select('player_id,attribute,rating,recorded_at').in('player_id', pIds).order('recorded_at');
    hist = data || [];
  }

  const out = [];

  // squad attendance trend
  const recent5 = (sessions || []).slice(0, 5).map((s) => s.id);
  const prior5 = (sessions || []).slice(5, 10).map((s) => s.id);
  const rateFor = (ids) => {
    const rows = att.filter((a) => ids.includes(a.session_id));
    return rows.length ? rows.filter((a) => a.attended).length / rows.length * 100 : null;
  };
  const rNow = rateFor(recent5), rPrev = rateFor(prior5);
  if (rNow != null) {
    if (rPrev != null && Math.abs(rNow - rPrev) >= 15) {
      out.push(rNow < rPrev
        ? card('warning', '📉', 'Squad attendance is slipping', `${pct(rNow)} in the last 5 sessions, down from ${pct(rPrev)}.`)
        : card('success', '📈', 'Squad attendance is improving', `${pct(rNow)} in the last 5 sessions, up from ${pct(rPrev)}.`));
    } else {
      out.push(card('neutral', '📊', 'Squad attendance', `${pct(rNow)} across the last ${recent5.length} sessions.`));
    }
  }

  // players needing attendance support
  const lowAtt = squad.filter((p) => p.rate != null && p.rate < 60);
  if (lowAtt.length) {
    out.push(card('warning', '🤝', `${lowAtt.length} player${lowAtt.length === 1 ? '' : 's'} could use support`,
      `${lowAtt.map((p) => p.name.split(' ')[0]).join(', ')} ${lowAtt.length === 1 ? 'is' : 'are'} below 60% attendance. Often something outside football — worth a quiet conversation.`));
  }

  // playing-time distribution
  if (stats.length) {
    const byPlayer = {};
    stats.forEach((s) => { byPlayer[s.player_id] = (byPlayer[s.player_id] || 0) + (s.minutes_played || 0); });
    const played = squad.filter((p) => byPlayer[p.id] > 0);
    const none = squad.filter((p) => !byPlayer[p.id]);
    if (played.length) {
      const mins = played.map((p) => byPlayer[p.id]);
      const max = Math.max(...mins), min = Math.min(...mins);
      const top = played.find((p) => byPlayer[p.id] === max);
      out.push(card('neutral', '⏱️', 'Playing time spread',
        `${top.name.split(' ')[0]} has the most minutes (${max}); the lowest in the squad is ${min}.`));
    }
    if (none.length) {
      out.push(card('warning', '🪑', `${none.length} player${none.length === 1 ? '' : 's'} yet to feature`,
        `${none.map((p) => p.name.split(' ')[0]).join(', ')} ${none.length === 1 ? 'has' : 'have'} no recorded minutes. Worth planning some game time.`));
    }
  }

  // squad-wide development
  if (hist.length) {
    const byAttr = {};
    hist.forEach((r) => {
      const k = r.attribute;
      byAttr[k] = byAttr[k] || { first: {}, last: {} };
      if (!(r.player_id in byAttr[k].first)) byAttr[k].first[r.player_id] = r.rating;
      byAttr[k].last[r.player_id] = r.rating;
    });
    const deltas = Object.entries(byAttr).map(([k, v]) => {
      const ids = Object.keys(v.last);
      const d = ids.reduce((n, id) => n + (v.last[id] - (v.first[id] ?? v.last[id])), 0) / ids.length;
      return [k, d];
    }).filter(([, d]) => Math.abs(d) >= 0.3).sort((a, b) => b[1] - a[1]);
    if (deltas.length) {
      const [bk, bd] = deltas[0];
      if (bd > 0) out.push(card('success', '🌱', `Squad is improving at ${ATTR_LABEL[bk] || bk}`,
        `Up ${bd.toFixed(1)} on average — whatever you're doing in training is landing.`));
      const [wk, wd] = deltas[deltas.length - 1];
      if (wd < 0) out.push(card('accent', '🎯', `${ATTR_LABEL[wk] || wk} could use a block of work`,
        `Down ${Math.abs(wd).toFixed(1)} on average across the squad — a candidate for the next few sessions.`));
    }
  }

  if (!out.length) {
    out.push(card('neutral', '🌱', 'Not enough data yet',
      'Log a few more sessions, matches and attribute ratings and insights will start appearing here.'));
  }
  return out;
}

export const TONE = {
  success: { border: 'var(--success)', bg: 'transparent' },
  warning: { border: '#f59e0b', bg: 'transparent' },
  danger:  { border: 'var(--danger)', bg: 'transparent' },
  accent:  { border: 'var(--green-600)', bg: 'transparent' },
  neutral: { border: 'var(--border-strong, var(--border))', bg: 'transparent' },
};
