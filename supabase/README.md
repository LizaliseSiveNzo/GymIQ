# Supabase

## Setup
1. Create a free project at https://supabase.com
2. Open the SQL editor and run `migrations/0001_initial_schema.sql`
3. Copy your Project URL, anon key, and service_role key into `backend/.env` and `web/.env`

## Migrations
- `0001_initial_schema.sql` — 13 tables, enums, indexes, and RLS policies (Phase 1)

RLS summary: admins have full access, coaches manage their own team, parents read
only their linked child, players read their own profile. Trial registration inserts
are public (QR check-in); reads are staff-only.
