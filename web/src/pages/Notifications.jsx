/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO = [
  { id: 1, message: 'Fixture: U15 vs Rivera FC — Sat 10:00, Home', read: false, created_at: new Date().toISOString() },
  { id: 2, message: 'Coach note: great session today, keep it up!', read: true, created_at: new Date(Date.now()-86400000).toISOString() },
];

export default function Notifications() {
  const { role, session } = useAuth();
  const [items, setItems] = useState(session?.demo ? DEMO : []);

  async function load() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { if (!session?.demo) load(); }, []);

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    load();
  }
  async function markAll() {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    load();
  }

  return (
    <AppShell role={role} active="Notifications" title="Notifications">
      <div className="container" style={{ maxWidth: 680, padding: 0 }}>
        <div className="section-header">
          <h4 style={{ margin: 0 }}>Recent</h4>
          {!session?.demo && <button className="btn btn-secondary" onClick={markAll} style={{ minHeight: 32 }}>Mark all read</button>}
        </div>
        {items.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No notifications yet.</p></div> : (
          <div className="stack" style={{ gap: 10 }}>
            {items.map((n) => (
              <div key={n.id} className="card" style={{ borderLeft: n.read ? '1px solid var(--border)' : '4px solid var(--green-600)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: n.read ? 500 : 700 }}>{n.message}</div>
                  <div className="subtle" style={{ fontSize: 12 }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.read && !session?.demo && <button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => markRead(n.id)}>Mark read</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
