-- Copyright © 2026 Lizalise Nzo. All rights reserved.
-- GymIQ — proprietary and confidential. See LICENSE.

-- Player uploads: proof of payment, images, documents — visible to the player, their coach, and admin.

-- 1) Private storage bucket
insert into storage.buckets (id, name, public) values ('player-files', 'player-files', false)
on conflict (id) do nothing;

-- 2) Storage access policies (path convention: <player_id>/<timestamp>_<filename>)
drop policy if exists "player upload own files" on storage.objects;
drop policy if exists "read player files" on storage.objects;
drop policy if exists "delete player files" on storage.objects;

create policy "player upload own files" on storage.objects for insert to authenticated
with check (
  bucket_id = 'player-files'
  and (storage.foldername(name))[1] in (select id::text from players where user_id = auth.uid())
);

create policy "read player files" on storage.objects for select to authenticated
using (
  bucket_id = 'player-files' and (
    (storage.foldername(name))[1] in (select id::text from players where user_id = auth.uid())
    or (storage.foldername(name))[1] in (select id::text from players where team_id in (select public.fn_coach_team_ids()))
    or public.current_role_of() = 'admin'
  )
);

create policy "delete player files" on storage.objects for delete to authenticated
using (
  bucket_id = 'player-files' and (
    (storage.foldername(name))[1] in (select id::text from players where user_id = auth.uid())
    or public.current_role_of() = 'admin'
  )
);

-- 3) Metadata table (nice list with kind + uploader)
create table if not exists player_files (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  uploaded_by uuid references users(id) on delete set null,
  path        text not null,
  file_name   text not null,
  mime        text,
  kind        text default 'other',   -- proof_of_payment | image | document | other
  created_at  timestamptz default now()
);
create index if not exists idx_player_files_player on player_files(player_id);
alter table player_files enable row level security;

drop policy if exists pf_read on player_files;
drop policy if exists pf_insert on player_files;
drop policy if exists pf_delete on player_files;

create policy pf_read on player_files for select using (
  current_role_of() = 'admin'
  or player_id in (select id from players where user_id = auth.uid())
  or player_id in (select id from players where team_id in (select fn_coach_team_ids()))
);
create policy pf_insert on player_files for insert with check (
  uploaded_by = auth.uid() and player_id in (select id from players where user_id = auth.uid())
);
create policy pf_delete on player_files for delete using (
  current_role_of() = 'admin' or player_id in (select id from players where user_id = auth.uid())
);
