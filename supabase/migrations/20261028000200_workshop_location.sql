-- Workshop location (owner decision 2026-10-28): like the date, the admin sets
-- where the workshop is held; clients don't enter a location for it.
--
-- * services.workshop_location (workshops only).
-- * A booking for a workshop always takes the workshop's location, whatever
--   the client sent (trigger, so every booking path is covered).
-- * Changing the workshop's time or place updates its open sign-ups.

alter table public.services
  add column workshop_location text,
  add constraint services_workshop_location_check check (char_length(workshop_location) <= 300);

comment on column public.services.workshop_location is
  'Workshops only: where it is held (set by the admin). Copied onto every sign-up.';

create function public.set_workshop_booking_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workshop boolean;
  v_location text;
begin
  select s.category = 'workshop', s.workshop_location into v_workshop, v_location
  from public.services s where s.id = new.service_id;
  if v_workshop then
    new.location := v_location;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_workshop_booking_location() from public;

create trigger bookings_workshop_location
before insert or update of service_id on public.bookings
for each row
execute function public.set_workshop_booking_location();

-- Moving the workshop (time or place) moves the sign-ups that still hold a place.
create or replace function public.move_workshop_bookings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category = 'workshop' then
    update public.bookings b
    set start_at = coalesce(new.workshop_starts_at, b.start_at),
        end_at = coalesce(new.workshop_ends_at, b.end_at),
        blocked_until = coalesce(new.workshop_ends_at, b.blocked_until),
        has_end_time = true,
        location = new.workshop_location
    where b.service_id = new.id
      and b.status in ('pending_payment', 'pending', 'confirmed');
  end if;
  return new;
end;
$$;

drop trigger services_move_workshop_bookings on public.services;

create trigger services_move_workshop_bookings
after update of workshop_starts_at, workshop_ends_at, workshop_location on public.services
for each row
when (
  old.workshop_starts_at is distinct from new.workshop_starts_at
  or old.workshop_ends_at is distinct from new.workshop_ends_at
  or old.workshop_location is distinct from new.workshop_location
)
execute function public.move_workshop_bookings();
