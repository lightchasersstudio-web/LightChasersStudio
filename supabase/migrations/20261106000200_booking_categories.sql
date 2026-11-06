-- Owner decision (2026-11-06): booking categories replace the bookings-per-day
-- limit from 20261106000100.
--
-- services.booking_category decides how a package is scheduled:
--   studio   – one studio session at a time (max_concurrent_bookings), back to
--              back: the next may start once the previous one's blocked time
--              (end + buffer) is over. The workshop's hours are busy for public
--              studio bookings (staff can still book them).
--   outside  – weddings and prenups: one outside event per (Manila) day. They
--              never clash with studio sessions.
--   excluded – the Photobooth and workshops: no scheduling rules at all, and
--              they never block anything.
-- Bookings that hold a place: pending_payment while its hold runs, pending,
-- confirmed and completed (booking_holds_place). Cancelled, declined and
-- expired ones never block.
--
-- Enforced by a trigger on bookings (assert_schedule, same advisory lock as
-- before), so create_booking, admin_create_booking, admin_update_booking and
-- any future path all follow it. assert_capacity is now a no-op kept for the
-- older functions that still call it.

alter table public.services
  add column booking_category text not null default 'studio'
    check (booking_category in ('outside', 'studio', 'excluded'));

comment on column public.services.booking_category is
  'studio = one at a time, back to back; outside = one per day (weddings, prenups); excluded = no scheduling rules (photobooth, workshops).';

update public.services set booking_category = 'outside' where category = 'wedding';
update public.services set booking_category = 'excluded'
where category = 'workshop' or ignores_day_limit or name ilike '%photobooth%';

-- Workshops are always excluded (they have their own seats and schedule).
create function public.services_workshop_excluded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category = 'workshop' then
    new.booking_category := 'excluded';
  end if;
  return new;
end;
$$;

revoke execute on function public.services_workshop_excluded() from public;

create trigger services_workshop_excluded
  before insert or update of category, booking_category on public.services
  for each row execute function public.services_workshop_excluded();

-- The bookings-per-day limit goes (mark_booking_paid is redefined below
-- without it). Its settings columns, ignores_day_limit, get_full_days and
-- bookings_per_day_limit stay unused until the site running the old code is
-- redeployed; drop them in a later migration.
drop trigger bookings_check_day_limit on public.bookings;
drop function public.bookings_check_day_limit();

