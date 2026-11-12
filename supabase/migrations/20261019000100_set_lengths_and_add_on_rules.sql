-- Package lengths only where they matter (owner decision 2026-10-19).
--
-- * services.duration_minutes is now optional. Most packages have no set
--   length: a booking is just a start time, holds its start slot
--   (slot_interval_minutes, plus the buffer) and shows no end time. Packages
--   with a set length (the Photobooth, 4 hours) keep it, and their bookings
--   end at start + length + any time-adding add-ons.
-- * add_ons.extra_minutes: time an add-on adds to a package with a set length
--   (e.g. "Photobooth extension: +1 hour").
-- * add_ons.service_ids: the packages an add-on is offered with (empty = all).
-- * bookings.has_end_time: whether the booking has a real end time to show.
-- * bookings.participants: up to 10,000 people (events).

alter table public.services alter column duration_minutes drop not null;

alter table public.add_ons
  add column extra_minutes integer not null default 0 check (extra_minutes between 0 and 720),
  add column service_ids uuid[] not null default '{}';

alter table public.bookings
  add column has_end_time boolean not null default true;

alter table public.bookings drop constraint bookings_participants_check;
alter table public.bookings
  add constraint bookings_participants_check check (participants between 1 and 10000);

-- Existing catalog: only the Photobooth keeps a length.
update public.services set duration_minutes = null where slug <> 'photobooth';
update public.services set duration_minutes = 240 where slug = 'photobooth';

update public.bookings b
set has_end_time = false
from public.services s
where s.id = b.service_id and s.duration_minutes is null;

-- Extra photographer / videographer: not offered with the Photobooth, product,
-- maternity & newborn or family portrait packages.
update public.add_ons
set service_ids = coalesce(
  (select array_agg(s.id order by s.sort_order) from public.services s
   where s.slug not in ('photobooth', 'product-photography', 'maternity-newborn', 'family-portrait-session')),
  '{}'
)
where name in ('Extra photographer', 'Videographer');

-- Photobooth extensions (placeholder prices; the owner sets the real ones).
insert into public.add_ons (name, description, price_cents, extra_minutes, service_ids, is_active, sort_order)
select v.name, v.description, v.price_cents, v.extra_minutes, array[s.id], true, v.sort_order
from public.services s
cross join (values
  ('Photobooth extension: +1 hour', 'Keep the photobooth running one more hour.', 100000, 60, 10),
  ('Photobooth extension: +2 hours', 'Keep the photobooth running two more hours.', 200000, 120, 11)
) as v(name, description, price_cents, extra_minutes, sort_order)
where s.slug = 'photobooth';

