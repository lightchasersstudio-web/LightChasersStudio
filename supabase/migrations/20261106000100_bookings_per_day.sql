-- Owner decision (2026-11-06): one booking per day for now, more later.
--
-- business_settings.allow_multiple_per_day (off) = only one booking per day.
-- Turned on, up to max_bookings_per_day bookings may share a day (times still
-- can't overlap beyond max_concurrent_bookings). services.ignores_day_limit
-- marks packages like the Photobooth that neither count toward the limit nor
-- are refused by it. Workshops never count (they have their own seats).
--
-- Enforced by a trigger on bookings, so create_booking, admin_create_booking
-- and admin_update_booking all follow it; mark_booking_paid flags a late
-- payment for a day that filled up meanwhile instead of refusing it.

alter table public.business_settings
  add column allow_multiple_per_day boolean not null default false,
  add column max_bookings_per_day integer not null default 2
    check (max_bookings_per_day between 1 and 20);

alter table public.services
  add column ignores_day_limit boolean not null default false;

comment on column public.business_settings.allow_multiple_per_day is
  'Off = one booking per day. On = up to max_bookings_per_day.';
comment on column public.services.ignores_day_limit is
  'Doesn''t count toward (and isn''t refused by) the bookings-per-day limit, e.g. the Photobooth.';

-- Bookings allowed on one day right now.
create function public.bookings_per_day_limit()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.allow_multiple_per_day then s.max_bookings_per_day else 1 end
  from public.business_settings s
  where s.id;
$$;

revoke execute on function public.bookings_per_day_limit() from public;
grant execute on function public.bookings_per_day_limit() to anon, authenticated, service_role;

-- Raises day_full if one more booking of p_service_id on p_start's (Manila)
-- day would go over the limit. Same advisory lock as assert_capacity, so two
-- bookings for the last place on a day can't both get in.
create function public.assert_day_limit(
  p_start timestamptz,
  p_service_id uuid,
  p_exclude uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_day_start timestamptz;
  v_count integer;
begin
  if exists (
    select 1 from public.services s
    where s.id = p_service_id and (s.ignores_day_limit or s.category = 'workshop')
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(4242001);

  select s.timezone into strict v_tz from public.business_settings s where s.id;
  v_day_start := ((p_start at time zone v_tz)::date)::timestamp at time zone v_tz;

  select count(*) into v_count
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.start_at >= v_day_start
    and b.start_at < v_day_start + interval '1 day'
    and (p_exclude is null or b.id <> p_exclude)
    and s.category <> 'workshop'
    and not s.ignores_day_limit
    and public.booking_holds_place(b.status, b.hold_expires_at);

  if v_count + 1 > public.bookings_per_day_limit() then
    raise exception 'day_full';
  end if;
end;
$$;

revoke execute on function public.assert_day_limit(timestamptz, uuid, uuid) from public;
grant execute on function public.assert_day_limit(timestamptz, uuid, uuid) to service_role;

-- New bookings, and bookings moved to another day or package. Status-only
-- changes (paying, confirming) never trip it; late payments are handled in
-- mark_booking_paid below.
create function public.bookings_check_day_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if not public.booking_holds_place(new.status, new.hold_expires_at) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.service_id = old.service_id then
    select s.timezone into strict v_tz from public.business_settings s where s.id;
    if (new.start_at at time zone v_tz)::date = (old.start_at at time zone v_tz)::date then
      return new;
    end if;
  end if;
  perform public.assert_day_limit(new.start_at, new.service_id, new.id);
  return new;
end;
$$;

revoke execute on function public.bookings_check_day_limit() from public;

create trigger bookings_check_day_limit
  before insert or update of start_at, service_id on public.bookings
  for each row execute function public.bookings_check_day_limit();

-- Days (Manila dates) in [p_from, p_to] that have no place left, for the
-- slot pickers. No personal data; at most 62 days per call.
create function public.get_full_days(p_from date, p_to date, p_exclude uuid default null)
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select s.timezone as tz, public.bookings_per_day_limit() as day_limit
    from public.business_settings s
    where s.id
  )
  select (b.start_at at time zone st.tz)::date
  from public.bookings b
  join public.services s on s.id = b.service_id
  cross join settings st
  where p_to >= p_from
    and p_to - p_from <= 62
    and b.start_at >= p_from::timestamp at time zone st.tz
    and b.start_at < (p_to + 1)::timestamp at time zone st.tz
    and (p_exclude is null or b.id <> p_exclude)
    and s.category <> 'workshop'
    and not s.ignores_day_limit
    and public.booking_holds_place(b.status, b.hold_expires_at)
  group by 1, st.day_limit
  having count(*) >= st.day_limit;
$$;

revoke execute on function public.get_full_days(date, date, uuid) from public;
grant execute on function public.get_full_days(date, date, uuid) to anon, authenticated, service_role;

-- mark_booking_paid: as in 20261105000100, but a late payment for a day that
-- has filled up meanwhile is flagged for review like a taken time slot.
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
      perform public.assert_capacity(v_booking.start_at, v_booking.blocked_until, v_booking.id);
      perform public.assert_day_limit(v_booking.start_at, v_booking.service_id, v_booking.id);
      v_outcome := 'paid_late';
    exception
      when raise_exception then
        if sqlerrm not in ('slot_unavailable', 'day_full') then
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
