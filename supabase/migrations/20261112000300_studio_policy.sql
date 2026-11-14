-- Studio policy manual (owner request 2026-11-12):
--  1. Rescheduling & cancellation rules (policy 1.4, 1.6–1.8): no-shows,
--     why a booking was cancelled (client or force majeure), and whether the
--     client already used their one reschedule.
--  2. Extra charges after a shoot (3.2, 4.4, 5.1, 7.8): preset prices in
--     Settings, added to a booking as lines like the rescheduling fee.
--  4. Receipts (1.5): every paid payment gets a receipt number.

-- ---------------------------------------------------------------------------
-- 1. Rescheduling & cancellation
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column cancelled_at timestamptz,
  add column cancel_reason text
    constraint bookings_cancel_reason_check check (cancel_reason in ('client', 'force_majeure')),
  add column rescheduled_at timestamptz;

comment on column public.bookings.cancelled_at is
  'When it became cancelled or no_show (set by the status trigger); compared with start_at for the 48-hour rule.';
comment on column public.bookings.cancel_reason is
  'Cancelled by the client (down payment kept) or force majeure (studio cannot host: everything paid is refunded). Null = not recorded.';
comment on column public.bookings.rescheduled_at is
  'Staff moved it with the rescheduling fee ticked: the client has used their one reschedule (policy 1.4). Free force-majeure moves leave it null.';

-- Same rules as before, plus confirmed → no_show, and the time it was closed.
create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending_payment' and new.status in ('pending', 'expired', 'cancelled')) or
    (old.status = 'pending'         and new.status in ('confirmed', 'declined', 'cancelled')) or
    (old.status = 'confirmed'       and new.status in ('completed', 'cancelled', 'no_show')) or
    -- late payment for a lapsed hold, only if the slot is still free
    (old.status = 'expired'         and new.status = 'pending')
  ) then
    raise exception 'invalid booking status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status <> 'pending_payment' then
    new.hold_expires_at := null;
  end if;
  if new.status in ('cancelled', 'no_show') then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Extra charges: preset prices (before VAT, like the rescheduling fee)
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column cleaning_fee_cents integer not null default 50000
    check (cleaning_fee_cents between 0 and 10000000),
  add column backdrop_paper_yard_cents integer not null default 60000
    check (backdrop_paper_yard_cents between 0 and 10000000),
  add column extra_person_cents integer not null default 50000
    check (extra_person_cents between 0 and 10000000),
  add column storage_day_cents integer not null default 5000
    check (storage_day_cents between 0 and 10000000);

-- Adds one charge line to a booking and recomputes its total (VAT too, when the
-- booking pays VAT). SERVICE ROLE ONLY, after assertAdmin().
create function public.admin_add_booking_charge(
  p_booking_id uuid,
  p_name text,
  p_price_cents integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_lines jsonb;
  v_lines_cents integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;
  if v_booking.status not in ('pending', 'confirmed', 'completed') then
    raise exception 'booking_closed';
  end if;
  if p_price_cents is null or p_price_cents <= 0 then
    raise exception 'invalid_price';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'add_on_id', l.add_on_id, 'name', l.name, 'price_cents', l.price_cents
    ) order by l.created_at, l.id), '[]'::jsonb),
    coalesce(sum(l.price_cents), 0)
  into v_lines, v_lines_cents
  from public.booking_add_ons l where l.booking_id = p_booking_id;

  perform public.apply_booking_pricing(
    p_booking_id,
    v_booking.price_cents - v_booking.vat_cents - v_lines_cents,
    v_lines || jsonb_build_array(jsonb_build_object(
      'add_on_id', null, 'name', trim(p_name), 'price_cents', p_price_cents
    )),
    v_booking.vat_cents > 0
  );
end;
$$;

revoke execute on function public.admin_add_booking_charge(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_add_booking_charge(uuid, text, integer) to service_role;

-- Removes one extra line (a charge or the rescheduling fee; never a catalogue
-- add-on) and recomputes the total. SERVICE ROLE ONLY, after assertAdmin().
create function public.admin_remove_booking_charge(p_booking_id uuid, p_line_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_lines jsonb;
  v_lines_cents integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;
  if v_booking.status not in ('pending', 'confirmed', 'completed') then
    raise exception 'booking_closed';
  end if;
  if not exists (
    select 1 from public.booking_add_ons
    where id = p_line_id and booking_id = p_booking_id and add_on_id is null
  ) then
    raise exception 'charge_not_found';
  end if;

  select coalesce(sum(l.price_cents), 0) into v_lines_cents
  from public.booking_add_ons l where l.booking_id = p_booking_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'add_on_id', l.add_on_id, 'name', l.name, 'price_cents', l.price_cents
    ) order by l.created_at, l.id), '[]'::jsonb)
  into v_lines
  from public.booking_add_ons l where l.booking_id = p_booking_id and l.id <> p_line_id;

  perform public.apply_booking_pricing(
    p_booking_id,
    v_booking.price_cents - v_booking.vat_cents - v_lines_cents,
    v_lines,
    v_booking.vat_cents > 0
  );
end;
$$;

revoke execute on function public.admin_remove_booking_charge(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_remove_booking_charge(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Receipts: AR-2026-00001, numbered when a payment becomes paid
-- ---------------------------------------------------------------------------
create sequence public.receipt_number_seq;
revoke all on sequence public.receipt_number_seq from public, anon, authenticated;

alter table public.payments
  add column receipt_number text constraint payments_receipt_number_key unique;

comment on column public.payments.receipt_number is
  'Acknowledgement receipt number (AR-<Manila year of payment>-<running number>), set once when the payment is paid.';

create function public.set_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and new.receipt_number is null then
    new.receipt_number := 'AR-'
      || to_char(coalesce(new.paid_at, now()) at time zone 'Asia/Manila', 'YYYY') || '-'
      || lpad(nextval('public.receipt_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

revoke execute on function public.set_receipt_number() from public, anon, authenticated;

create trigger payments_receipt_number
before insert or update of status on public.payments
for each row execute function public.set_receipt_number();

-- Payments already received get numbers in the order they were paid.
do $$
declare
  r record;
begin
  for r in
    select id from public.payments
    where status = 'paid' and receipt_number is null
    order by coalesce(paid_at, created_at), id
  loop
    update public.payments
    set receipt_number = 'AR-'
      || to_char(coalesce(paid_at, created_at) at time zone 'Asia/Manila', 'YYYY') || '-'
      || lpad(nextval('public.receipt_number_seq')::text, 5, '0')
    where id = r.id;
  end loop;
end;
$$;
