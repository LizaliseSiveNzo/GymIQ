/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import RankBadge from '../components/RankBadge.jsx';
import StatCard from '../components/StatCard.jsx';
import InjuryTracker from '../components/InjuryTracker.jsx';
import MatchLog from '../components/MatchLog.jsx';
import DevelopmentPlan from '../components/DevelopmentPlan.jsx';
import AttributeProgress from '../components/AttributeProgress.jsx';
import { tagColour } from '../lib/noteTags.js';
import PlayerUploads from '../components/PlayerUploads.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import CoachCalendar from '../components/CoachCalendar.jsx';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const RANKS = ['Rookie', 'Rising_Star', 'Elite', 'Master', 'Grand_Master'];
const NEXT = { Rookie: 'Rising Star', Rising_Star: 'Elite', Elite: 'Master', Master: 'Grand Master', Grand_Master: 'Grand Master' };
const initials = (n = '') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const DEMO = { name: 'Thabo Mokoena', position: 'Winger', team: 'U15', rank: 'Elite', progress: 62,
  attendance_pct: 92, minutes: 840, avg_rating: 4.4 };
const DEMO_NOTES = [
  { id: 1, note: 'Great pressing today. Keep working on your first touch — 10 min of wall passes a day.', created_at: new Date(Date.now() - 86400e3).toISOString() },
  { id: 2, note: 'Man of the match vs Rivera FC. Composure in the box has improved a lot.', created_at: new Date(Date.now() - 5 * 86400e3).toISOString() },
];
const DEMO_MEAL = 'Breakfast: oats + banana\nPre-training: fruit + water\nDinner: chicken, brown rice, veg';
const DEMO_SUMMARY = "Thabo's pace on the wing is creating real chances — three assists this month. Focus area: tracking back on defence. Home tip: 10 minutes of shuttle runs, 3× a week.";

