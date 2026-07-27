/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Block categories used to colour-code workout blocks and to offer one-tap
// "preset" blocks the user can then fill with exercises. A block's category is
// cosmetic + organisational; the exercises inside come from the preset library.
export const BLOCK_CATEGORIES = ['Arms', 'Legs', 'Back', 'Chest', 'Shoulders', 'Push', 'Pull', 'Full Body', 'Cardio'];

export const CATEGORY_COLORS = {
  Arms: '#f59e0b',        // amber
  Legs: '#22c55e',        // green
  Back: '#3b82f6',        // blue
  Chest: '#ef4444',       // red
  Shoulders: '#a855f7',   // violet
  Push: '#ec4899',        // pink
  Pull: '#06b6d4',        // cyan
  'Full Body': '#eab308', // yellow
  Cardio: '#f97316',      // orange
};

export const catColor = (c) => CATEGORY_COLORS[c] || 'var(--border-strong)';
