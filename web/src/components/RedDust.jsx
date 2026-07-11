/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

import { useEffect, useRef } from 'react';

// Ambient red "dust" particles drifting like motes suspended in water.
export default function RedDust({ count = 48 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, t = 0;
    const rand = (a, b) => a + Math.random() * (b - a);

    function resize() {
      const r = parent.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = w * DPR; canvas.height = h * DPR;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(parent);

    const parts = Array.from({ length: count }, () => ({
      x: rand(0, w), y: rand(0, h),
      r: rand(0.6, 2.6),
      a: rand(0.12, 0.65),
      vx: rand(-0.09, 0.09),
      vy: rand(-0.09, 0.09),
      sway: rand(0.15, 0.7),
      phase: rand(0, Math.PI * 2),
    }));

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        if (!reduce) {
          p.x += p.vx + Math.sin(t * p.sway + p.phase) * 0.12;
          p.y += p.vy + Math.cos(t * p.sway * 0.8 + p.phase) * 0.10;
          if (p.x < -6) p.x = w + 6; else if (p.x > w + 6) p.x = -6;
          if (p.y < -6) p.y = h + 6; else if (p.y > h + 6) p.y = -6;
        }
        const rr = p.r * 3;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        g.addColorStop(0, `rgba(240,45,72,${p.a})`);
        g.addColorStop(1, 'rgba(240,45,72,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [count]);

  return <canvas ref={ref} aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 'inherit' }} />;
}
