-- No-show (studio policy 1.7, owner request 2026-11-12): the client didn't come
-- to a confirmed booking. The down payment is kept and it can't be rescheduled.
-- On its own migration: a new enum value can't be used in the same transaction
-- that adds it (the rules that use it are in 20261112000300).

alter type public.booking_status add value if not exists 'no_show' after 'completed';
