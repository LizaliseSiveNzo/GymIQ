/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO = [
  { id: 1, title: 'Practice moved to 17:00 on Thursday', body: 'Main pitch is being re-lined. Same place, one hour later.', created_at: new Date(Date.now() - 3600e3).toISOString() },
  { id: 2, title: 'Bring water bottles + shin pads', body: null, created_at: new Date(Date.now() - 2 * 86400e3).toISOString() },
];
const isImage = (m) => (m || '').startsWith('image/');
const isVideo = (m) => (m || '').startsWith('video/');

export default function Announcements() {
  const { role, session } = useAuth();
  const [items, setItems] = useState(session?.demo ? DEMO : []);
  const [loading, setLoading] = useState(!session?.demo);
  const [urls, setUrls] = useState({});   // announcement id -> signed url

  useEffect(() => { if (session?.demo) return; (async () => {
    const { data } = await supabase.rpc('my_announcements');
    setItems(data || []); setLoading(false);
    // sign attachment urls
    const withFiles = (data || []).filter((a) => a.file_path);
    const map = {};
    for (const a of withFiles) {
      const { data: s } = await supabase.storage.from('announcement-files').createSignedUrl(a.file_path, 3600);
      if (s?.signedUrl) map[a.id] = s.signedUrl;
    }
    setUrls(map);
  })(); }, []);

  return (
    <AppShell role={role} active="Announcements" title="Announcements">
      <div className="container" style={{ maxWidth: 680, padding: 0 }}>
        {loading ? <div className="card">Loading…</div> :
         items.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No announcements from your coach yet.</p></div> : (
          <div className="stack" style={{ gap: 12 }}>
            {items.map((a) => (
              <div key={a.id} className="card">
                <strong>{a.pinned ? '📌 ' : '📣 '}{a.title || (a.file_name ? a.file_name : 'Announcement')}</strong>
                {a.body && <p style={{ margin: '6px 0 0' }}>{a.body}</p>}
                {a.file_path && urls[a.id] && (
                  <div style={{ marginTop: 10 }}>
                    {isImage(a.mime) ? <img src={urls[a.id]} alt={a.file_name} style={{ maxWidth: '100%', borderRadius: 10 }} />
                     : isVideo(a.mime) ? <video src={urls[a.id]} controls playsInline style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 360 }} />
                     : <a className="btn btn-secondary" href={urls[a.id]} target="_blank" rel="noreferrer" style={{ minHeight: 34 }}>📎 Open {a.file_name}</a>}
                  </div>
                )}
                <div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>{a.coach_name ? `${a.coach_name} · ` : ''}{new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
