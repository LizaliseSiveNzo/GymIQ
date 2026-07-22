-- Announcements carry a file/photo and target the whole team (default) or selected players.
alter table public.announcements add column if not exists file_path text;
alter table public.announcements add column if not exists file_name text;
alter table public.announcements add column if not exists mime      text;
create table if not exists public.announcement_recipients (
  announcement_id uuid references public.announcements(id) on delete cascade,
  player_id       uuid references public.players(id) on delete cascade,
  primary key (announcement_id, player_id)
);
alter table public.announcement_recipients enable row level security;
insert into storage.buckets (id, name, public, file_size_limit)
values ('announcement-files','announcement-files', false, 209715200)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;
drop policy if exists "ann_files_insert" on storage.objects;
create policy "ann_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id='announcement-files' and exists (select 1 from public.users u where u.id=auth.uid() and u.role in ('coach','admin')));
drop policy if exists "ann_files_read" on storage.objects;
create policy "ann_files_read" on storage.objects for select to authenticated using (bucket_id='announcement-files');
drop policy if exists "ann_files_delete" on storage.objects;
create policy "ann_files_delete" on storage.objects for delete to authenticated
  using (bucket_id='announcement-files' and exists (select 1 from public.users u where u.id=auth.uid() and u.role in ('coach','admin')));
-- send_announcement() and my_announcements() applied via MCP; see project functions.
