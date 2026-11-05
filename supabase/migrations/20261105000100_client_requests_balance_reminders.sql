-- Client self-service on /booking (owner request 2026-11-05):
--   1. Pay the remaining balance online: payments.purpose marks a balance checkout,
--      and mark_booking_paid records it without flagging a refund review.
--   2. "Ask to reschedule": booking_requests, read and resolved by admins.
--   3. Shoot reminders: bookings.reminder_sent_at, cleared when the time moves.

-- 1. Balance payments ---------------------------------------------------------
alter table public.payments
  add column purpose text not null default 'deposit'
  constraint payments_purpose_check check (purpose in ('deposit', 'balance'));

comment on column public.payments.purpose is
  'deposit = the payment that holds a new booking; balance = paid later from the client''s booking page.';

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

-- 2. Reschedule requests ------------------------------------------------------
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null default 'reschedule' constraint booking_requests_kind_check check (kind in ('reschedule')),
  preferred text constraint booking_requests_preferred_length check (char_length(preferred) <= 300),
  message text not null constraint booking_requests_message_length check (char_length(message) between 1 and 1000),
  status text not null default 'open' constraint booking_requests_status_check check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);

comment on table public.booking_requests is
  'Requests clients send from /booking (e.g. a new date). Inserted by the server with the service role; admins read and resolve them.';

create index booking_requests_booking_idx on public.booking_requests (booking_id, created_at desc);
create index booking_requests_open_idx on public.booking_requests (created_at desc) where status = 'open';

alter table public.booking_requests enable row level security;

create policy "booking_requests: admin read"
on public.booking_requests for select to authenticated
using ((select public.is_admin()));

create policy "booking_requests: admin update"
on public.booking_requests for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- 3. Reminders ----------------------------------------------------------------
alter table public.bookings add column reminder_sent_at timestamptz;

comment on column public.bookings.reminder_sent_at is
  'When the "see you soon" email went out; cleared when the booking''s time changes.';

create function public.reset_booking_reminder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.start_at is distinct from old.start_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.reset_booking_reminder() from public, anon, authenticated;

create trigger bookings_reset_reminder
before update of start_at on public.bookings
for each row execute function public.reset_booking_reminder();

-- Anonymising a client also removes what they wrote in requests.
create or replace function public.anonymise_client(p_client_id uuid)
returns table (student_id_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_ids uuid[];
  v_paths text[];
begin
  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    raise exception 'client_not_found';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.client_id = p_client_id
      and b.status in ('pending_payment', 'pending', 'confirmed')
      and b.end_at > now()
  ) then
    raise exception 'client_has_upcoming_booking';
  end if;

  select coalesce(array_agg(b.id), '{}') into v_booking_ids
  from public.bookings b where b.client_id = p_client_id;

  select coalesce(array_agg(a.student_id_path), '{}') into v_paths
  from public.booking_attendees a
  where a.booking_id = any (v_booking_ids) and a.student_id_path is not null;

  update public.clients
  set full_name = 'Deleted client', email = null, phone = '0000000',
      consent_version = 'anonymised'
  where id = p_client_id;

  update public.bookings
  set contact_name = 'Deleted client', contact_phone = '0000000', messenger = null,
      location = null, special_requests = null, admin_notes = null
  where id = any (v_booking_ids);

  delete from public.booking_requests where booking_id = any (v_booking_ids);

  update public.booking_attendees
  set full_name = 'Deleted', phone = null, address = null, student_id_path = null
  where booking_id = any (v_booking_ids);

  -- PayMongo payloads carry the billing name, email and phone.
  update public.payment_webhook_events e
  set payload = jsonb_build_object('anonymised', true)
  where e.payload #>> '{data,attributes,data,id}' in (
          select p.provider_checkout_id from public.payments p
          where p.booking_id = any (v_booking_ids) and p.provider_checkout_id is not null)
     or e.payload ->> 'reference' in (
          select b.reference_code from public.bookings b where b.id = any (v_booking_ids));
  update public.payments set raw = null where booking_id = any (v_booking_ids);

  -- History entries can quote names and contact details.
  update public.audit_logs l
  set metadata = (l.metadata - array['contact_name', 'contact_phone', 'attendee'])
    || case when l.metadata ? 'before'
         then jsonb_build_object('before', (l.metadata -> 'before')
           - array['contact_name', 'contact_phone', 'location', 'special_requests', 'messenger'])
         else '{}'::jsonb end
    || case when l.metadata ? 'after'
         then jsonb_build_object('after', (l.metadata -> 'after')
           - array['contact_name', 'contact_phone', 'location', 'special_requests', 'messenger'])
         else '{}'::jsonb end
  where l.entity = 'booking' and l.entity_id = any (v_booking_ids::text[]);

  return query select unnest(v_paths);
end;
$$;

revoke execute on function public.anonymise_client(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_client(uuid) to service_role;
