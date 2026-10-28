-- Retire anonymous access to public endpoints belonging to the old academy UI.
-- Explicit authenticated grants and all workout/bank/account APIs are unchanged.
revoke execute on function public.get_trial_by_token(text) from public,anon;
revoke execute on function public.register_trialist(text,text,int,text,text,text,text) from public,anon;
revoke execute on function public.match_recap(uuid) from public,anon;
revoke execute on function public.my_announcements() from public,anon;
revoke execute on function public.send_announcement(uuid,text,text,text,text,text,uuid[],boolean,text,date) from public,anon;
