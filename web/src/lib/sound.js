/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

// Tiny Web-Audio beeps for scan feedback — no audio files needed.
let ctx;
function ac() {
  if (!ctx) {
    const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (C) ctx = new C();
  }
  return ctx;
}

// Call from a user gesture (e.g. "Start camera") so iOS/Safari unlocks audio.
export function primeAudio() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume();
}

function beep(freq, ms, type = 'sine', gain = 0.06) {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.start(t);
  o.stop(t + ms / 1000 + 0.02);
}

// Quick, bright confirmation so coaches can scan rapidly.
export function successBeep() { beep(1320, 70, 'sine', 0.07); }
// Lower, buzzier tone for "not found".
export function errorBeep() { beep(220, 180, 'square', 0.05); }
