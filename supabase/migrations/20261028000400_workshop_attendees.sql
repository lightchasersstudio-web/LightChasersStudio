-- Workshop attendees (owner decision 2026-10-28): a workshop sign-up is for 1
-- to 3 people, and each one is named for their certificate. The names are kept
-- on the booking (bookings.attendees, a JSON list in order) for the admin.
--
-- create_booking gains p_attendees (workshops only; same as 20261028000300
-- otherwise). New codes: invalid_participants (outside 1-3), invalid_attendees.

alter table public.bookings
  add column attendees jsonb not null default '[]'
    constraint bookings_attendees_check check (jsonb_typeof(attendees) = 'array');

comment on column public.bookings.attendees is
  'Workshops: the names to print on each attendee''s certificate, in order.';

drop function public.create_booking(text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[], boolean);

create function public.create_booking(
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
  p_attendees text[] default null
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
  v_attendees jsonb := '[]';
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
  -- Workshops are priced per person (owner decision 2026-10-28).
  if v_workshop then
    -- Up to 3 people per sign-up, each named for their certificate. One person
    -- may leave the name out: the certificate uses the booker's name.
    if v_participants not between 1 and 3 then
      raise exception 'invalid_participants';
    end if;
    if v_participants = 1 and coalesce(cardinality(p_attendees), 0) = 0 then
      v_attendees := jsonb_build_array(trim(p_full_name));
    elsif coalesce(cardinality(p_attendees), 0) <> v_participants
       or exists (
         select 1 from unnest(p_attendees) a
         where a is null or char_length(trim(a)) not between 2 and 120
       ) then
      raise exception 'invalid_attendees';
    else
      select jsonb_agg(trim(a) order by i) into v_attendees
      from unnest(p_attendees) with ordinality as t(a, i);
    end if;
  end if;
  v_subtotal := v_service.price_cents * (case when v_workshop then v_participants else 1 end)
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
        participants, special_requests, price_cents, vat_cents, deposit_cents, hold_expires_at,
        attendees
      ) values (
        v_reference, v_client_id, v_service.id, v_status, v_start_at, v_end_at, v_blocked_until,
        v_workshop or v_service.duration_minutes is not null, trim(p_full_name), trim(p_phone),
        p_preferred_contact, nullif(trim(p_messenger), ''), nullif(trim(p_location), ''),
        v_participants, nullif(trim(p_special_requests), ''), v_total, v_vat,
        v_deposit, v_hold, v_attendees
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

revoke execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[], boolean, text[]
) from public, anon, authenticated;
grant execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[], boolean, text[]
) to service_role;
