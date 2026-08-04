/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// On-device pose maths for the hybrid AI form checker. MediaPipe BlazePose gives
// 33 landmarks; we derive joint angles, count reps with a simple state machine,
// and score technique with transparent rules. No server, no per-check cost.

export const L = { // BlazePose landmark indices we use
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
};

// Interior angle at point b (degrees) formed by a-b-c.
export function angle(a, b, c) {
  if (!a || !b || !c) return null;
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mA = Math.hypot(abx, aby), mC = Math.hypot(cbx, cby);
  if (!mA || !mC) return null;
  let cos = dot / (mA * mC);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Angle of vector b->a from vertical (0 = straight up, 90 = horizontal).
export function fromVertical(a, b) {
  if (!a || !b) return null;
  const dx = a.x - b.x, dy = a.y - b.y;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}

const vis = (lm, i) => (lm[i] && (lm[i].visibility ?? 1) > 0.5 ? lm[i] : null);
// Pick whichever side (left/right) is more confidently visible.
function sideAngle(lm, aI, bI, cI, aI2, bI2, cI2) {
  const l = angle(vis(lm, aI), vis(lm, bI), vis(lm, cI));
  const r = angle(vis(lm, aI2), vis(lm, bI2), vis(lm, cI2));
  if (l != null && r != null) return (l + r) / 2;
  return l != null ? l : r;
}

// Per-exercise: how to read the "primary" angle that drives rep detection,
// plus what a rep's bottom looks like. down/up thresholds gate the state machine.
export const EXERCISE_DEFS = {
  Squat: {
    label: 'Squat',
    primary: (lm) => sideAngle(lm, L.lHip, L.lKnee, L.lAnkle, L.rHip, L.rKnee, L.rAnkle), // knee angle
    torso: (lm) => {
      const sh = vis(lm, L.lShoulder) || vis(lm, L.rShoulder);
      const hp = vis(lm, L.lHip) || vis(lm, L.rHip);
      return fromVertical(sh, hp);
    },
    down: 100, up: 155, // knee angle: bottom < 100°, standing > 155°
  },
  'Push-Up': {
    label: 'Push-Up',
    primary: (lm) => sideAngle(lm, L.lShoulder, L.lElbow, L.lWrist, L.rShoulder, L.rElbow, L.rWrist), // elbow angle
    torso: (lm) => { // body line: shoulder-hip-knee straightness deviation from 180
      const a = sideAngle(lm, L.lShoulder, L.lHip, L.lKnee, L.rShoulder, L.rHip, L.rKnee);
      return a == null ? null : Math.abs(180 - a);
    },
    down: 100, up: 155, // elbow angle: bottom < 100°, top > 155°
  },
};

// Streaming accumulator. Feed frames; it counts reps and records per-rep depth
// (min primary angle) and torso reading at the bottom of each rep.
export function createAnalyzer(exercise) {
  const def = EXERCISE_DEFS[exercise] || EXERCISE_DEFS.Squat;
  let state = 'up';           // up | down
  let reps = 0;
  let repMin = 999;           // min primary angle in the current descent
  let repTorsoAtMin = null;
  let repStart = 0;
  const perRep = [];
  let frames = 0, tracked = 0;

  return {
    def,
    push(lm, tSec) {
      frames += 1;
      const p = def.primary(lm);
      if (p == null) return;
      tracked += 1;
      const torso = def.torso(lm);
      if (state === 'up') {
        if (p < def.down) { state = 'down'; repMin = p; repTorsoAtMin = torso; repStart = tSec; }
      } else { // descending / at bottom
        if (p < repMin) { repMin = p; repTorsoAtMin = torso; }
        if (p > def.up) { // completed a rep
          reps += 1;
          perRep.push({ minAngle: Math.round(repMin), torso: repTorsoAtMin == null ? null : Math.round(repTorsoAtMin), dur: +(tSec - repStart).toFixed(2) });
          state = 'up'; repMin = 999; repTorsoAtMin = null;
        }
      }
    },
    live() { return { reps, state }; },
    finish() {
      return { reps, perRep, coverage: frames ? tracked / frames : 0 };
    },
  };
}

// Turn measured reps into a 0–100 score + colour-coded coaching cues.
export function scoreResult(exercise, res) {
  const cues = [];
  let score = 100;
  if (!res.reps || res.perRep.length === 0) {
    return { score: 0, reps: 0, summary: 'No full reps were detected. Make sure your whole body is in frame and side-on to the camera.', cues: [{ level: 'bad', title: 'No reps detected', detail: 'Frame your whole body, film from the side, and complete full reps.' }], metrics: res };
  }
  const depths = res.perRep.map((r) => r.minAngle);
  const avgDepth = Math.round(depths.reduce((a, b) => a + b, 0) / depths.length);
  const torsos = res.perRep.map((r) => r.torso).filter((t) => t != null);
  const avgTorso = torsos.length ? Math.round(torsos.reduce((a, b) => a + b, 0) / torsos.length) : null;
  const depthSpread = Math.max(...depths) - Math.min(...depths);

  if (exercise === 'Squat') {
    if (avgDepth <= 95) cues.push({ level: 'good', title: 'Great depth', detail: `Knees bent to ~${avgDepth}° at the bottom — at or below parallel. Strong range.` });
    else if (avgDepth <= 110) { score -= 8; cues.push({ level: 'warn', title: 'Just above parallel', detail: `Bottoming at ~${avgDepth}°. Aim for a touch deeper if mobility allows.` }); }
    else { score -= 20; cues.push({ level: 'bad', title: 'Shallow depth', detail: `Only reaching ~${avgDepth}°. Sit down more to break parallel for full benefit.` }); }
    if (avgTorso != null) {
      if (avgTorso <= 45) cues.push({ level: 'good', title: 'Upright torso', detail: `Torso stayed ~${avgTorso}° from vertical — good bracing.` });
      else if (avgTorso <= 55) { score -= 8; cues.push({ level: 'warn', title: 'Some forward lean', detail: `Torso tips to ~${avgTorso}°. Brace harder and keep the bar over midfoot.` }); }
      else { score -= 15; cues.push({ level: 'bad', title: 'Excessive forward lean', detail: `Torso at ~${avgTorso}° from vertical. Chest is dipping — brace and keep more upright.` }); }
    }
  } else { // Push-Up
    if (avgDepth <= 95) cues.push({ level: 'good', title: 'Full depth', detail: `Elbows bent to ~${avgDepth}° — chest travelling to a solid bottom position.` });
    else if (avgDepth <= 115) { score -= 10; cues.push({ level: 'warn', title: 'Partial depth', detail: `Bottoming at ~${avgDepth}°. Lower your chest closer to the floor.` }); }
    else { score -= 22; cues.push({ level: 'bad', title: 'Shallow reps', detail: `Only reaching ~${avgDepth}°. Increase range for full-rep credit.` }); }
    if (avgTorso != null) {
      if (avgTorso <= 12) cues.push({ level: 'good', title: 'Straight body line', detail: 'Hips stayed in line with shoulders and knees — solid plank position.' });
      else { score -= 12; cues.push({ level: 'warn', title: 'Hips out of line', detail: `Body line deviates ~${avgTorso}°. Brace the core so hips don’t sag or pike.` }); }
    }
  }
  if (depthSpread > 25) { score -= 8; cues.push({ level: 'warn', title: 'Inconsistent depth', detail: `Depth varied ${depthSpread}° across reps — likely fatigue. Keep every rep the same range.` }); }
  if (res.coverage < 0.6) cues.push({ level: 'warn', title: 'Partial tracking', detail: 'Body wasn’t fully visible for part of the clip — results are approximate. Film side-on with your whole body in frame.' });

  score = Math.max(0, Math.min(100, Math.round(score)));
  const summary = score >= 88 ? 'Strong, clean technique — minor polish only.'
    : score >= 75 ? 'Solid form with a couple of fixable points.'
    : score >= 55 ? 'Decent effort — focus on the flagged fundamentals.'
    : 'Lots to gain — work the basics below and re-film.';
  return { score, reps: res.reps, summary, cues, metrics: { avgDepth, avgTorso, depthSpread, coverage: +res.coverage.toFixed(2), perRep: res.perRep } };
}

// Skeleton connections for the overlay.
export const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];