-- Raises slot_unavailable (studio overlap, or a public studio booking during
-- the workshop) or outside_day_full (another outside event that day) if one
-- more booking of p_service_id in [p_start, p_blocked_until) breaks the rules.
create function public.assert_schedule(
  p_start timestamptz,
  p_blocked_until timestamptz,
  p_service_id uuid,
  p_exclude uuid default null,
  p_public boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_tz text;
  v_day_start timestamptz;
  v_capacity integer;
  v_peak integer;
begin
  select s.booking_category into v_kind from public.services s where s.id = p_service_id;
  if v_kind is null or v_kind = 'excluded' then
    return;
  end if;

  -- One at a time: two requests for the last place can't both get in.
  perform pg_advisory_xact_lock(4242001);

  if v_kind = 'outside' then
    select s.timezone into strict v_tz from public.business_settings s where s.id;
    v_day_start := ((p_start at time zone v_tz)::date)::timestamp at time zone v_tz;
    if exists (
      select 1
      from public.bookings b
      join public.services s on s.id = b.service_id
      where s.booking_category = 'outside'
        and b.start_at >= v_day_start
        and b.start_at < v_day_start + interval '1 day'
        and (p_exclude is null or b.id <> p_exclude)
        and public.booking_holds_place(b.status, b.hold_expires_at)
    ) then
      raise exception 'outside_day_full';
    end if;
    return;
  end if;

  -- Studio. The studio is busy while a workshop runs (owner decision
  -- 2026-10-28), for client bookings; staff can still book it.
  if p_public and exists (
    select 1 from public.services w
    cross join lateral public.workshop_ranges(w.workshop_days, w.workshop_starts_at, w.workshop_ends_at) r
    where w.category = 'workshop'
      and w.is_active
      and r && tstzrange(p_start, p_blocked_until, '[)')
  ) then
    raise exception 'slot_unavailable';
  end if;

  select s.max_concurrent_bookings into strict v_capacity from public.business_settings s where s.id;

  -- Peak concurrency inside the range is reached at the range start or at the
  -- start of some overlapping studio booking, so only those instants are checked.
  with overlapping as (
    select b.start_at, b.blocked_until
    from public.bookings b
    join public.services s on s.id = b.service_id
    where tstzrange(b.start_at, b.blocked_until, '[)') && tstzrange(p_start, p_blocked_until, '[)')
      and (p_exclude is null or b.id <> p_exclude)
      and s.booking_category = 'studio'
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

revoke execute on function public.assert_schedule(timestamptz, timestamptz, uuid, uuid, boolean) from public;
grant execute on function public.assert_schedule(timestamptz, timestamptz, uuid, uuid, boolean) to service_role;

-- New bookings, and bookings moved to another time or package (or made
-- longer). Status-only changes never trip it; late payments are checked in
-- mark_booking_paid.
create function public.bookings_check_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.booking_holds_place(new.status, new.hold_expires_at) then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.service_id = old.service_id
     and new.start_at = old.start_at
     and new.blocked_until <= old.blocked_until then
    return new;
  end if;
  perform public.assert_schedule(
    new.start_at, new.blocked_until, new.service_id, new.id,
    tg_op = 'INSERT' and new.source <> 'admin'
  );
  return new;
end;
$$;

revoke execute on function public.bookings_check_schedule() from public;

create trigger bookings_check_schedule
  before insert or update on public.bookings
  for each row execute function public.bookings_check_schedule();

-- Older functions still call this before inserting; the trigger above does
-- the real, category-aware check now.
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
begin
  return;
end;
$$;

-- Busy times for the slot picker of a studio package: studio bookings plus
-- the workshop's hours. Outside events and excluded packages never block
-- studio sessions. No personal data; at most 62 days per call.
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
    where s.booking_category = 'studio'
      and public.booking_holds_place(b.status, b.hold_expires_at)
      and b.start_at < p_to
      and b.blocked_until > p_from
    union all
    select lower(r), upper(r)
    from public.services w
    cross join public.business_settings bs
    cross join lateral public.workshop_ranges(w.workshop_days, w.workshop_starts_at, w.workshop_ends_at) r
    cross join lateral generate_series(1, bs.max_concurrent_bookings)
    where bs.id
      and w.category = 'workshop'
      and w.is_active
      and lower(r) < p_to
      and upper(r) > p_from
  )
  select r.start_at, r.blocked_until
  from ranges r
  where p_to > p_from
    and p_to - p_from <= interval '62 days'
  order by r.start_at;
$$;

-- Days (Manila dates) in [p_from, p_to] that already have an outside event,
-- for the wedding/prenup calendar and the admin day view. No personal data.
create function public.get_outside_days(p_from date, p_to date, p_exclude uuid default null)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  select distinct (b.start_at at time zone st.timezone)::date
  from public.bookings b
  join public.services s on s.id = b.service_id
  cross join public.business_settings st
  where st.id
    and p_to >= p_from
    and p_to - p_from <= 62
    and s.booking_category = 'outside'
    and b.start_at >= p_from::timestamp at time zone st.timezone
    and b.start_at < (p_to + 1)::timestamp at time zone st.timezone
    and (p_exclude is null or b.id <> p_exclude)
    and public.booking_holds_place(b.status, b.hold_expires_at)
  order by 1;
$$;

revoke execute on function public.get_outside_days(date, date, uuid) from public;
grant execute on function public.get_outside_days(date, date, uuid) to anon, authenticated, service_role;

-- mark_booking_paid: as in 20261106000100, with the category-aware check for a
-- late payment.
create or replace function public.mark_booking_paid(
  p_reference text,
  p_checkout_id text,
  p_payment_id text,
  p_amount_cents integer,
  p_raw jsonb
)
returns table (booking_id uuid, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking public.bookings%rowtype;
  v_purpose text;
  v_paid integer;
  v_outcome text;
begin
  if exists (select 1 from public.payments where provider_payment_id = p_payment_id) then
    return query select b.id, 'duplicate'::text from public.bookings b where b.reference_code = p_reference;
    return;
  end if;

  select * into v_booking from public.bookings where reference_code = p_reference for update;
  if not found then
    return query select null::uuid, 'unknown_booking'::text;
    return;
  end if;

  select p.purpose into v_purpose
  from public.payments p
  where p.provider_checkout_id = p_checkout_id and p.booking_id = v_booking.id;

  insert into public.payments as p (
    booking_id, provider, provider_checkout_id, provider_payment_id, amount_cents, status, paid_at, raw
  ) values (
    v_booking.id, 'paymongo', p_checkout_id, p_payment_id, p_amount_cents, 'paid', now(), p_raw
  )
  on conflict (provider_checkout_id) do update
    set provider_payment_id = excluded.provider_payment_id,
        amount_cents = excluded.amount_cents,
        status = 'paid',
        paid_at = excluded.paid_at,
        raw = excluded.raw;

  if v_purpose = 'balance' and v_booking.status in ('pending', 'confirmed') then
    -- The client paying the rest from their booking page. More than the price
    -- (e.g. paid twice, or staff recorded cash too) still needs a look.
    select coalesce(sum(p.amount_cents), 0) into v_paid
    from public.payments p where p.booking_id = v_booking.id and p.status = 'paid';
    if v_paid > v_booking.price_cents then
      update public.bookings set needs_refund_review = true where id = v_booking.id;
      v_outcome := 'needs_review';
    else
      v_outcome := 'balance_paid';
    end if;
  elsif v_booking.status = 'pending_payment' then
    update public.bookings set status = 'pending' where id = v_booking.id;
    v_outcome := 'paid';
  elsif v_booking.status = 'expired' then
    begin
      perform public.assert_schedule(
        v_booking.start_at, v_booking.blocked_until, v_booking.service_id, v_booking.id, false
      );
      v_outcome := 'paid_late';
    exception
      when raise_exception then
        if sqlerrm not in ('slot_unavailable', 'outside_day_full') then
          raise;
        end if;
        v_outcome := 'needs_review';
    end;
    update public.bookings
    set status = 'pending', needs_refund_review = (v_outcome = 'needs_review')
    where id = v_booking.id;
  else
    -- Paid for a booking that was cancelled/declined/completed, or paid twice
    -- (two checkouts): keep the money on record and flag it for a refund.
    update public.bookings set needs_refund_review = true where id = v_booking.id;
    v_outcome := 'needs_review';
  end if;

  return query select v_booking.id, v_outcome;
end;
$$;

revoke execute on function public.mark_booking_paid(text, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.mark_booking_paid(text, text, text, integer, jsonb) to service_role;

drop function public.assert_day_limit(timestamptz, uuid, uuid);

-- create_booking: as in 20261105000300, minus its own workshop check and the
-- capacity call; the bookings_check_schedule trigger does both, by category.

CREATE OR REPLACE FUNCTION public.create_booking(p_full_name text, p_email text, p_phone text, p_preferred_contact contact_method, p_consent_version text, p_service_id uuid, p_start_at timestamp with time zone, p_location text DEFAULT NULL::text, p_participants integer DEFAULT 1, p_special_requests text DEFAULT NULL::text, p_messenger text DEFAULT NULL::text, p_add_on_ids uuid[] DEFAULT NULL::uuid[], p_pay_in_full boolean DEFAULT NULL::boolean, p_attendees jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(booking_id uuid, reference_code text, status booking_status, deposit_cents integer, hold_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  v_settings public.business_settings%rowtype;
  v_service public.services%rowtype;
  v_workshop boolean;
  v_start_at timestamptz;
  v_participants integer := coalesce(p_participants, 1);
  v_attendee record;
  v_name text;
  v_category text;
  v_price integer;
  v_people_cents integer := 0;
  v_early integer := 0;
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
  if v_workshop then
    -- 1 to 3 people, each named for their certificate and priced by category
    -- (owner decisions 2026-10-28). Under the booking lock, so early-bird and
    -- seat counts can't race.
    perform pg_advisory_xact_lock(4242001);
    if jsonb_typeof(p_attendees) is distinct from 'array'
       or jsonb_array_length(p_attendees) not between 1 and 3 then
      raise exception 'invalid_participants';
    end if;
    v_participants := jsonb_array_length(p_attendees);

    for v_attendee in select e.value as a from jsonb_array_elements(p_attendees) e loop
      v_name := trim(v_attendee.a ->> 'name');
      v_category := v_attendee.a ->> 'category';
      if v_name is null or char_length(v_name) not between 2 and 120 then
        raise exception 'invalid_attendees';
      end if;
      -- Their own mobile number (7+ digits) and address, to reach them.
      if char_length(regexp_replace(coalesce(v_attendee.a ->> 'phone', ''), '\D', '', 'g')) < 7
         or char_length(trim(coalesce(v_attendee.a ->> 'phone', ''))) > 32
         or char_length(trim(coalesce(v_attendee.a ->> 'address', ''))) not between 5 and 300 then
        raise exception 'attendee_contact_required';
      end if;
      v_price := case v_category
        when 'regular' then
          case when v_service.workshop_regular_enabled then v_service.price_cents end
        when 'early_bird' then
          case when v_service.workshop_early_bird_enabled
            then v_service.workshop_early_bird_price_cents end
        when 'student' then
          case when v_service.workshop_student_enabled
            then v_service.workshop_student_price_cents end
      end;
      if v_price is null then
        raise exception 'category_unavailable';
      end if;
      -- A student must have uploaded their ID (checked by the admin later).
      if v_category = 'student' and not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'student-ids' and o.name = v_attendee.a ->> 'id_path'
      ) then
        raise exception 'student_id_required';
      end if;
      if v_category = 'early_bird' then
        v_early := v_early + 1;
      end if;
      v_people_cents := v_people_cents + v_price;
    end loop;

    if v_early > 0 then
      if v_service.workshop_early_bird_until is not null
         and (now() at time zone v_settings.timezone)::date > v_service.workshop_early_bird_until then
        raise exception 'early_bird_closed';
      end if;
      if v_service.workshop_early_bird_seats is not null
         and public.workshop_early_birds_taken(v_service.id) + v_early
             > v_service.workshop_early_bird_seats then
        raise exception 'early_bird_full';
      end if;
    end if;
  end if;
  v_subtotal := (case when v_workshop then v_people_cents else v_service.price_cents end)
                + v_add_ons_cents;
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

    -- Overlaps, the workshop and outside-event days: bookings_check_schedule.
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

  if v_workshop then
    insert into public.booking_attendees (
      booking_id, position, full_name, phone, address, category, price_cents,
      student_id_path, id_status
    )
    select
      v_booking_id,
      e.ordinality,
      trim(e.value ->> 'name'),
      trim(e.value ->> 'phone'),
      trim(e.value ->> 'address'),
      (e.value ->> 'category')::public.attendee_category,
      case e.value ->> 'category'
        when 'regular' then v_service.price_cents
        when 'early_bird' then v_service.workshop_early_bird_price_cents
        else v_service.workshop_student_price_cents
      end,
      case when e.value ->> 'category' = 'student' then e.value ->> 'id_path' end,
      case when e.value ->> 'category' = 'student' then 'pending'::public.id_review_status end
    from jsonb_array_elements(p_attendees) with ordinality e;
  end if;

  return query select v_booking_id, v_reference, v_status, v_deposit, v_hold;
end;
$function$;
