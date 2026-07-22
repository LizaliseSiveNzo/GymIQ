/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// Shared note-tag vocabulary + colours (item 8).
export const NOTE_TAGS = [
  ['Technical',     '#3b82f6'],
  ['Tactical',      '#a855f7'],
  ['Physical',      '#f59e0b'],
  ['Psychological', '#10b981'],
  ['Medical',       '#ef4444'],
  ['General',       '#6b7280'],
];
export const tagColour = (t) => (NOTE_TAGS.find(([n]) => n === t) || NOTE_TAGS[5])[1];
