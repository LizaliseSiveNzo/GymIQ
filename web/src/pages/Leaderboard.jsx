/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import RedDust from '../components/RedDust.jsx';
import CategoryLeaders from '../components/CategoryLeaders.jsx';
import Stakeboard from '../components/Stakeboard.jsx';
import SeasonBoard from '../components/SeasonBoard.jsx';

const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const pct = (v) => `${Math.round(v)}%`;
const one = (v) => Number(v).toFixed(1);
const two = (v) => Number(v).toFixed(2);
const intf = (v) => String(Math.round(v));

const METRICS = [
  { key: 'avg_rating', label: 'Match rating', group: 'Overall', fmt: two, unit: 'avg' },
  { key: 'tot_minutes', label: 'Minutes played', group: 'Overall', fmt: intf, unit: 'total' },
  { key: 'tot_goals', label: 'Goals', group: 'Attacking', fmt: intf, unit: 'total' },
  { key: 'avg_goals', label: 'Goals per game', group: 'Attacking', fmt: two, unit: '/game' },
  { key: 'tot_assists', label: 'Assists', group: 'Attacking', fmt: intf, unit: 'total' },
  { key: 'tot_goal_contributions', label: 'Goal contributions', group: 'Attacking', fmt: intf, unit: 'total' },
  { key: 'avg_shots_on_target', label: 'Shots on target', group: 'Attacking', fmt: two, unit: '/game' },
  { key: 'avg_crosses', label: 'Crosses', group: 'Attacking', fmt: two, unit: '/game' },
  { key: 'avg_key_passes', label: 'Key passes', group: 'Passing', fmt: two, unit: '/game' },
  { key: 'pass_accuracy', label: 'Passing accuracy', group: 'Passing', fmt: pct, unit: '' },
  { key: 'avg_ball_carries', label: 'Ball carries', group: 'Ball progression', fmt: two, unit: '/game' },
  { key: 'avg_dribbles', label: 'Dribbles', group: 'Ball progression', fmt: two, unit: '/game' },
  { key: 'avg_def_contributions', label: 'Defensive actions', group: 'Defending', fmt: two, unit: '/game' },
  { key: 'avg_tackles', label: 'Tackles', group: 'Defending', fmt: two, unit: '/game' },
  { key: 'avg_interceptions', label: 'Interceptions', group: 'Defending', fmt: two, unit: '/game' },
  { key: 'avg_recoveries', label: 'Recoveries', group: 'Defending', fmt: two, unit: '/game' },
  { key: 'avg_aerials_won', label: 'Aerial duels won', group: 'Duels & physical', fmt: two, unit: '/game' },
  { key: 'avg_saves', label: 'Saves', group: 'Goalkeeping', fmt: two, unit: '/game' },
  { key: 'tot_clean_sheets', label: 'Clean sheets', group: 'Goalkeeping', fmt: intf, unit: 'total' },
  { key: 'tot_yellow_cards', label: 'Yellow cards', group: 'Discipline', fmt: intf, unit: 'total' },
  { key: 'tot_red_cards', label: 'Red cards', group: 'Discipline', fmt: intf, unit: 'total' },
];
const GROUPS = ['Overall', 'Attacking', 'Passing', 'Ball progression', 'Defending', 'Duels & physical', 'Goalkeeping', 'Discipline'];
const TILES = [
  { key: 'tot_goals', label: 'Top goal scorer', icon: '⚽' },
  { key: 'tot_goal_contributions', label: 'Goal contributions', icon: '🎯' },
  { key: 'pass_accuracy', label: 'Passing accuracy', icon: '🧭' },
  { key: 'tot_clean_sheets', label: 'Clean sheets', icon: '🧤' },
  { key: 'avg_def_contributions', label: 'Defensive actions', icon: '🛡️' },
  { key: 'avg_saves', label: 'Saves', icon: '✋' },
];
const MEDALS = ['🥇', '🥈', '🥉'];

// dark palette (scoped to this page)
const C = { bg: '#000000', card: '#14171F', card2: '#1A1E28', border: '#242A36', text: '#E9ECF3', muted: '#8A93A3', red: '#E4032E', gold: '#F5C518' };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 16 };
const redAvatar = { width: 44, height: 44, borderRadius: '50%', background: C.red, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 };
const rowBox = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 4px', borderBottom: `1px solid ${C.border}` };

