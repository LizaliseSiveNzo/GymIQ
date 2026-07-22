-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- 0057: Restore table-level grants for the `authenticated` role.
--
-- WHY THIS IS NEEDED
-- The public schema was dropped and recreated when this project's database was
-- rebuilt from scratch. `grant usage on schema public` was restored, but the
-- table-level privileges Supabase normally configures were not, and neither
-- were the default privileges for tables created afterwards. Every table the
-- migrations subsequently created therefore ended up with no grants at all.
--
-- Symptom: any client call like supabase.from('users').select() fails on
-- permission before RLS is even evaluated. In the UI this surfaced as a login
-- that hangs on "Loading…" forever, because AuthContext could never read the
-- signed-in user's profile row and ProtectedRoute waits for it.
--
-- SECURITY NOTE
-- Table grants are the coarse layer; RLS is the fine one. All 27 tables in this
-- schema have RLS enabled, so `authenticated` still only sees rows its policies
-- allow. We deliberately do NOT grant anything to `anon`: the public entry
-- points (register_trialist, get_trial_by_token) are SECURITY DEFINER functions
-- and do not need table privileges. This is stricter than the Supabase default,
-- which grants to anon and leans entirely on RLS.
--
-- Function grants are untouched — migration 0055 locked those down deliberately
-- and re-granted only the RPCs the client is allowed to call.

grant usage on schema public to anon, authenticated, service_role;

-- Existing tables
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Tables created from here on
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
