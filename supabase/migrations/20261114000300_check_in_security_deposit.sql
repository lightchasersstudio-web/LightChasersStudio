-- Shoot-day check-in and the security deposit (owner request 2026-11-14, Studio
-- Policy 1.3, 2.3, 2.5, 3.9). Staff tick each step on the "Today" page or the
-- booking page; who did what is in the audit log.

-- ---------------------------------------------------------------------------
-- 1. Check-in steps
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column id_checked_at timestamptz,
  add column inspected_in_at timestamptz,
  add column inspected_out_at timestamptz;

comment on column public.bookings.id_checked_at is
  'The renter showed a valid ID on arrival (policy 2.5).';
comment on column public.bookings.inspected_in_at is
  'Check-in inspection signed off with the renter (policy 2.3).';
comment on column public.bookings.inspected_out_at is
  'Check-out inspection signed off with the renter (policy 2.3).';

-- ---------------------------------------------------------------------------
-- 2. Refundable security deposit for messy materials and pets (policy 3.9).
--    Not part of the booking's price: it is held and given back, less any
--    cleaning or repair costs (kept_cents = collected − returned).
-- ---------------------------------------------------------------------------
alter table public.business_settings
  add column security_deposit_cents integer not null default 200000
    check (security_deposit_cents between 0 and 10000000);

comment on column public.business_settings.security_deposit_cents is
  'Refundable security deposit for messy materials or pets (policy 3.9), suggested when collecting.';

alter table public.bookings
  add column security_deposit_cents integer
    check (security_deposit_cents > 0 and security_deposit_cents <= 10000000),
  add column security_deposit_method text
    check (security_deposit_method in ('gcash', 'maya', 'bank_transfer', 'cash')),
  add column security_deposit_collected_at timestamptz,
  add column security_deposit_returned_cents integer,
  add column security_deposit_returned_at timestamptz,
  add column security_deposit_note text check (char_length(security_deposit_note) <= 200),
  -- Collected: amount, method and time together. Returned: never more than
  -- collected, and only after collecting.
  add constraint bookings_security_deposit_collected check (
    (security_deposit_cents is null)
      = (security_deposit_method is null)
    and (security_deposit_cents is null) = (security_deposit_collected_at is null)
  ),
  add constraint bookings_security_deposit_returned check (
    (security_deposit_returned_cents is null) = (security_deposit_returned_at is null)
    and (
      security_deposit_returned_cents is null
      or (
        security_deposit_cents is not null
        and security_deposit_returned_cents between 0 and security_deposit_cents
      )
    )
  );

comment on column public.bookings.security_deposit_returned_cents is
  'Given back at check-out; the rest (collected − returned) was kept for cleaning or repairs, explained in security_deposit_note.';
