/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

export default function TrialRegister() {
  const { qrToken } = useParams();
  const [trial, setTrial] = useState(undefined); // undefined=loading, null=not found
  const [form, setForm] = useState({ child: '', age: '', position: '', parent: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc('get_trial_by_token', { p_token: qrToken }).then(({ data }) => setTrial(data || null));
  }, [qrToken]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const { data, error } = await supabase.rpc('register_trialist', {
        p_token: qrToken, p_child: form.child, p_age: form.age ? Number(form.age) : null,
        p_position: form.position, p_parent: form.parent, p_phone: form.phone, p_email: form.email,
      });
      if (error) { setErr(error.message); return; }
      if (!data?.ok) { setErr(data?.error || 'Could not register'); return; }
      setDone(true);
    } finally { setBusy(false); }
  }

  const wrap = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 };

  if (trial === undefined) return <div style={wrap}><div className="card">Loading…</div></div>;
  if (trial === null) return <div style={wrap}><div className="card" style={{ maxWidth: 420 }}><h2>Trial not found</h2><p className="subtle" style={{ margin: 0 }}>This registration link is invalid or has expired.</p></div></div>;

  if (done) return (
    <div style={wrap}><div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>✅</div>
      <h2>You're registered!</h2>
      <p className="subtle">Thanks — {trial.org_name || 'the academy'} has received {form.child}'s details. You'll be contacted with the outcome.</p>
    </div></div>
  );

  return (
    <div style={wrap}>
      <div className="card" style={{ maxWidth: 440, width: '100%' }}>
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green-600)' }} />
          <strong style={{ fontFamily: 'var(--font-display)' }}>{trial.org_name || 'PitchIQ'}</strong>
        </div>
        <h2 style={{ marginTop: 4 }}>Trial registration</h2>
        <p className="subtle">{new Date(trial.date).toLocaleDateString()} · {trial.sport}</p>
        <form onSubmit={submit}>
          <div className="field"><label className="label">Child's full name</label>
            <input className="input" value={form.child} onChange={(e) => set('child', e.target.value)} /></div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label className="label">Age</label>
              <input className="input" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} /></div>
            <div className="field"><label className="label">Position</label>
              <input className="input" value={form.position} onChange={(e) => set('position', e.target.value)} /></div>
          </div>
          <div className="field"><label className="label">Parent name</label>
            <input className="input" value={form.parent} onChange={(e) => set('parent', e.target.value)} /></div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className="field"><label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !form.child.trim() || !form.parent.trim()}>
            {busy ? 'Submitting…' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
