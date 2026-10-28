-- Workshop schedule (owner decision 2026-10-28): the admin sets the workshop's
-- date and time (and optionally a seat limit) on the workshop package; clients
-- no longer pick a time. Every sign-up takes the workshop's time, and many
-- sign-ups share it, up to the seats.
--
-- * services.workshop_starts_at / workshop_ends_at / workshop_seats (workshops only).
-- * create_booking: a workshop sign-up ignores p_start_at, uses the workshop's
--   time, skips the slot rules and checks the seats instead (workshop_not_scheduled,
--   workshop_closed, workshop_full). A shoot can't overlap an active workshop
--   (slot_unavailable); staff bookings still can.
-- * assert_capacity / get_busy_ranges: workshop sign-ups don't count as shoots;
--   the workshop's own time is busy on the public calendar instead.
-- * Moving the workshop moves its open sign-ups (trigger).
-- * workshop_seats_taken(): seats taken, for the public sign-up page (no personal data).

alter table public.services
  add column workshop_starts_at timestamptz,
  add column workshop_ends_at timestamptz,
  add column workshop_seats integer,
  add constraint services_workshop_time_check check (
    (workshop_starts_at is null and workshop_ends_at is null)
    or (workshop_starts_at is not null and workshop_ends_at > workshop_starts_at)
  ),
  add constraint services_workshop_seats_check check (workshop_seats is null or workshop_seats > 0);

comment on column public.services.workshop_starts_at is
  'Workshops only: when it starts (set by the admin). Null = date not announced, no sign-ups.';
comment on column public.services.workshop_seats is
  'Workshops only: seats (people) available. Null = no limit.';

-- Bookings that hold a place: paid/confirmed/done, or an unpaid hold still running.
create function public.booking_holds_place(
  p_status public.booking_status,
  p_hold_expires_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status in ('pending', 'confirmed', 'completed')
    or (p_status = 'pending_payment' and p_hold_expires_at > now());
$$;

revoke execute on function public.booking_holds_place(public.booking_status, timestamptz) from public;
grant execute on function public.booking_holds_place(public.booking_status, timestamptz)
  to anon, authenticated, service_role;

create function public.workshop_seats_taken(p_service_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.participants), 0)::integer
  from public.bookings b
  where b.service_id = p_service_id
    and public.booking_holds_place(b.status, b.hold_expires_at);
$$;

revoke execute on function public.workshop_seats_taken(uuid) from public;
grant execute on function public.workshop_seats_taken(uuid) to anon, authenticated, service_role;

