-- Owner decision (2026-10-17): one booking per time slot. A time (plus the
-- buffer after it) that anyone has booked or is paying for is refused to
-- everyone else; assert_capacity enforces it under concurrency. Still
-- adjustable in Admin → Settings → "Shoots that can run at the same time".
alter table public.business_settings alter column max_concurrent_bookings set default 1;
update public.business_settings set max_concurrent_bookings = 1 where id;
