/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

// Client's view — announcements from their trainer(s).
export default function Announcements() {
  const { session, profile } = useAuth();
  const [posts, setPosts] = useState(null);

  useEffect(() => { if (session?.demo || !profile) return; (async () => {
    const { data } = await supabase.from('trainer_announcements')
      .select('*, trainer:trainer_id ( name )')
      .order('created_at', { ascending: false });
    setPosts(data || []);
  })(); }, [profile]);

  if (session?.demo) return <AppShell role="player" active="Announcements" title="Announcements"><div className="card">Demo mode.</div></AppShell>;

  return (
    <AppShell role="player" active="Announcements" title="Announcements">
      {posts === null ? <div className="card"><p className="subtle" style={{ margin: 0 }}>Loading…</p></div>
       : posts.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No announcements yet.</p></div>
       : (
        <div className="stack">
          {posts.map((p) => (
            <div className="card" key={p.id}>
              {p.title && <strong>{p.title}</strong>}
              <div className="subtle" style={{ fontSize: 12 }}>
                {p.trainer?.name ? `${p.trainer.name} · ` : ''}{new Date(p.created_at).toLocaleDateString()}
              </div>
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
