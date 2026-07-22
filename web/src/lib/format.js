/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * PitchIQ — proprietary and confidential. See LICENSE.
 */

// Shared date/name helpers — one source of truth instead of per-page copies.

export const isToday = (d) => !!d && new Date(d).toDateString() === new Date().toDateString();

export const whenLabel = (d) => new Date(d).toLocaleString([], {
  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

export const dateLabel = (d) => new Date(d).toLocaleDateString([], {
  day: 'numeric', month: 'short', year: 'numeric',
});

export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export const endOfWeek = () => {
  const d = new Date(); d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
};

export const initials = (n = '') =>
  n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