export default function Leaderboard() {
  const { role, session } = useAuth();
  const [hl, setHl] = useState(null);
  const [season, setSeason] = useState([]);
  const [stats, setStats] = useState([]);
  const [metricKey, setMetricKey] = useState('avg_rating');
  const [view, setView] = useState('main');

  useEffect(() => {
    if (session?.demo) return;
    supabase.rpc('weekly_highlights').then(({ data }) => setHl(data || {}));
    supabase.rpc('team_leaderboard').then(({ data }) => setSeason(data || []));
    supabase.rpc('stat_leaderboard').then(({ data }) => setStats(data || []));
  }, []);

  const topN = role === 'player' ? 5 : 50;
  const metric = METRICS.find((m) => m.key === metricKey);
  const ranked = [...stats].filter((r) => Number(r[metricKey]) > 0).sort((a, b) => Number(b[metricKey]) - Number(a[metricKey]));
  const topFor = (key) => { const r = [...stats].filter((x) => Number(x[key]) > 0).sort((a, b) => Number(b[key]) - Number(a[key])); return r[0]; };
  const tileItems = TILES.map((t) => { const m = METRICS.find((x) => x.key === t.key); return { ...t, fmt: m.fmt, unit: m.unit }; });
  const statsById = Object.fromEntries(stats.map((x) => [x.player_id, x]));
  const n2 = (v) => Number(v || 0);
  const fameStats = stats.map((x) => ({ ...x, _mvp: x.games >= 3 ? n2(x.avg_rating) : 0, _rising: (x.games >= 1 && x.games <= 6) ? n2(x.avg_rating) : 0 }));
  const fameItems = [
    { key: '_mvp', label: 'All-time MVP', icon: '👑', fmt: two, unit: 'avg' },
    { key: '_rising', label: 'Best upcoming', icon: '⚡', fmt: two, unit: 'avg' },
    { key: 'tot_goals', label: 'All-time top scorer', icon: '⚽', fmt: intf, unit: '' },
    { key: 'tot_goal_contributions', label: 'Most goal contributions', icon: '🎯', fmt: intf, unit: '' },
    { key: 'avg_def_contributions', label: 'Best defender', icon: '🛡️', fmt: two, unit: '/g' },
    { key: 'tot_clean_sheets', label: 'Best keeper', icon: '🧤', fmt: intf, unit: '' },
    { key: 'pass_accuracy', label: 'Most accurate passer', icon: '🧭', fmt: pct, unit: '' },
    { key: 'tot_minutes', label: 'Iron man (minutes)', icon: '⏱️', fmt: intf, unit: '' },
  ];

  const potw = hl?.player_of_week;
  const motm = hl?.motm || [];

  const H = ({ icon, title, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: C.red, fontSize: 18 }}>{icon}</span><strong style={{ fontSize: 17 }}>{title}</strong></div>
      {right}
    </div>
  );

  return (
    <AppShell role={role} active="Leaderboard" title="Leaderboard">
      <style>{`.app .content{background:#000 !important;}`}</style>
      <style>{`@keyframes pageIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ color: C.text }}>

        {view === 'main' ? (<>
        {/* Player of the Week hero */}
        <div onClick={() => setView('fame')} style={{ ...card, background: `radial-gradient(120% 140% at 85% 0%, rgba(228,3,46,.55), rgba(228,3,46,.10) 45%, ${C.card} 75%)`, border: `1px solid ${C.border}`, padding: 22, position: 'relative', overflow: 'hidden', cursor: 'pointer', animation: 'pageIn .5s cubic-bezier(.2,.7,.2,1) both' }}>
          <RedDust />
          <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: C.red, fontWeight: 800, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>♛ Player of the Week</div>
          {potw ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ ...redAvatar, width: 74, height: 74, fontSize: 26 }}>{initials(potw.name)}</span>
                  <div><div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{potw.name}</div>
                    <div style={{ color: C.muted, marginTop: 4 }}>{[potw.team, potw.position].filter(Boolean).join(' · ') || '—'}</div></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{potw.score}</div>
                  <div style={{ color: C.muted, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' }}>Week points</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {[['⚽', `${potw.goals} Goals`], ['🅰', `${potw.assists} Assists`], ['⭐', `${potw.avg_rating} Avg`], ['✅', `${potw.attendance} Sessions`]].map(([ic, t]) => (
                  <span key={t} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600 }}>{ic} {t}</span>
                ))}
                <span style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600 }}>{(potw.rank || 'Rookie').replace('_', ' ')}</span>
              </div>
            </>
          ) : <p style={{ color: C.muted, margin: '10px 0 0' }}>No standout yet this week — log a match and someone gets crowned!</p>}
          <div style={{ marginTop: 14, color: C.red, fontWeight: 800, fontSize: 12, letterSpacing: '.04em' }}>🏛️ Tap for the Hall of Fame ›</div>
          </div>
        </div>

        {/* Man of the Match */}
        <div style={{ ...card, animation: 'pageIn .5s cubic-bezier(.2,.7,.2,1) both', animationDelay: '.08s' }}>
          <H icon="★" title="Man of the Match — Recent Matches" />
          {motm.length === 0 ? <p style={{ color: C.muted, margin: 0 }}>No fixtures yet.</p> : motm.map((m, i) => (
            <div key={i} style={{ ...rowBox, borderBottom: i === motm.length - 1 ? 'none' : rowBox.borderBottom }}>
              <span style={{ color: C.muted, fontSize: 14 }}>vs {m.opponent}{m.date ? ` · ${new Date(m.date).toLocaleDateString()}` : ''}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><strong>{m.player_name || '—'}</strong><span style={{ color: C.gold }}>★</span></span>
            </div>
          ))}
        </div>

        {/* Category leaders */}
        <div style={{ ...card, animation: 'pageIn .5s cubic-bezier(.2,.7,.2,1) both', animationDelay: '.16s' }}>
          <H icon="🏆" title="Category Leaders" />
          <p style={{ color: C.muted, fontSize: 12, margin: '-4px 0 12px' }}>Swipe a category left (or tap) to reveal its top 5.</p>
          <CategoryLeaders items={tileItems} stats={stats} C={C} />
        </div>

        {/* Stakeboard (stat leaderboard) */}
        <div style={{ ...card, animation: 'pageIn .5s cubic-bezier(.2,.7,.2,1) both', animationDelay: '.24s' }}>
          <H icon="🏆" title="Stakeboard" right={role === 'player' ? <span style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '3px 10px', fontSize: 12, color: C.muted }}>Top 5</span> : null} />
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Category</div>
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
            style={{ width: '100%', background: C.card2, color: C.text, border: `1px solid ${C.red}`, borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: 15 }}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {METRICS.filter((m) => m.group === g).map((m) => <option key={m.key} value={m.key} style={{ background: C.card }}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>)}
              </optgroup>
            ))}
          </select>
          {ranked.length === 0 ? <p style={{ color: C.muted, margin: 0 }}>No match stats logged for this category yet.</p> : (
            <Stakeboard rows={ranked.slice(0, topN)} metric={metric} C={C} />
          )}
        </div>

        {/* Season leaderboard */}
        <div style={{ ...card, marginBottom: 0, animation: 'pageIn .5s cubic-bezier(.2,.7,.2,1) both', animationDelay: '.32s' }}>
          <H icon="📊" title="Season Leaderboard" right={role === 'player' ? <span style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '3px 10px', fontSize: 12, color: C.muted }}>Top 5</span> : null} />
          {season.length === 0 ? <p style={{ color: C.muted, margin: 0 }}>Rankings appear once training and matches are logged.</p> : (
            <SeasonBoard season={season} statsById={statsById} C={C} />
          )}
        </div>
        </>) : (
          <>
            <style>{`@keyframes fameIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
            <button type="button" onClick={() => setView('main')} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', marginBottom: 12, animation: 'fameIn .4s ease both' }}>← Back to leaderboard</button>
            <div style={{ ...card, position: 'relative', overflow: 'hidden', background: `radial-gradient(120% 120% at 50% -10%, rgba(228,3,46,.20), ${C.card} 62%)`, animation: 'fameIn .55s cubic-bezier(.2,.7,.2,1) both' }}>
              <RedDust />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}><span style={{ color: C.red, fontSize: 18 }}>🏛️</span><strong style={{ fontSize: 17 }}>Hall of Fame</strong></div>
                <p style={{ color: C.muted, fontSize: 12, margin: '0 0 12px' }}>All-time &amp; standout performers across the academy. Tap a category for its top 5.</p>
                <CategoryLeaders items={fameItems} stats={fameStats} C={C} animateIn />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
