/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { createClient } from '@supabase/supabase-js';

// GymIQ Supabase project (formerly "Aster"). Pinned on purpose: the old project
// was deleted and stale Vercel env vars pointing at it caused "Failed to fetch".
// The anon key is a PUBLIC client key — meant to ship in the browser, protected
// by row-level security.
const URL = 'https://brnshmmsyfitmotauaud.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnNobW1zeWZpdG1vdGF1YXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjAzMjgsImV4cCI6MjEwMTUzNjMyOH0.H327yv7ni0bJtEug5st2LnYoO8YRo3agDL1wWnNZGZ8';

// "Keep me signed in": when true (default) the session lives in localStorage and
// survives closing the browser; when false it lives in sessionStorage and clears
// when the tab/browser closes. Call setRemember() before signing in.
const REMEMBER_KEY = 'gymiq_remember';
const useLocal = () => {
  try { return localStorage.getItem(REMEMBER_KEY) !== 'false'; } catch { return true; }
};
export function setRemember(on) {
  try { localStorage.setItem(REMEMBER_KEY, on ? 'true' : 'false'); } catch { /* ignore */ }
}

// Reads from whichever store is active, with a fallback so an existing session is
// always found; writes to the active store and clears the other to avoid drift.
const crossStorage = {
  getItem: (k) => {
    try { return (useLocal() ? localStorage : sessionStorage).getItem(k) ?? sessionStorage.getItem(k) ?? localStorage.getItem(k); }
    catch { return null; }
  },
  setItem: (k, v) => {
    try {
      const primary = useLocal() ? localStorage : sessionStorage;
      const other = useLocal() ? sessionStorage : localStorage;
      primary.setItem(k, v); other.removeItem(k);
    } catch { /* ignore */ }
  },
  removeItem: (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: crossStorage },
});
