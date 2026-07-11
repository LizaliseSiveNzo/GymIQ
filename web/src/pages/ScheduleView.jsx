/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO = [
  { key: 'p1', kind: 'practice', rawId: '1', type: 'Practice', title: 'Fitness + set pieces', when: new Date(Date.now() + 1 * 86400000).toISOString(), where: 'Main Pitch' },
  { key: 'm1', kind: 'match', rawId: '2', type: 'Match', title: 'vs Rivera FC', when: new Date(Date.now() + 2 * 86400000).toISOString(), where: 'Home' },
];

export default function ScheduleView() {
  const { role, session } = useAuth();
  const [items, setItems] = useState(session?.demo ? DEMO : []);
  const [teamName, setTeamName] = useState(session?.demo ? 'U15' : '');
  const [playerId, setPlayerId] = useState(null);
  const [rsvps, setRsvps] = useState({}); // 'kind:rawId' -> {status, reason}
  const [busyKey, setBusyKey] = useState('');

  useEffect(() => { if (session?.demo) return; (async () => {
    const { data: teams } = await supabase.from('teams').select('id,name');
    setTeamName(teams?.[0]?.name || '');
    const nowIso = new Date().toISOString();
    const [{ data: matches }, { data: practices }, { data: me }] = await Promise.all([
      supabase.from('matches').select('id,opponent,date,venue').gte('date', nowIso),
      supabase.from('training_sessions').select('id,starts_at,location,notes').not('starts_at', 'is', null).gte('starts_at', nowIso),
      supabase.from('players').select('id').eq('user_id', session.user.id).limit(1),
    ]);
    const merged = [
      ...(matches || []).map((m) => ({ key: 'm' + m.id, kind: 'match', rawId: m.id, type: 'Match', title: `vs ${m.opponent}`, when: m.date, where: m.venue })),
      ...(practices || []).map((p) => ({ key: 'p' + p.id, kind: 'practice', rawId: p.id, type: 'Practice', title: p.notes || 'Training', when: p.starts_at, where: p.location })),
    ].sort((a, b) => new Date(a.when) - new Date(b.when));
    setItems(merged);
    const pid = me?.[0]?.id;
    if (pid) {
      setPlayerId(pid);
      const { data: r } = await supabase.from('event_rsvps')
        .select('event_type,event_id,status,reason').eq('player_id', pid);
      const map = {};
      (r || []).forEach((x) => { map[`${x.event_type}:${x.event_id}`] = { status: x.status, reason: x.reason }; });
      setRsvps(map);
    }
  })(); }, []);

  async function setRsvp(it, status) {
    if (!playerId) return;
    let reason = null;
    if (status === 'absent') {
      reason = window.prompt('Let the coach know why (optional):', rsvps[`${it.kind}:${it.rawId}`]?.reason || '') ;
      if (reason === null) return; // cancelled
      reason = reason.trim() || null;
    }
    setBusyKey(it.key);
    try {
      await supabase.from('event_rsvps').upsert(
        { player_id: playerId, event_type: it.kind, event_id: it.rawId, status, reason, updated_at: new Date().toISOString() },
        { onConflict: 'player_id,event_type,event_id' },
      );
      setRsvps((m) => ({ ...m, [`${it.kind}:${it.rawId}`]: { status, reason } }));
    } finally { setBusyKey(''); }
  }

  const canRsvp = !session?.demo && !!playerId;

  return (
    <AppShell role={role} active="Schedule" title="Schedule">
      <div className="container" style={{ maxWidth: 680, padding: 0 }}>
        <div className="section-header"><h4 style={{ margin: 0 }}>Upcoming {teamName && `— ${teamName}`}</h4></div>
        {items.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>Nothing scheduled yet.</p></div> : (
          <div className="stack" style={{ gap: 10 }}>
            {items.map((it) => {
              const r = rsvps[`${it.kind}:${it.rawId}`];
              return (
                <div key={it.key} className="card">
                  <div className="row between">
                    <div><strong>{it.title}</strong>
                      <div className="subtle" style={{ fontSize: 13 }}>{new Date(it.when).toLocaleString()}{it.where ? ` · ${it.where}` : ''}</div></div>
                    <span className={`badge ${it.type === 'Match' ? 'badge-info' : 'badge-success'}`}>{it.type}</span>
                  </div>
                  {canRsvp && (
                    <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button className={`btn ${r?.status === 'going' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ minHeight: 34, padding: '6px 14px' }} disabled={busyKey === it.key}
                        onClick={() => setRsvp(it, 'going')}>✓ Going</button>
                      <button className={`btn ${r?.status === 'absent' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ minHeight: 34, padding: '6px 14px' }} disabled={busyKey === it.key}
                        onClick={() => setRsvp(it, 'absent')}>✗ Can't make it</button>
                      {r?.status === 'absent' && r?.reason && <span className="subtle" style={{ fontSize: 12, alignSelf: 'center' }}>Reason sent: {r.reason}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
