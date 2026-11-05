-- Booking management: staff can change a booking after it's made (time, package,
-- add-ons, price, VAT, details), add add-ons when booking a client in, and the
-- owner can permanently delete a booking that has no real payments.

-- ---------------------------------------------------------------------------
-- apply_booking_pricing: replaces a booking's add-ons and recomputes its total.
-- p_add_ons: [{ "add_on_id": uuid|null, "name": text, "price_cents": int }]
-- (a null/unknown id is a custom extra). Total = package + add-ons (+ VAT when
-- p_charge_vat, same rounding as src/lib/booking/pricing.ts). The deposit never
-- exceeds the new total. Internal: only called by the RPCs below.
-- ---------------------------------------------------------------------------
create function public.apply_booking_pricing(
  p_booking_id uuid,
  p_package_cents integer,
  p_add_ons jsonb,
  p_charge_vat boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_items jsonb := coalesce(p_add_ons, '[]'::jsonb);
  v_add_ons integer;
  v_vat_percent integer;
  v_subtotal integer;
  v_vat integer;
  v_total integer;
begin
  if p_package_cents is null or p_package_cents < 0 or p_package_cents > 100000000 then
    raise exception 'invalid_price';
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 20 or exists (
    select 1 from jsonb_array_elements(v_items) e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 'name') is distinct from 'string'
       or char_length(trim(e ->> 'name')) not between 2 and 80
       or jsonb_typeof(e -> 'price_cents') is distinct from 'number'
       or (e ->> 'price_cents')::numeric < 0
       or (e ->> 'price_cents')::numeric > 100000000
       or (e ->> 'price_cents')::numeric <> trunc((e ->> 'price_cents')::numeric)
  ) then
    raise exception 'invalid_add_ons';
  end if;

  delete from public.booking_add_ons where booking_id = p_booking_id;
  insert into public.booking_add_ons (booking_id, add_on_id, name, price_cents)
  select p_booking_id, a.id, trim(e ->> 'name'), (e ->> 'price_cents')::integer
  from jsonb_array_elements(v_items) e
  -- Compared as text so a malformed id simply becomes a custom extra.
  left join public.add_ons a on a.id::text = e ->> 'add_on_id';

  select coalesce(sum(price_cents), 0) into v_add_ons
  from public.booking_add_ons where booking_id = p_booking_id;
  select vat_percent into strict v_vat_percent from public.business_settings where id;

  v_subtotal := p_package_cents + v_add_ons;
  v_vat := case when coalesce(p_charge_vat, false)
    then round(v_subtotal * v_vat_percent / 100.0)::integer else 0 end;
  v_total := v_subtotal + v_vat;

  update public.bookings
  set price_cents = v_total, vat_cents = v_vat, deposit_cents = least(deposit_cents, v_total)
  where id = p_booking_id;
end;
$$;

revoke execute on function public.apply_booking_pricing(uuid, integer, jsonb, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_create_booking: same as before, plus p_add_ons.
-- ---------------------------------------------------------------------------
drop function public.admin_create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, integer, boolean, text,
  integer, text, text, integer, text, uuid
);

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

revoke execute on function public.admin_create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, integer, boolean, text,
  integer, text, text, integer, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.admin_create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, integer, boolean, text,
  integer, text, text, integer, text, uuid, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- admin_update_booking: edit a pending/confirmed booking. SERVICE ROLE ONLY
-- (the server action checks the caller is an admin). Moving it (new time or
-- package) re-checks slot alignment, hours/blackouts (unless overridden) and
-- capacity, not counting the booking itself. Detail-only edits skip those checks.
-- ---------------------------------------------------------------------------
create function public.admin_update_booking(
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

  v_end_at := p_start_at + make_interval(mins => v_service.duration_minutes);
  v_blocked_until := v_end_at + make_interval(mins => v_settings.buffer_minutes);

  if p_start_at <> v_booking.start_at or p_service_id <> v_booking.service_id then
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

revoke execute on function public.admin_update_booking(
  uuid, uuid, timestamptz, integer, jsonb, boolean, boolean, text, integer, text, text, text,
  public.contact_method, text
) from public, anon, authenticated;
grant execute on function public.admin_update_booking(
  uuid, uuid, timestamptz, integer, jsonb, boolean, boolean, text, integer, text, text, text,
  public.contact_method, text
) to service_role;

-- ---------------------------------------------------------------------------
-- delete_booking: permanently remove a booking (tests, mistakes). SERVICE ROLE
-- ONLY; the server action allows the owner only. Refused when real money was
-- paid (anything but trial-mode payments): cancel those instead so the sales
-- records stay true. Also removes the client if this was their only booking.
-- ---------------------------------------------------------------------------
create function public.delete_booking(p_booking_id uuid)
returns table (reference_code text, contact_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;

  if exists (
    select 1 from public.payments p
    where p.booking_id = p_booking_id
      and p.status = 'paid'
      and coalesce(p.provider_payment_id, '') not like 'mock\_%'
  ) then
    raise exception 'booking_has_payments';
  end if;

  delete from public.payments where booking_id = p_booking_id;
  delete from public.bookings where id = p_booking_id; -- booking_add_ons cascade
  delete from public.clients c
  where c.id = v_booking.client_id
    and not exists (select 1 from public.bookings b where b.client_id = c.id);

  return query select v_booking.reference_code, v_booking.contact_name;
end;
$$;

revoke execute on function public.delete_booking(uuid) from public, anon, authenticated;
grant execute on function public.delete_booking(uuid) to service_role;
