-- Removing a staff account must not be blocked by payments they recorded:
-- keep the payment, forget who recorded it.
alter table public.payments
  drop constraint payments_recorded_by_fkey,
  add constraint payments_recorded_by_fkey
    foreign key (recorded_by) references auth.users (id) on delete set null;
