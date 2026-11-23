-- Extra fixture + lineup parameters for the improved lineup builder.
alter table public.matches   add column if not exists formation   text;
alter table public.matches   add column if not exists competition text;
alter table public.matches   add column if not exists home_away   text;
alter table public.match_lineups add column if not exists is_captain boolean not null default false;
