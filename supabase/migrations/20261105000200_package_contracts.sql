-- A contract per package (owner request 2026-11-05): written in Admin → Services,
-- shown on the booking wizard's Review & pay step, and agreed to before paying.
-- The booking keeps the exact text the client agreed to, so editing the package's
-- contract later never changes what an earlier client signed.

alter table public.services
  add column contract text
  constraint services_contract_length check (char_length(contract) <= 30000);

comment on column public.services.contract is
  'Terms clients must agree to when booking this package online; null/empty = none.';

alter table public.bookings
  add column contract_text text,
  add column contract_accepted_at timestamptz,
  add constraint bookings_contract_pair check ((contract_text is null) = (contract_accepted_at is null));

comment on column public.bookings.contract_text is
  'The package contract exactly as the client agreed to it (online bookings).';
comment on column public.bookings.contract_accepted_at is
  'When the client ticked "I agree" on the Review & pay step.';
