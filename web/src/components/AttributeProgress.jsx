/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ATTR_GROUPS, ATTR_LABEL } from '../lib/attributes.js';

const RANGES = [['30', '30 days'], ['90', 'Term'], ['365', 'Season'], ['all', 'All time']];
const fmtDate = (d) => new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' });

// Lightweight inline SVG line chart — no chart library needed.
function Spark({ points, colour = 'var(--green-600)', w = 260, h = 64 }) {
  if (points.length === 0) return null;
  const pad = 6;
  const xs = points.map((p) => new Date(p.t).getTime());
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const spanX = maxX - minX || 1;
  const X = (t) => pad + ((new Date(t).getTime() - minX) / spanX) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - 1) / 4) * (h - pad * 2);   // ratings are 1..5
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Rating over time" style={{ display: 'block' }}>
      {[1, 3, 5].map((v) => (
        <line key={v} x1={pad} x2={w - pad} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth="1" />
      ))}
      {points.length > 1 && <path d={d} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <circle key={i} cx={X(p.t)} cy={Y(p.v)} r={i === points.length - 1 ? 3.5 : 2.5} fill={colour} />
      ))}
    </svg>
  );
}

const Delta = ({ n }) => {
  if (!n) return <span className="subtle" style={{ fontSize: 12 }}>no change</span>;
  const up = n > 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: up ? 'var(--green-700)' : 'var(--danger)' }}>
      {up ? '▲' : '▼'} {Math.abs(n).toFixed(1)}
    </span>
  );
};

// Attribute development over time (item 5).
export default function AttributeProgress({ playerId }) {
  const [rows, setRows] = useState(null);
  const [range, setRange] = useState('365');
  const [openGroup, setOpenGroup] = useState('');

  useEffect(() => { (async () => {
    const { data } = await supabase.from('player_attribute_history')
      .select('attribute,rating,recorded_at').eq('player_id', playerId)
      .order('recorded_at', { ascending: true });
    setRows(data || []);
  })(); }, [playerId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (range === 'all') return rows;
    const cutoff = Date.now() - Number(range) * 86400e3;
    return rows.filter((r) => new Date(r.recorded_at).getTime() >= cutoff);
  }, [rows, range]);

  if (rows === null) return <div className="card" style={{ marginTop: 16 }}>Loading progress…</div>;

  const byAttr = {};
  filtered.forEach((r) => { (byAttr[r.attribute] = byAttr[r.attribute] || []).push({ t: r.recorded_at, v: r.rating }); });

  // overall average across all attributes, per recorded day
  const byDay = {};
  filtered.forEach((r) => {
    const k = r.recorded_at.slice(0, 10);
    (byDay[k] = byDay[k] || []).push(r.rating);
  });
  const overallPoints = Object.entries(byDay)
    .map(([k, v]) => ({ t: k, v: v.reduce((n, x) => n + x, 0) / v.length }))
    .sort((a, b) => new Date(a.t) - new Date(b.t));
  const overallDelta = overallPoints.length > 1
    ? overallPoints[overallPoints.length - 1].v - overallPoints[0].v : 0;

  const hasHistory = filtered.length > 0;
  const multiPoint = overallPoints.length > 1;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h4 style={{ margin: 0 }}>📈 Development over time</h4>
        <div className="segmented">
          {RANGES.map(([k, label]) => (
            <button key={k} type="button" aria-selected={range === k} onClick={() => setRange(k)}>{label}</button>
          ))}
        </div>
      </div>

      {!hasHistory ? (
        <p className="subtle" style={{ margin: 0 }}>
          No rating history in this period yet. Every time you save attribute ratings, a snapshot is stored here so you can see progress build up over the season.
        </p>
      ) : (
        <>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 13 }}>Overall average</strong>
              <span className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{overallPoints[overallPoints.length - 1].v.toFixed(1)}</span>
                <Delta n={overallDelta} />
              </span>
            </div>
            <Spark points={overallPoints} />
            {multiPoint && (
              <div className="row between subtle" style={{ fontSize: 11, marginTop: 2 }}>
                <span>{fmtDate(overallPoints[0].t)}</span><span>{fmtDate(overallPoints[overallPoints.length - 1].t)}</span>
              </div>
            )}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {ATTR_GROUPS.map(([group, list]) => {
              const attrs = list.filter(([k]) => byAttr[k]?.length);
              if (!attrs.length) return null;
              const open = openGroup === group;
              const groupPts = attrs.flatMap(([k]) => byAttr[k]);
              const firstAvg = attrs.reduce((n, [k]) => n + byAttr[k][0].v, 0) / attrs.length;
              const lastAvg = attrs.reduce((n, [k]) => n + byAttr[k][byAttr[k].length - 1].v, 0) / attrs.length;
              return (
                <div key={group} style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                  <button type="button" onClick={() => setOpenGroup(open ? '' : group)}
                    style={{ width: '100%', background: 'none', border: 0, padding: '10px 12px', cursor: 'pointer' }}>
                    <div className="row between" style={{ width: '100%' }}>
                      <strong style={{ fontSize: 13 }}>{group}</strong>
                      <span className="row" style={{ gap: 10 }}>
                        <span style={{ fontSize: 13 }}>{lastAvg.toFixed(1)}</span>
                        <Delta n={lastAvg - firstAvg} />
                        <span className="subtle">{open ? '▲' : '▼'}</span>
                      </span>
                    </div>
                  </button>
                  {open && (
                    <div style={{ padding: '0 12px 12px' }}>
                      {attrs.map(([k]) => {
                        const pts = byAttr[k];
                        const d = pts[pts.length - 1].v - pts[0].v;
                        return (
                          <div key={k} style={{ marginTop: 10 }}>
                            <div className="row between">
                              <span style={{ fontSize: 12.5 }}>{ATTR_LABEL[k] || k}</span>
                              <span className="row" style={{ gap: 8 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{pts[pts.length - 1].v}/5</span>
                                <Delta n={d} />
                              </span>
                            </div>
                            <Spark points={pts} h={44} colour={d < 0 ? 'var(--danger)' : 'var(--green-600)'} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
