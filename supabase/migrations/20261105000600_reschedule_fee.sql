-- Rescheduling fee per package (owner request 2026-11-05): set in Admin →
-- Services. When staff move a client's booking to a new date or time, the fee
-- is added to that booking as a "Rescheduling fee" line (like an add-on), so it
-- counts towards the total, VAT and balance. 0 = rescheduling is free.

alter table public.services
  add column reschedule_fee_cents integer not null default 0
  constraint services_reschedule_fee_check check (reschedule_fee_cents between 0 and 100000000);

comment on column public.services.reschedule_fee_cents is
  'Fee (before VAT) added to a booking of this package when it is moved to a new date or time. 0 = free.';
