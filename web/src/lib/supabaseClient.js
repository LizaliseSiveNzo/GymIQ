/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { createClient } from '@supabase/supabase-js';

// GymIQ Supabase project (formerly "Aster"). Pinned here on purpose: the old
// project was deleted, and stale Vercel env vars pointing at it caused
// "Failed to fetch" on login. The anon key is a PUBLIC client key — it's meant
// to ship in the browser and is protected by row-level security.
const URL = 'https://brnshmmsyfitmotauaud.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnNobW1zeWZpdG1vdGF1YXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjAzMjgsImV4cCI6MjEwMTUzNjMyOH0.H327yv7ni0bJtEug5st2LnYoO8YRo3agDL1wWnNZGZ8';

export const supabase = createClient(URL, ANON);
