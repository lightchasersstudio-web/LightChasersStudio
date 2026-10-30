-- Rate-limit counters only matter inside their window (minutes). Purge old rows
-- once a day so the table doesn't grow forever.

select cron.schedule(
  'purge-rate-limits',
  '17 19 * * *', -- 03:17 in Manila
  $$delete from public.rate_limits where window_start < now() - interval '1 day';$$
);
