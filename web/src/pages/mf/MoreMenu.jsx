/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';

function Section({ label, children }) {
  return (
    <div className="list-section">
      <div className="sec-label">{label}</div>
      <div className="list-card">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, chev = true, onClick, soon }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="list-row" onClick={onClick} disabled={soon && !onClick}>
      <span className="ic">{icon}</span>
      <span className="grow">{label}</span>
      {value && <span className="subtle" style={{ fontSize: 13 }}>{value}</span>}
      {soon && !value && <span className="soon">soon</span>}
      {chev && <span className="chev">›</span>}
    </Tag>
  );
}

// MORE — profile, settings, data management (scaffold).
export default function MoreMenu() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [memberSince, setMemberSince] = useState(null);

  useEffect(() => {
    (async () => {
      if (!profile?.id || profile.demo) return;
      const { data } = await supabase.from('users').select('created_at').eq('id', profile.id).single();
      if (data?.created_at) setMemberSince(new Date(data.created_at).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }));
    })();
  }, [profile]);

  const exit = async () => { await logout(); navigate('/login'); };

  return (
    <TabShell active="more" title="More" showKicker={false}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 2px 8px' }}>
        <span className="avatar-lg">{(profile?.name || '?').slice(0, 2).toUpperCase()}</span>
        <div>
          <h4 style={{ margin: 0 }}>{profile?.name || '…'}</h4>
          <div className="subtle" style={{ fontSize: 13 }}>
            {profile?.demo ? 'Demo account' : memberSince ? `Member since ${memberSince}` : ''}
          </div>
        </div>
      </div>

      <Section label="General">
        <Row icon="👤" label="Account" value={profile?.email || ''} />
        <Row icon="⭐" label="Subscription" value="Free (billing post-Phase 7)" />
        <Row icon="🔗" label="Integrations" soon />
        <Row icon="📐" label="Units" value="kg · cm" />
      </Section>

      <Section label="Feature settings">
        <Row icon="▚" label="Dashboard" value="Customize" soon />
        <Row icon="🏋" label="Workout" soon />
        <Row icon="⚡" label="Shortcuts" soon />
        <Row icon="📈" label="Weight trend" soon />
        <Row icon="🏟️" label="Gym profiles" soon />
      </Section>

      <Section label="Theme">
        <div style={{ display: 'flex', gap: 10, padding: '10px 0' }}>
          {['System', 'Light', 'Dark'].map((t) => (
            <div key={t} className="chip" style={{ flex: 1, textAlign: 'center', borderColor: t === 'Dark' ? 'var(--green-500)' : undefined }}>
              {t}
            </div>
          ))}
        </div>
      </Section>

      <Section label="Data management">
        <Row icon="📤" label="Data export" soon />
        <Row icon="🗑️" label="Account & data deletion" soon />
      </Section>

      <Section label="Other">
        <Link className="list-row" to="/privacy"><span className="ic">📜</span><span className="grow">Legal & privacy</span><span className="chev">›</span></Link>
        <Row icon="ℹ️" label="About" value="GymIQ · mf-phase-0" />
        <button className="list-row" onClick={exit} style={{ color: 'var(--danger)' }}>
          <span className="ic">↩</span><span className="grow">Sign out</span>
        </button>
      </Section>
    </TabShell>
  );
}
