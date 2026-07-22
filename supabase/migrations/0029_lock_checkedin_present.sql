-- A player who has checked in (checkin_at set, e.g. via QR/student code) can never be stored as absent.
create or replace function enforce_checkin_present()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.checkin_at is not null and NEW.attended = false then
    NEW.attended := true;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_enforce_checkin_present on public.attendance;
create trigger trg_enforce_checkin_present
before insert or update on public.attendance
for each row execute function enforce_checkin_present();