-- Shoot capacity: same as before, but workshop sign-ups don't count.
create or replace function public.assert_capacity(
  p_start timestamptz,
  p_blocked_until timestamptz,
  p_exclude uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
  v_peak integer;
begin
  perform pg_advisory_xact_lock(4242001);

  select max_concurrent_bookings into strict v_capacity from public.business_settings where id;

  -- Peak concurrency inside the range is reached at the range start or at the
  -- start of some overlapping booking, so only those instants are checked.
  with overlapping as (
    select b.start_at, b.blocked_until
    from public.bookings b
    join public.services s on s.id = b.service_id
    where tstzrange(b.start_at, b.blocked_until, '[)') && tstzrange(p_start, p_blocked_until, '[)')
      and (p_exclude is null or b.id <> p_exclude)
      and s.category <> 'workshop'
      and public.booking_holds_place(b.status, b.hold_expires_at)
  ),
  instants as (
    select p_start as t
    union
    select o.start_at from overlapping o where o.start_at > p_start
  )
  select coalesce(max((
    select count(*) from overlapping o where o.start_at <= i.t and o.blocked_until > i.t
  )), 0)
  into v_peak
  from instants i;

  if v_peak + 1 > v_capacity then
    raise exception 'slot_unavailable';
  end if;
end;
$$;

-- Public calendar: shoot bookings as before, plus each active workshop's time,
-- repeated once per shoot that could run at once so the time shows as full.
create or replace function public.get_busy_ranges(p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, blocked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with ranges as (
    select b.start_at, b.blocked_until
    from public.bookings b
    join public.services s on s.id = b.service_id
    where s.category <> 'workshop'
      and public.booking_holds_place(b.status, b.hold_expires_at)
      and b.start_at < p_to
      and b.blocked_until > p_from
    union all
    select w.workshop_starts_at, w.workshop_ends_at
    from public.services w
    cross join public.business_settings bs
    cross join lateral generate_series(1, bs.max_concurrent_bookings)
    where bs.id
      and w.category = 'workshop'
      and w.is_active
      and w.workshop_starts_at < p_to
      and w.workshop_ends_at > p_from
  )
  select r.start_at, r.blocked_until
  from ranges r
  -- bound the scan: the slot picker never asks for more than ~2 months at once
  where p_to > p_from
    and p_to - p_from <= interval '62 days'
  order by r.start_at;
$$;

-- Moving the workshop moves the sign-ups that still hold a place.
create function public.move_workshop_bookings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category = 'workshop' and new.workshop_starts_at is not null then
    update public.bookings b
    set start_at = new.workshop_starts_at,
        end_at = new.workshop_ends_at,
        blocked_until = new.workshop_ends_at,
        has_end_time = true
    where b.service_id = new.id
      and b.status in ('pending_payment', 'pending', 'confirmed')
      and (b.start_at <> new.workshop_starts_at or b.end_at <> new.workshop_ends_at);
  end if;
  return new;
end;
$$;

revoke execute on function public.move_workshop_bookings() from public;

create trigger services_move_workshop_bookings
after update of workshop_starts_at, workshop_ends_at on public.services
for each row
when (
  old.workshop_starts_at is distinct from new.workshop_starts_at
  or old.workshop_ends_at is distinct from new.workshop_ends_at
)
execute function public.move_workshop_bookings();

create or replace function public.create_booking(
  p_full_name text,
  p_email text,
  p_phone text,
  p_preferred_contact public.contact_method,
  p_consent_version text,
  p_service_id uuid,
  p_start_at timestamptz,
  p_location text default null,
  p_participants integer default 1,
  p_special_requests text default null,
  p_messenger text default null,
  p_add_on_ids uuid[] default null,
  p_pay_in_full boolean default null
)
returns table (
  booking_id uuid,
  reference_code text,
  status public.booking_status,
  deposit_cents integer,
  hold_expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_settings public.business_settings%rowtype;
  v_service public.services%rowtype;
  v_workshop boolean;
  v_start_at timestamptz;
  v_participants integer := coalesce(p_participants, 1);
  v_add_on_ids uuid[];
  v_add_ons_cents integer;
  v_extra_minutes integer;
  v_offered integer;
  v_subtotal integer;
  v_vat integer;
  v_total integer;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_deposit integer;
  v_status public.booking_status;
  v_hold timestamptz;
  v_client_id uuid;
  v_reference text;
  v_booking_id uuid;
  v_attempt integer := 0;
begin
  perform public.expire_stale_holds();

  -- Public bookings always need an email (confirmation + booking lookup).
  if nullif(trim(p_email), '') is null then
    raise exception 'email_required';
  end if;

  select * into strict v_settings from public.business_settings where id;

  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'service_unavailable';
  end if;
  v_workshop := v_service.category = 'workshop';

  -- Each add-on at most once; every one must still be offered with this package.
  select coalesce(array_agg(distinct x), '{}') into v_add_on_ids
  from unnest(coalesce(p_add_on_ids, '{}')) x;
  select count(*), coalesce(sum(a.price_cents), 0), coalesce(sum(a.extra_minutes), 0)
  into v_offered, v_add_ons_cents, v_extra_minutes
  from public.add_ons a
  where a.id = any (v_add_on_ids)
    and a.is_active
    and (cardinality(a.service_ids) = 0 or v_service.id = any (a.service_ids));
  if v_offered <> cardinality(v_add_on_ids) then
    raise exception 'add_on_unavailable';
  end if;
  v_subtotal := v_service.price_cents + v_add_ons_cents;
  v_vat := round(v_subtotal * v_settings.vat_percent / 100.0)::integer;
  v_total := v_subtotal + v_vat;

  if v_workshop then
    -- The admin sets the workshop's time; sign-ups close when it starts.
    if v_service.workshop_starts_at is null then
      raise exception 'workshop_not_scheduled';
    end if;
    if v_service.workshop_starts_at <= now() then
      raise exception 'workshop_closed';
    end if;
    v_start_at := v_service.workshop_starts_at;
    v_end_at := v_service.workshop_ends_at;
    v_blocked_until := v_end_at;
    v_local_start := v_start_at at time zone v_settings.timezone;

    -- Seats: one per person, counted under the booking lock so two sign-ups
    -- can't both take the last seat.
    perform pg_advisory_xact_lock(4242001);
    if v_service.workshop_seats is not null
       and public.workshop_seats_taken(v_service.id) + v_participants > v_service.workshop_seats then
      raise exception 'workshop_full';
    end if;
  else
    v_start_at := p_start_at;
    v_end_at := v_start_at + make_interval(mins => public.booking_length_minutes(
      v_service.duration_minutes, v_extra_minutes, v_settings.slot_interval_minutes));
    v_blocked_until := v_end_at + make_interval(mins => v_settings.buffer_minutes);
    v_local_start := v_start_at at time zone v_settings.timezone;
    v_local_end := v_end_at at time zone v_settings.timezone;

    if extract(second from v_local_start) <> 0
       or (extract(hour from v_local_start)::int * 60 + extract(minute from v_local_start)::int)
          % v_settings.slot_interval_minutes <> 0 then
      raise exception 'invalid_start_time';
    end if;

    if v_start_at < now() + make_interval(hours => v_settings.min_notice_hours) then
      raise exception 'too_soon';
    end if;

    if v_start_at > now() + make_interval(days => v_settings.max_advance_days) then
      raise exception 'too_far';
    end if;

    if exists (select 1 from public.blackout_dates where date = v_local_start::date) then
      raise exception 'blackout_date';
    end if;

    if v_local_end::date <> v_local_start::date or not exists (
      select 1 from public.availability_rules r
      where r.day_of_week = extract(dow from v_local_start)::int
        and r.start_time <= v_local_start::time
        and r.end_time >= v_local_end::time
    ) then
      raise exception 'outside_business_hours';
    end if;

    -- The studio is busy while a workshop runs (owner decision 2026-10-28).
    if exists (
      select 1 from public.services w
      where w.category = 'workshop'
        and w.is_active
        -- No date yet: a null bound would make the range unbounded.
        and w.workshop_starts_at is not null
        and tstzrange(w.workshop_starts_at, w.workshop_ends_at, '[)')
            && tstzrange(v_start_at, v_blocked_until, '[)')
    ) then
      raise exception 'slot_unavailable';
    end if;

    perform public.assert_capacity(v_start_at, v_blocked_until);
  end if;

  if v_workshop then
    -- Workshops: the client pays half or the full price (owner decision 2026-10-27).
    if p_pay_in_full is null then
      raise exception 'payment_option_required';
    end if;
    v_deposit := case when p_pay_in_full then v_total else round(v_total / 2.0)::integer end;
  else
    v_deposit := coalesce(
      v_service.deposit_cents,
      round(v_total * v_settings.default_deposit_percent / 100.0)::integer
    );
  end if;

  if v_deposit > 0 then
    v_status := 'pending_payment';
    v_hold := now() + make_interval(mins => v_settings.hold_minutes);
  else
    v_status := 'pending';
    v_hold := null;
  end if;

  -- One client row per email; public submissions never overwrite name/phone.
  insert into public.clients as c (full_name, email, phone, preferred_contact, consent_given_at, consent_version)
  values (trim(p_full_name), lower(trim(p_email)), trim(p_phone), p_preferred_contact, now(), p_consent_version)
  on conflict ((lower(email))) do update
    set consent_given_at = excluded.consent_given_at,
        consent_version = excluded.consent_version
  returning c.id into v_client_id;

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'BK-' || to_char(v_local_start, 'YYYY') || '-'
                   || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.bookings (
        reference_code, client_id, service_id, status, start_at, end_at, blocked_until,
        has_end_time, contact_name, contact_phone, preferred_contact, messenger, location,
        participants, special_requests, price_cents, vat_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, v_status, v_start_at, v_end_at, v_blocked_until,
        v_workshop or v_service.duration_minutes is not null, trim(p_full_name), trim(p_phone),
        p_preferred_contact, nullif(trim(p_messenger), ''), nullif(trim(p_location), ''),
        v_participants, nullif(trim(p_special_requests), ''), v_total, v_vat,
        v_deposit, v_hold
      )
      returning id into v_booking_id;
      exit;
    exception
      when unique_violation then
        -- reference code collision (1 in 16.7M per year); retry a few times
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  insert into public.booking_add_ons (booking_id, add_on_id, name, price_cents)
  select v_booking_id, a.id, a.name, a.price_cents
  from public.add_ons a where a.id = any (v_add_on_ids)
  order by a.sort_order;

  return query select v_booking_id, v_reference, v_status, v_deposit, v_hold;
end;
$$;
