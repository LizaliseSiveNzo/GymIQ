/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient.js';
import { monthlyAllowance } from '../../lib/calorieBank.js';

const fmt = (n) => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString();

// Compact Calorie Bank summary for the Today dashboard: the balance ring + this
// month's allowance, linking to the full Bank tab for setup and logging.
export default function CalorieBankCard({ userId }) {
  const [settings, setSettings] = useState(undefined); // undefined=loading, null=none
  const [txns, setTxns] = useState([]);

  useEffect(() => { if (!userId) return; (async () => {
    const { data: s } = await supabase.from('calorie_bank').select('*').eq('user_id', userId).maybeSingle();
    setSettings(s || null);
    if (s) await supabase.rpc('ensure_month_deposit', { uid: userId });
    const { data: t } = await supabase.from('calorie_transactions').select('kcal').eq('user_id', userId).limit(400);
    setTxns(t || []);
  })(); }, [userId]);

  const balance = useMemo(() => txns.reduce((a, t) => a + t.kcal, 0), [txns]);

  if (settings === undefined) return (
    <section className="mf-card"><h4>🏦 Calorie Bank</h4><div className="subtle" style={{ fontSize: 13 }}>Loading…</div></section>
  );
  if (settings === null) return (
    <Link to="/bank" className="mf-card" style={{ display: 'block' }}>
      <h4>🏦 Calorie Bank</h4>
      <div className="subtle" style={{ fontSize: 13 }}>Set your height, weight and goal to open your bank →</div>
    </Link>
  );

  const allowance = monthlyAllowance(settings.daily_target);
  const overdrawn = balance <= 0;
  const frac = allowance > 0 ? Math.max(0, Math.min(1, balance / allowance)) : 0;
  const low = !overdrawn && frac < 0.15;
  const color = overdrawn ? 'var(--danger)' : low ? 'var(--warning)' : 'var(--green-600)';
  const R = 54, C = 2 * Math.PI * R, off = C * (1 - (overdrawn ? 1 : frac));

  return (
    <section className="mf-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4>🏦 Calorie Bank</h4>
        <Link to="/bank" style={{ fontSize: 13, color: 'var(--green-600)' }}>Configure →</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
        <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle cx="64" cy="64" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{fmt(balance)}</div>
            <div className="subtle" style={{ fontSize: 10 }}>kcal {overdrawn ? 'over' : 'left'}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="subtle" style={{ fontSize: 12 }}>Monthly allowance</div>
          <div style={{ fontWeight: 700 }}>{fmt(allowance)} kcal</div>
          <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>{fmt(settings.daily_target)}/day · goal {settings.goal_weight_kg}kg</div>
          <Link to="/bank" className="btn btn-secondary" style={{ marginTop: 12, minHeight: 36 }}>Log food / exercise</Link>
        </div>
      </div>
    </section>
  );
}
