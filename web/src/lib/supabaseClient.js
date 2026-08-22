/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { createClient } from '@supabase/supabase-js';

// Prefer build-time env vars (Vercel). Fall back to the GymIQ (Aster) project so
// the app works even if env vars aren't set. The anon key is a PUBLIC client key
// — it's designed to ship in the browser and is protected by row-level security.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://brnshmmsyfitmotauaud.supabase.co';
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnNobW1zeWZpdG1vdGF1YXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjAzMjgsImV4cCI6MjEwMTUzNjMyOH0.H327yv7ni0bJtEug5st2LnYoO8YRo3agDL1wWnNZGZ8';

export const supabase = createClient(URL, ANON);
