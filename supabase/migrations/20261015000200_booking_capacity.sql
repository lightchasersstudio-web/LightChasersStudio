-- Phase 5: several shoots at once, admin-made bookings, manual payments,
-- PayMongo settlement and a Postgres rate limiter.
--
-- The studio can now run up to business_settings.max_concurrent_bookings shoots
-- at the same time, so the single-booking exclusion constraint is replaced by
-- assert_capacity(), which every booking path calls under one advisory lock.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column max_concurrent_bookings integer not null default 2
    check (max_concurrent_bookings between 1 and 10);

alter table public.bookings
  drop constraint bookings_no_overlap,
  add column messenger text check (char_length(messenger) <= 300),
  add column source text not null default 'online' check (source in ('online', 'admin')),
  -- set when a PayMongo payment lands after the hold lapsed and the slot filled up
  add column needs_refund_review boolean not null default false;

create index bookings_blocking_range_idx on public.bookings
  using gist (tstzrange(start_at, blocked_until, '[)'));

-- Staff may book clients who only gave a phone number / Messenger.
alter table public.clients
  alter column email drop not null,
  drop constraint clients_email_check,
  add constraint clients_email_check
    check (email is null or (char_length(email) between 3 and 254 and email like '%_@_%'));

alter table public.payments
  add constraint payments_provider_check check (provider in ('paymongo', 'gcash', 'cash')),
  add column reference text check (char_length(reference) <= 100),
  add column recorded_by uuid references auth.users (id);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
-- No policies: only the service role (via hit_rate_limit) touches it.
alter table public.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- assert_capacity: raises slot_unavailable if one more booking in
-- [p_start, p_blocked_until) would exceed max_concurrent_bookings at any instant.
-- Takes a transaction-wide advisory lock so concurrent bookings are counted one
-- after another (the lock is held until the caller's transaction ends).
-- ---------------------------------------------------------------------------
create function public.assert_capacity(
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
    where tstzrange(b.start_at, b.blocked_until, '[)') && tstzrange(p_start, p_blocked_until, '[)')
      and (p_exclude is null or b.id <> p_exclude)
      and (
        b.status in ('pending', 'confirmed', 'completed')
        or (b.status = 'pending_payment' and b.hold_expires_at > now())
      )
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

revoke execute on function public.assert_capacity(timestamptz, timestamptz, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_booking (public, via the server action): adds p_messenger and uses
-- assert_capacity instead of the old exclusion constraint.
-- ---------------------------------------------------------------------------
drop function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text
);

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
  p_messenger text default null
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

  v_end_at := p_start_at + make_interval(mins => v_service.duration_minutes);
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
    round(v_service.price_cents * v_settings.default_deposit_percent / 100.0)::integer
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
        contact_name, contact_phone, preferred_contact, messenger, location, participants,
        special_requests, price_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, v_status, p_start_at, v_end_at, v_blocked_until,
        trim(p_full_name), trim(p_phone), p_preferred_contact, nullif(trim(p_messenger), ''),
        nullif(trim(p_location), ''), coalesce(p_participants, 1),
        nullif(trim(p_special_requests), ''), v_service.price_cents, v_deposit, v_hold
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

  return query select v_booking_id, v_reference, v_status, v_deposit, v_hold;
end;
$$;

revoke execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- admin_create_booking: staff book a client in. SERVICE ROLE ONLY; the server
-- action checks the caller is an admin first. Confirmed immediately, ignores the
-- notice/advance window, checks hours/blackouts unless overridden, and never
-- exceeds capacity. Email is optional; an optional payment is recorded as paid.
-- ---------------------------------------------------------------------------
create function public.admin_create_booking(
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
  p_admin_id uuid
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

  v_end_at := p_start_at + make_interval(mins => v_service.duration_minutes);
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
        contact_name, contact_phone, preferred_contact, messenger, location, participants,
        special_requests, price_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, 'confirmed', 'admin', p_start_at, v_end_at,
        v_blocked_until, trim(p_full_name), trim(p_phone), p_preferred_contact,
        nullif(trim(p_messenger), ''), nullif(trim(p_location), ''), coalesce(p_participants, 1),
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

revoke execute on function public.admin_create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, integer, boolean, text,
  integer, text, text, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.admin_create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, integer, boolean, text,
  integer, text, text, integer, text, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- mark_booking_paid: settles a PayMongo checkout (called by the verified webhook).
-- Idempotent per PayMongo payment id. A payment that lands after the hold lapsed
-- is kept (pending) when capacity allows, otherwise kept AND flagged so staff can
-- refund or rebook: money is never silently dropped.
-- Outcomes: paid | paid_late | needs_review | duplicate | already_settled | unknown_booking
-- ---------------------------------------------------------------------------
create function public.mark_booking_paid(
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

  if v_booking.status = 'pending_payment' then
    update public.bookings set status = 'pending' where id = v_booking.id;
    v_outcome := 'paid';
  elsif v_booking.status = 'expired' then
    begin
      perform public.assert_capacity(v_booking.start_at, v_booking.blocked_until, v_booking.id);
      v_outcome := 'paid_late';
    exception
      when raise_exception then
        if sqlerrm <> 'slot_unavailable' then
          raise;
        end if;
        v_outcome := 'needs_review';
    end;
    update public.bookings
    set status = 'pending', needs_refund_review = (v_outcome = 'needs_review')
    where id = v_booking.id;
  else
    v_outcome := 'already_settled';
  end if;

  return query select v_booking.id, v_outcome;
end;
$$;

revoke execute on function public.mark_booking_paid(text, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_booking_paid(text, text, text, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- hit_rate_limit: fixed-window counter. Returns true while the key is within
-- p_limit hits per p_window_seconds.
-- shortcut: old keys are never purged; add a cleanup to the cron job if the table grows.
-- ---------------------------------------------------------------------------
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case
          when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1
          else r.hits + 1
        end,
        window_start = case
          when r.window_start <= now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
