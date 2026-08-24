/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Unit conversion + display helpers. Storage is always metric (kg, cm); these
// convert to/from the user's chosen display units ('metric' | 'imperial').

export const KG_PER_LB = 0.45359237;

export const round1 = (n) => Math.round(n * 10) / 10;

export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;
export const cmToIn = (cm) => cm / 2.54;
export const inToCm = (inch) => inch * 2.54;

export const weightUnit = (units) => (units === 'imperial' ? 'lb' : 'kg');
export const heightUnit = (units) => (units === 'imperial' ? 'in' : 'cm');

// kg (stored) -> number shown in the user's unit
export const fromKg = (kg, units) => (units === 'imperial' ? round1(kgToLb(kg)) : round1(kg));
// number entered in the user's unit -> kg for storage
export const toKg = (val, units) => (units === 'imperial' ? lbToKg(Number(val)) : Number(val));

export function formatWeight(kg, units = 'metric') {
  if (kg == null || Number.isNaN(Number(kg))) return '—';
  return units === 'imperial' ? `${round1(kgToLb(kg))} lb` : `${round1(kg)} kg`;
}

export function formatHeight(cm, units = 'metric') {
  if (cm == null || Number.isNaN(Number(cm))) return '—';
  if (units === 'imperial') {
    const totalIn = Math.round(cmToIn(cm));
    const ft = Math.floor(totalIn / 12);
    const inch = totalIn % 12;
    return `${ft}'${inch}"`;
  }
  return `${Math.round(cm)} cm`;
}
