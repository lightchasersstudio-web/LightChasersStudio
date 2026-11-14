-- Personal data kept 7 days after the booking (Studio Policy 7.2, owner request
-- 2026-11-14): "Personal details ... are stored for seven (7) days after the
-- booking date and then deleted, except records the studio is required by law
-- to keep (such as receipts and accounting records) or needs for an unresolved
-- damage or payment claim."
--
-- A daily job (/api/cron/privacy) anonymises every client returned by
-- clients_past_retention() with anonymise_client(), which keeps amounts, dates
-- and references (the accounting records). Receipts keep the payer's name.

-- ---------------------------------------------------------------------------
-- 1. How many days after the booking date (Settings → Booking rules; 0 = keep
--    until deleted by hand)
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column personal_data_days integer not null default 7
    check (personal_data_days between 0 and 3650);

comment on column public.business_settings.personal_data_days is
  'Client details are deleted this many days after their last booking date (policy 7.2). 0 = never automatically.';

-- ---------------------------------------------------------------------------
-- 2. Receipts are records the law requires: they keep who paid
-- ---------------------------------------------------------------------------
alter table public.payments add column received_from text
  check (char_length(received_from) <= 120);

comment on column public.payments.received_from is
  'Name on the receipt, copied from the booking when the payment is paid. Kept when the client is anonymised (accounting record).';

create function public.set_payment_received_from()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and new.received_from is null then
    select b.contact_name into new.received_from
    from public.bookings b where b.id = new.booking_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_payment_received_from() from public, anon, authenticated;

create trigger payments_received_from
before insert or update of status on public.payments
for each row execute function public.set_payment_received_from();

update public.payments p
set received_from = b.contact_name
from public.bookings b
where b.id = p.booking_id and p.status = 'paid' and p.received_from is null;

-- ---------------------------------------------------------------------------
-- 3. Clients whose details are due for deletion
-- ---------------------------------------------------------------------------
-- Due when every booking's date (Manila) is more than personal_data_days ago,
-- and nothing is still open: no booking waiting or going ahead, no payment
-- waiting for a refund check, no unpaid balance on a done booking (damage or
-- extra charges), no reschedule request waiting.
create function public.clients_past_retention()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select personal_data_days as days, timezone from public.business_settings where id
  )
  select c.id
  from public.clients c, s
  where s.days > 0
    and c.consent_version is distinct from 'anonymised'
    and exists (select 1 from public.bookings b where b.client_id = c.id)
    and not exists (
      select 1 from public.bookings b
      where b.client_id = c.id
        and (
          (b.end_at at time zone s.timezone)::date + s.days >= (now() at time zone s.timezone)::date
          or b.status in ('pending_payment', 'pending', 'confirmed')
          or b.needs_refund_review
          or (
            b.status = 'completed'
            and b.price_cents > (
              select coalesce(sum(p.amount_cents), 0) from public.payments p
              where p.booking_id = b.id and p.status = 'paid'
            )
          )
          or exists (
            select 1 from public.booking_requests r
            where r.booking_id = b.id and r.status = 'open'
          )
        )
    );
$$;

revoke execute on function public.clients_past_retention() from public, anon, authenticated;
grant execute on function public.clients_past_retention() to service_role;
