-- More aspects of the game: crosses, aerials, recoveries, GK conceded/clean sheet, discipline; extended stat_leaderboard.
alter table public.player_match_stats add column if not exists crosses        int not null default 0;
alter table public.player_match_stats add column if not exists aerials_won    int not null default 0;
alter table public.player_match_stats add column if not exists recoveries     int not null default 0;
alter table public.player_match_stats add column if not exists goals_conceded int not null default 0;
alter table public.player_match_stats add column if not exists clean_sheet    boolean not null default false;
alter table public.player_match_stats add column if not exists yellow_cards   int not null default 0;
alter table public.player_match_stats add column if not exists red_cards      int not null default 0;
-- (stat_leaderboard() recreated with goal contributions, crosses, recoveries, aerials, clean sheets,
--  goals conceded, discipline and total minutes — see migration body applied via MCP.)
