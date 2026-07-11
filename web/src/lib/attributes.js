/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

export const ATTR_GROUPS = [
  ['Pace', [['acceleration', 'Acceleration'], ['sprint_speed', 'Sprint Speed']]],
  ['Shooting', [['finishing', 'Finishing'], ['shot_power', 'Shot Power'], ['long_shots', 'Long Shots']]],
  ['Passing', [['short_passing', 'Short Passing'], ['vision', 'Vision'], ['crossing', 'Crossing']]],
  ['Dribbling', [['ball_control', 'Ball Control'], ['agility', 'Agility'], ['balance', 'Balance']]],
  ['Defending', [['tackling', 'Tackling'], ['marking', 'Marking'], ['interceptions', 'Interceptions']]],
  ['Physical', [['strength', 'Strength'], ['stamina', 'Stamina'], ['jumping', 'Jumping']]],
];
export const ATTR_LABEL = Object.fromEntries(ATTR_GROUPS.flatMap(([, a]) => a));

export function groupAverages(attrs = {}) {
  return ATTR_GROUPS.map(([g, list]) => {
    const vals = list.map(([k]) => attrs[k]).filter((v) => v != null);
    return [g, vals.length ? vals.reduce((n, v) => n + v, 0) / vals.length : 0];
  });
}
export function overall(attrs = {}) {
  const vals = Object.values(attrs).filter((v) => v != null);
  return vals.length ? +(vals.reduce((n, v) => n + v, 0) / vals.length).toFixed(1) : 0;
}
export function topAttrs(attrs = {}, n = 3) {
  return Object.entries(attrs).sort((a, b) => b[1] - a[1]).slice(0, n);
}
