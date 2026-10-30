-- VAT added on top of online bookings. business_settings.vat_percent (default
-- 12, set 0 when not VAT-registered) applies to package + add-ons; the booking's
-- price_cents is the VAT-inclusive total and vat_cents records the VAT part.
-- The default deposit % is taken from that total; fixed package deposits stay.
-- Staff bookings (admin_create_booking) keep their typed price with no VAT added.

alter table public.business_settings
  add column vat_percent integer not null default 12 check (vat_percent between 0 and 50);

alter table public.bookings
  add column vat_cents integer not null default 0 check (vat_cents >= 0);

-- create_booking: same signature as 20261016000200_add_ons.sql, plus VAT.
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

  -- Each add-on at most once, and every one must still be offered.
  select coalesce(array_agg(distinct x), '{}') into v_add_on_ids
  from unnest(coalesce(p_add_on_ids, '{}')) x;
  select coalesce(sum(a.price_cents), 0) into v_add_ons_cents
  from public.add_ons a where a.id = any (v_add_on_ids) and a.is_active;
  if (select count(*) from public.add_ons a where a.id = any (v_add_on_ids) and a.is_active)
     <> cardinality(v_add_on_ids) then
    raise exception 'add_on_unavailable';
  end if;
  v_subtotal := v_service.price_cents + v_add_ons_cents;
  v_vat := round(v_subtotal * v_settings.vat_percent / 100.0)::integer;
  v_total := v_subtotal + v_vat;

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
        contact_name, contact_phone, preferred_contact, messenger, location, participants,
        special_requests, price_cents, vat_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, v_status, p_start_at, v_end_at, v_blocked_until,
        trim(p_full_name), trim(p_phone), p_preferred_contact, nullif(trim(p_messenger), ''),
        nullif(trim(p_location), ''), coalesce(p_participants, 1),
        nullif(trim(p_special_requests), ''), v_total, v_vat, v_deposit, v_hold
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
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[]
) to service_role;
