/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import AppShell from '../components/AppShell.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const chip = { accepted: 'chip-accepted', declined: 'chip-declined', pending: 'chip-pending' };
const token = () => 'TR-' + Math.random().toString(36).slice(2, 10).toUpperCase();

function Registrations({ trialId }) {
  const [regs, setRegs] = useState([]);
  const [msg, setMsg] = useState('');
  async function load() {
    const { data } = await supabase.from('trial_registrations').select('*').eq('trial_id', trialId).order('created_at');
    setRegs(data || []);
  }
  useEffect(() => { load(); }, [trialId]);

  async function setOutcome(id, outcome) {
    const { data } = await supabase.rpc('set_trial_outcome', { p_reg: id, p_outcome: outcome, p_notes: null });
    if (data?.ok) setMsg(data.notified ? 'Parent notified in-app.' : 'Outcome saved.');
    load();
  }

  if (regs.length === 0) return <p className="subtle" style={{ margin: '8px 0 0' }}>No registrations yet.</p>;
  return (
    <>
      {msg && <p style={{ color: 'var(--green-700)', fontSize: 13 }}>{msg}</p>}
      <table className="table" style={{ marginTop: 8 }}>
        <thead><tr><th>Child</th><th>Age</th><th>Position</th><th>Parent</th><th>Phone</th><th>Outcome</th></tr></thead>
        <tbody>{regs.map((r) => (
          <tr key={r.id}>
            <td>{r.child_name}</td><td>{r.child_age ?? '—'}</td><td>{r.position || '—'}</td>
            <td>{r.parent_name}</td><td>{r.parent_phone || '—'}</td>
            <td>
              <select className="select" style={{ minHeight: 32, padding: '4px 8px' }} value={r.outcome}
                onChange={(e) => setOutcome(r.id, e.target.value)}>
                {['pending','accepted','declined'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

export default function AdminTrials() {
  const { profile, session } = useAuth();
  const [trials, setTrials] = useState([]);
  const [date, setDate] = useState('');
  const [sport, setSport] = useState('soccer');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  async function load() {
    const { data } = await supabase.from('trials').select('id,date,sport,qr_token').order('date', { ascending: false });
    setTrials(data || []);
  }
  useEffect(() => { if (!session?.demo) load(); }, []);

  async function addTrial(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const { error } = await supabase.from('trials').insert({ org_id: profile?.org_id, date, sport, qr_token: token() });
      if (error) { setErr(error.message); return; }
      setDate(''); await load();
    } finally { setBusy(false); }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const noOrg = !session?.demo && profile && !profile.org_id;

  return (
    <AppShell role="admin" active="Trials" title="Trials">
      {session?.demo && <div className="badge badge-success" style={{ marginBottom: 16 }}>Demo mode — sign in with a real admin to create trials</div>}
      {noOrg && <div className="card" style={{ marginBottom: 16 }}>Create your academy on the Dashboard first.</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h4>Create a trial day</h4>
        <form onSubmit={addTrial} className="row" style={{ gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0 }}><label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">Sport</label>
            <select className="select" value={sport} onChange={(e) => setSport(e.target.value)}>
              {['soccer','rugby','cricket','chess'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <button className="btn btn-primary" disabled={busy || !date || noOrg}>{busy ? 'Creating…' : 'Create trial'}</button>
        </form>
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{err}</p>}
      </div>

      {trials.length === 0 ? <div className="card"><p className="subtle" style={{ margin: 0 }}>No trials yet.</p></div> : (
        <div className="stack" style={{ gap: 16 }}>
          {trials.map((t) => {
            const url = `${origin}/trial/${t.qr_token}`;
            return (
              <div key={t.id} className="card">
                <div className="row between" style={{ alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{new Date(t.date).toLocaleDateString()} · {t.sport}</h4>
                    <p className="subtle" style={{ margin: '6px 0' }}>Parents scan to register — no login needed.</p>
                    <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13, wordBreak: 'break-all' }}>{url}</a>
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-secondary" style={{ minHeight: 34 }} onClick={() => setOpenId(openId === t.id ? null : t.id)}>
                        {openId === t.id ? 'Hide registrations' : 'View registrations'}
                      </button>
                    </div>
                  </div>
                  <div style={{ background: '#fff', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <QRCodeSVG value={url} size={128} />
                  </div>
                </div>
                {openId === t.id && <Registrations trialId={t.id} />}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