-- ---------------------------------------------------------------------------
-- booking_length_minutes: how long a booking holds the calendar before the
-- buffer. Packages with a set length: length + time-adding add-ons. Others:
-- one slot. Internal: only called by the booking RPCs below.
-- ---------------------------------------------------------------------------
create function public.booking_length_minutes(
  p_duration_minutes integer,
  p_extra_minutes integer,
  p_slot_interval_minutes integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_duration_minutes is null then p_slot_interval_minutes
    else p_duration_minutes + coalesce(p_extra_minutes, 0)
  end;
$$;

revoke execute on function public.booking_length_minutes(integer, integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_booking: same signature. Add-ons must be offered with the chosen
-- package; time-adding add-ons lengthen a package with a set length.
-- ---------------------------------------------------------------------------
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
  p_add_on_ids uuid[] default null
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

  v_end_at := p_start_at + make_interval(mins => public.booking_length_minutes(
    v_service.duration_minutes, v_extra_minutes, v_settings.slot_interval_minutes));
  v_blocked_until := v_end_at + make_interval(mins => v_settings.buffer_minutes);
  v_local_start := p_start_at at time zone v_settings.timezone;
  v_local_end := v_end_at at time zone v_settings.timezone;

  if extract(second from v_local_start) <> 0
     or (extract(hour from v_local_start)::int * 60 + extract(minute from v_local_start)::int)
        % v_settings.slot_interval_minutes <> 0 then
    raise exception 'invalid_start_time';
  end if;

  if p_start_at < now() + make_interval(hours => v_settings.min_notice_hours) then
    raise exception 'too_soon';
  end if;

  if p_start_at > now() + make_interval(days => v_settings.max_advance_days) then
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

  perform public.assert_capacity(p_start_at, v_blocked_until);

  v_deposit := coalesce(
    v_service.deposit_cents,
    round(v_total * v_settings.default_deposit_percent / 100.0)::integer
  );

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
        v_reference, v_client_id, v_service.id, v_status, p_start_at, v_end_at, v_blocked_until,
        v_service.duration_minutes is not null, trim(p_full_name), trim(p_phone),
        p_preferred_contact, nullif(trim(p_messenger), ''), nullif(trim(p_location), ''),
        coalesce(p_participants, 1), nullif(trim(p_special_requests), ''), v_total, v_vat,
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

-- ---------------------------------------------------------------------------
-- staff_add_on_minutes: time added by the catalog add-ons in a staff p_add_ons
-- list (custom extras add none). Malformed input counts as none; the pricing
-- step rejects it afterwards. Internal.
-- ---------------------------------------------------------------------------
create function public.staff_add_on_minutes(p_add_ons jsonb)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(a.extra_minutes), 0)::integer
  from jsonb_array_elements(
    case when jsonb_typeof(p_add_ons) = 'array' then p_add_ons else '[]'::jsonb end
  ) e
  join public.add_ons a on a.id::text = e ->> 'add_on_id';
$$;

revoke execute on function public.staff_add_on_minutes(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_create_booking: same signature; length rules as create_booking.
-- Staff may add any add-on to any package.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_booking(
  p_full_name text,
  p_email text,
  p_phone text,
  p_preferred_contact public.contact_method,
  p_messenger text,
  p_service_id uuid,
  p_start_at timestamptz,
  p_price_cents integer,
  p_allow_outside_hours boolean,
  p_location text,
  p_participants integer,
  p_special_requests text,
  p_payment_provider text,
  p_payment_amount_cents integer,
  p_payment_reference text,
  p_admin_id uuid,
  p_add_ons jsonb default null
)
returns table (booking_id uuid, reference_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_settings public.business_settings%rowtype;
  v_service public.services%rowtype;
  v_email text := lower(nullif(trim(p_email), ''));
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_deposit integer;
  v_client_id uuid;
  v_reference text;
  v_booking_id uuid;
  v_attempt integer := 0;
begin
  perform public.expire_stale_holds();

  select * into strict v_settings from public.business_settings where id;

  -- Hidden packages are allowed: staff may book a retired or private package.
  select * into v_service from public.services where id = p_service_id;
  if not found then
    raise exception 'service_unavailable';
  end if;

  if p_price_cents is null or p_price_cents < 0 then
    raise exception 'invalid_price';
  end if;

  v_end_at := p_start_at + make_interval(mins => public.booking_length_minutes(
    v_service.duration_minutes, public.staff_add_on_minutes(p_add_ons),
    v_settings.slot_interval_minutes));
  v_blocked_until := v_end_at + make_interval(mins => v_settings.buffer_minutes);
  v_local_start := p_start_at at time zone v_settings.timezone;
  v_local_end := v_end_at at time zone v_settings.timezone;

  if extract(second from v_local_start) <> 0
     or (extract(hour from v_local_start)::int * 60 + extract(minute from v_local_start)::int)
        % v_settings.slot_interval_minutes <> 0 then
    raise exception 'invalid_start_time';
  end if;

  if not coalesce(p_allow_outside_hours, false) then
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
  end if;

  perform public.assert_capacity(p_start_at, v_blocked_until);

  v_deposit := least(
    coalesce(
      v_service.deposit_cents,
      round(p_price_cents * v_settings.default_deposit_percent / 100.0)::integer
    ),
    p_price_cents
  );

  if v_email is null then
    insert into public.clients (full_name, email, phone, preferred_contact, consent_given_at, consent_version)
    values (trim(p_full_name), null, trim(p_phone), p_preferred_contact, now(), 'admin-2026-10')
    returning id into v_client_id;
  else
    insert into public.clients as c (full_name, email, phone, preferred_contact, consent_given_at, consent_version)
    values (trim(p_full_name), v_email, trim(p_phone), p_preferred_contact, now(), 'admin-2026-10')
    on conflict ((lower(email))) do update
      set consent_given_at = excluded.consent_given_at,
          consent_version = excluded.consent_version
    returning c.id into v_client_id;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'BK-' || to_char(v_local_start, 'YYYY') || '-'
                   || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.bookings (
        reference_code, client_id, service_id, status, source, start_at, end_at, blocked_until,
        has_end_time, contact_name, contact_phone, preferred_contact, messenger, location,
        participants, special_requests, price_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, 'confirmed', 'admin', p_start_at, v_end_at,
        v_blocked_until, v_service.duration_minutes is not null, trim(p_full_name),
        trim(p_phone), p_preferred_contact, nullif(trim(p_messenger), ''),
        nullif(trim(p_location), ''), coalesce(p_participants, 1),
        nullif(trim(p_special_requests), ''), p_price_cents, v_deposit, null
      )
      returning id into v_booking_id;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  -- Add-ons chosen by staff: stored on the booking and added to the total.
  perform public.apply_booking_pricing(v_booking_id, p_price_cents, p_add_ons, false);

  if p_payment_provider is not null and coalesce(p_payment_amount_cents, 0) > 0 then
    if p_payment_provider not in ('gcash', 'cash') then
      raise exception 'invalid_payment';
    end if;
    insert into public.payments (booking_id, provider, amount_cents, status, paid_at, reference, recorded_by)
    values (
      v_booking_id, p_payment_provider, p_payment_amount_cents, 'paid', now(),
      nullif(trim(p_payment_reference), ''), p_admin_id
    );
  end if;

  return query select v_booking_id, v_reference;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_update_booking: same signature; length rules as above. The slot is
-- re-checked when the start or package changes, or the booking now runs later
-- (e.g. a photobooth extension was added). Shortening never needs a check.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_booking(
  p_booking_id uuid,
  p_service_id uuid,
  p_start_at timestamptz,
  p_package_cents integer,
  p_add_ons jsonb,
  p_charge_vat boolean,
  p_allow_outside_hours boolean,
  p_location text,
  p_participants integer,
  p_special_requests text,
  p_contact_name text,
  p_contact_phone text,
  p_preferred_contact public.contact_method,
  p_messenger text
)
returns table (booking_id uuid, reference_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking public.bookings%rowtype;
  v_settings public.business_settings%rowtype;
  v_service public.services%rowtype;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  perform public.expire_stale_holds();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'booking_not_editable';
  end if;

  select * into strict v_settings from public.business_settings where id;
  select * into v_service from public.services where id = p_service_id;
  if not found then
    raise exception 'service_unavailable';
  end if;

  v_end_at := p_start_at + make_interval(mins => public.booking_length_minutes(
    v_service.duration_minutes, public.staff_add_on_minutes(p_add_ons),
    v_settings.slot_interval_minutes));
  v_blocked_until := v_end_at + make_interval(mins => v_settings.buffer_minutes);

  if p_start_at <> v_booking.start_at
     or p_service_id <> v_booking.service_id
     or v_blocked_until > v_booking.blocked_until then
    v_local_start := p_start_at at time zone v_settings.timezone;
    v_local_end := v_end_at at time zone v_settings.timezone;

    if extract(second from v_local_start) <> 0
       or (extract(hour from v_local_start)::int * 60 + extract(minute from v_local_start)::int)
          % v_settings.slot_interval_minutes <> 0 then
      raise exception 'invalid_start_time';
    end if;

    if not coalesce(p_allow_outside_hours, false) then
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
    end if;

    perform public.assert_capacity(p_start_at, v_blocked_until, p_booking_id);
  end if;

  update public.bookings
  set service_id = v_service.id,
      start_at = p_start_at,
      end_at = v_end_at,
      blocked_until = v_blocked_until,
      has_end_time = v_service.duration_minutes is not null,
      contact_name = trim(p_contact_name),
      contact_phone = trim(p_contact_phone),
      preferred_contact = p_preferred_contact,
      messenger = nullif(trim(p_messenger), ''),
      location = nullif(trim(p_location), ''),
      participants = coalesce(p_participants, 1),
      special_requests = nullif(trim(p_special_requests), '')
  where id = p_booking_id;

  perform public.apply_booking_pricing(p_booking_id, p_package_cents, p_add_ons, p_charge_vat);

  return query select v_booking.id, v_booking.reference_code;
end;
$$;
