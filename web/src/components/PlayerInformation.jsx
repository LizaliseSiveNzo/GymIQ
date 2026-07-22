/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const age = (dob) => {
  if (!dob) return null;
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
};

const FIELDS = [
  ['position',          'Position',          'text'],
  ['shirt_number',      'Shirt number',      'number'],
  ['date_of_birth',     'Date of birth',     'date'],
  ['strong_foot',       'Preferred foot',    'select'],
  ['guardian_name',     'Parent / guardian', 'text'],
  ['guardian_phone',    'Guardian phone',    'tel'],
  ['guardian_email',    'Guardian email',    'email'],
  ['emergency_contact', 'Emergency contact', 'text'],
  ['emergency_phone',   'Emergency phone',   'tel'],
  ['allergies',         'Allergies / medical', 'text'],
];

// Collapsible "Player Information" block so coaching content stays front and centre.
export default function PlayerInformation({ player, editable = false, onSaved }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  if (!player) return null;
  const val = (k) => (edit ? (form[k] ?? player[k] ?? '') : player[k]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true); setMsg('');
    try {
      const patch = {};
      FIELDS.forEach(([k]) => {
        if (k in form) {
          let v = form[k];
          if (v === '') v = null;
          if (k === 'shirt_number' && v != null) v = parseInt(v, 10) || null;
          patch[k] = v;
        }
      });
      if (Object.keys(patch).length === 0) { setEdit(false); return; }
      const { error } = await supabase.from('players').update(patch).eq('id', player.id);
      if (error) { setMsg(error.message); return; }
      setEdit(false); setForm({}); setMsg('Saved.');
      onSaved?.();
    } finally { setBusy(false); }
  }

  const a = age(player.date_of_birth);
  const missingEmergency = !player.emergency_contact && !player.emergency_phone;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
        <div className="row between" style={{ width: '100%' }}>
          <strong>ℹ️ Player Information</strong>
          <span className="row" style={{ gap: 8 }}>
            {missingEmergency && <span className="badge badge-danger">No emergency contact</span>}
            {player.consentAccepted === false && <span className="badge badge-warning">No consent on file</span>}
            <span className="subtle">{open ? '▲' : '▼'}</span>
          </span>
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {edit ? (
            <>
              <div className="grid grid-2" style={{ gap: 10 }}>
                {FIELDS.map(([k, label, type]) => (
                  <div className="field" style={{ margin: 0 }} key={k}>
                    <label className="label">{label}</label>
                    {type === 'select' ? (
                      <select className="select" value={val(k) || ''} onChange={(e) => set(k, e.target.value)}>
                        <option value="">—</option><option value="Left">Left</option>
                        <option value="Right">Right</option><option value="Both">Both</option>
                      </select>
                    ) : (
                      <input className="input" type={type} value={val(k) || ''} onChange={(e) => set(k, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setEdit(false); setForm({}); }}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-2" style={{ gap: 8 }}>
                {[
                  ['Position', player.position],
                  ['Shirt number', player.shirt_number != null ? `#${player.shirt_number}` : null],
                  ['Age', a != null ? `${a} yrs` : null],
                  ['Date of birth', player.date_of_birth ? new Date(player.date_of_birth).toLocaleDateString() : null],
                  ['Preferred foot', player.strong_foot],
                  ['Parent / guardian', player.guardian_name],
                  ['Guardian phone', player.guardian_phone],
                  ['Guardian email', player.guardian_email],
                  ['Emergency contact', player.emergency_contact],
                  ['Emergency phone', player.emergency_phone],
                  ['Allergies / medical', player.allergies],
                ].map(([label, v]) => (
                  <div key={label} className="row between" style={{ borderBottom: '1px solid var(--border)', padding: '5px 0' }}>
                    <span className="subtle" style={{ fontSize: 13 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: v ? 600 : 400, color: v ? 'inherit' : 'var(--muted, #999)' }}>{v || '—'}</span>
                  </div>
                ))}
              </div>
              {editable && (
                <button type="button" className="btn btn-secondary" style={{ marginTop: 12, minHeight: 34 }} onClick={() => setEdit(true)}>✏️ Edit information</button>
              )}
            </>
          )}
          {msg && <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 8 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
