-- Booking functions.
--   expire_stale_holds(): lapses unpaid holds (pg_cron + called by create_booking).
--   get_busy_ranges():    PII-free busy intervals for the public slot picker.
--   create_booking():     atomic client upsert + booking insert with all business
--                         rules enforced server-side. SERVICE ROLE ONLY — the server
--                         action verifies Turnstile/rate limits before calling it, so
--                         exposing it to anon would let bots bypass those checks.
--
-- create_booking raises P0001 with one of these messages (mapped to UI copy in the app):
--   service_unavailable, invalid_start_time, too_soon, too_far,
--   blackout_date, outside_business_hours, slot_unavailable

-- ---------------------------------------------------------------------------
create function public.expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  with expired as (
    update public.bookings
    set status = 'expired'
    where status = 'pending_payment' and hold_expires_at <= now()
    returning id
  )
  select count(*) into expired_count from expired;

  update public.payments p
  set status = 'expired'
  from public.bookings b
  where p.booking_id = b.id and b.status = 'expired' and p.status = 'pending';

  return expired_count;
end;
$$;

revoke execute on function public.expire_stale_holds() from public, anon, authenticated;
grant execute on function public.expire_stale_holds() to service_role;

-- ---------------------------------------------------------------------------
create function public.get_busy_ranges(p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, blocked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.start_at, b.blocked_until
  from public.bookings b
  where b.status in ('pending_payment', 'pending', 'confirmed', 'completed')
    and (b.status <> 'pending_payment' or b.hold_expires_at > now())
    and b.start_at < p_to
    and b.blocked_until > p_from
    -- bound the scan: the slot picker never asks for more than ~2 months at once
    and p_to > p_from
    and p_to - p_from <= interval '62 days'
  order by b.start_at;
$$;

revoke execute on function public.get_busy_ranges(timestamptz, timestamptz) from public;
grant execute on function public.get_busy_ranges(timestamptz, timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
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
  p_special_requests text default null
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

  select * into strict v_settings from public.business_settings where id;

  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'service_unavailable';
  end if;

  -- Time rules, evaluated in the business timezone.
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

  -- Price & deposit come from the database, never from the client.
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

  -- One client row per email. Public submissions never overwrite an existing
  -- client's name/phone (that would let anyone edit someone else's record);
  -- only the consent record is refreshed. Per-booking contact details are
  -- snapshotted on the booking itself.
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
        contact_name, contact_phone, preferred_contact, location, participants,
        special_requests, price_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, v_status, p_start_at, v_end_at, v_blocked_until,
        trim(p_full_name), trim(p_phone), p_preferred_contact, nullif(trim(p_location), ''),
        coalesce(p_participants, 1), nullif(trim(p_special_requests), ''),
        v_service.price_cents, v_deposit, v_hold
      )
      returning id into v_booking_id;
      exit;
    exception
      when exclusion_violation then
        raise exception 'slot_unavailable';
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
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text
) from public, anon, authenticated;
grant execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text
) to service_role;