export default function PlayerProfile() {
  const { session, profile } = useAuth();
  const [ov, setOv] = useState(session?.demo ? DEMO : null);
  const [loading, setLoading] = useState(!session?.demo);

  const [notes, setNotes] = useState(session?.demo ? DEMO_NOTES : []);
  const [mealPlan, setMealPlan] = useState(session?.demo ? DEMO_MEAL : '');

  const [ai, setAi] = useState(session?.demo ? DEMO_SUMMARY : '');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const [code, setCode] = useState(session?.demo ? 'PIQ-DEMO' : '');
  const [myPlayerId, setMyPlayerId] = useState('');

  useEffect(() => {
    if (session?.demo) return;
    supabase.rpc('my_player_overview').then(({ data }) => { setOv(data); setLoading(false); });
    supabase.rpc('my_player_code').then(({ data }) => { setCode(data?.[0]?.child_code || ''); });
    if (profile?.id) supabase.from('players').select('id').eq('user_id', profile.id).maybeSingle()
      .then(({ data }) => setMyPlayerId(data?.id || ''));
    supabase.from('coach_player_notes')
      .select('id,note,diet_plan,tag,created_at')
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => {
        setNotes((data || []).filter((n) => n.note));
        setMealPlan((data || []).find((n) => n.diet_plan)?.diet_plan || '');
      });
  }, []);

  async function generate() {
    if (session?.demo) return;
    setAiBusy(true); setAiErr(''); setAi('');
    try {
      const { data, error } = await supabase.functions.invoke('player-summary', { body: {} });
      if (error) {
        let msg = error.message;
        try { const b = await error.context.json(); if (b?.error) msg = b.error; } catch (_e) {}
        setAiErr(msg); return;
      }
      setAi(data?.summary || 'No summary returned.');
    } catch (e) { setAiErr(String(e)); }
    finally { setAiBusy(false); }
  }

  if (loading) return <AppShell role="player" active="My Profile" title="My Profile"><div className="card">Loading…</div></AppShell>;
  if (!ov) return (
    <AppShell role="player" active="My Profile" title="My Profile">
      <div className="card"><h3>No player profile linked</h3>
        <p className="subtle" style={{ margin: 0 }}>This account isn’t linked to a player yet. Ask your academy admin.</p></div>
    </AppShell>
  );

  const rank = ov.rank || 'Rookie';
  return (
    <AppShell role="player" active="My Profile" title="My Profile">
      <div className="container" style={{ maxWidth: 640, padding: 0 }}>
        <div className="card">
          <div className="row between">
            <div className="row">
              <span className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(ov.name)}</span>
              <div>
                <h3 style={{ margin: 0 }}>{ov.name}</h3>
                <div className="subtle">{[ov.team, ov.position].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>
            <RankBadge level={rank} />
          </div>

          <div className="progress energy" style={{ margin: '18px 0 6px' }}>
            <span style={{ width: `${ov.progress || 0}%` }} />
          </div>
          <div className="subtle" style={{ fontSize: 13 }}>
            {rank === 'Grand_Master' ? 'Top rank reached! 🏆' : `${ov.progress || 0}% to ${NEXT[rank]}`}
          </div>

          <div className="ladder" style={{ marginTop: 14 }}>
            {RANKS.map((r) => (
              <div key={r} className={`step ${r === rank ? 'active' : ''}`}>{r.replace('_', ' ')}</div>
            ))}
          </div>

          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <StatCard label="Attendance" value={`${ov.attendance_pct ?? 0}%`} />
            <StatCard label="Minutes" value={ov.minutes ?? 0} />
            <StatCard label="Avg rating" value={ov.avg_rating ?? '—'} />
          </div>

          {!session?.demo && <div style={{ marginTop: 18 }}><CoachCalendar mode="player" /></div>}

          {code && (
            <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0, textAlign: 'center' }}>
              <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                ✅ Practice Check-in Code
              </strong>
              <div style={{ background: '#fff', display: 'inline-block', padding: 12, borderRadius: 12, marginTop: 12 }}>
                <QRCodeSVG value={code} size={168} includeMargin={false} />
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 20, fontWeight: 800, letterSpacing: '.06em' }}>{code}</p>
              <p className="subtle" style={{ margin: '4px 0 0', fontSize: 13 }}>Show this to your coach to check in at practice. No phone? Give them the code.</p>
            </div>
          )}

          <PlayerCard />

          <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0 }}>
            <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              🥗 Meal Plan
            </strong>
            {mealPlan
              ? <p style={{ margin: '10px 0 0', whiteSpace: 'pre-line' }}>{mealPlan}</p>
              : <p className="subtle" style={{ margin: '10px 0 0' }}>No meal plan from your coach yet.</p>}
          </div>

          <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0 }}>
            <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              📝 Coach Notes
            </strong>
            {notes.length === 0
              ? <p className="subtle" style={{ margin: '10px 0 0' }}>No notes from your coach yet.</p>
              : notes.map((n) => (
                <div key={n.id} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div className="row between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <span className="badge" style={{ background: tagColour(n.tag || 'General'), color: '#fff' }}>{n.tag || 'General'}</span>
                    <span className="subtle" style={{ fontSize: 12 }}>{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{ margin: 0 }}>{n.note}</p>
                </div>
              ))}
          </div>

          {myPlayerId && <DevelopmentPlan playerId={myPlayerId} canEdit={false} />}

          {myPlayerId && <AttributeProgress playerId={myPlayerId} />}

          <MatchLog />

          <PlayerUploads />

          {myPlayerId && <InjuryTracker playerId={myPlayerId} canEdit={false} />}

          <div className="card" style={{ marginTop: 18, background: 'var(--surface-2)', border: 0 }}>
            <div className="row between">
              <strong style={{ color: 'var(--green-700)', fontSize: 13, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                AI Summary — Last 30 Days
              </strong>
              <button className="btn btn-secondary" style={{ minHeight: 32, padding: '6px 12px' }}
                onClick={generate} disabled={aiBusy || session?.demo}>
                {aiBusy ? 'Generating…' : (ai ? 'Regenerate' : 'Generate')}
              </button>
            </div>
            {aiErr && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '10px 0 0' }}>{aiErr}</p>}
            {ai
              ? <p style={{ margin: '10px 0 0' }}>{ai}</p>
              : !aiErr && <p className="subtle" style={{ margin: '10px 0 0' }}>Tap Generate for an AI performance summary powered by Claude.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
