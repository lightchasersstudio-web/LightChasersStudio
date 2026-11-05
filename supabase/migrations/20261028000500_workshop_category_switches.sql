-- Workshop categories on/off (owner decision 2026-10-28): each price category
-- (regular, early bird, student) can be switched off on its own, e.g. early
-- bird only for now. A category that's off isn't offered on the site, and
-- create_booking refuses it (category_unavailable). Prices stay as they are
-- (regular = the workshop price).
--
-- create_booking: same as 20261028000400 apart from the category price.

alter table public.services
  add column workshop_regular_enabled boolean not null default true,
  add column workshop_early_bird_enabled boolean not null default true,
  add column workshop_student_enabled boolean not null default true;

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
  p_pay_in_full boolean default null,
  p_attendees jsonb default null
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

  if v_workshop then
    insert into public.booking_attendees (
      booking_id, position, full_name, category, price_cents, student_id_path, id_status
    )
    select
      v_booking_id,
      e.ordinality,
      trim(e.value ->> 'name'),
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
$$;
