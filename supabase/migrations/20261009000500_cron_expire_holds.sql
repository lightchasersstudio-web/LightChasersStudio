-- Expire unpaid booking holds every minute so lapsed slots free up even when
-- nobody is booking. (create_booking also expires holds before inserting.)

create extension if not exists pg_cron;

select cron.schedule(
  'expire-stale-booking-holds',
  '* * * * *',
  $$select public.expire_stale_holds();$$
);
