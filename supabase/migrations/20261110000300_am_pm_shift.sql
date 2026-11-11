-- AM/PM shift (owner request 2026-11-10): a long day, 9:30 AM to 10:00 PM
-- (12 hours 30 minutes), for staff who work both shifts. Picking it fills the
-- times and the day's rate with the AM/PM rate from Payroll settings (default
-- ₱650); both stay editable. Pays the day's rate.

-- 1. The default rate, editable in Payroll settings.
alter table public.contribution_settings
  add column am_pm_rate numeric(12, 2) not null default 650
    check (am_pm_rate >= 0 and am_pm_rate <= 1000000);

comment on column public.contribution_settings.am_pm_rate is
  'Pesos filled in as the day''s rate when an AM/PM shift (9:30 AM–10:00 PM) is recorded.';

-- 2. The status, with times like AM and PM.
alter table public.attendance_logs drop constraint attendance_logs_status_check;
alter table public.attendance_logs add constraint attendance_logs_status_check
  check (status in ('present', 'absent', 'leave', 'holiday', 'am', 'pm', 'am_pm', 'rest_day'));

alter table public.attendance_logs drop constraint attendance_logs_times;
alter table public.attendance_logs add constraint attendance_logs_times check (
  case
    when status in ('present', 'am', 'pm', 'am_pm')
      then time_in is not null and time_out is not null and time_out <> time_in
    else time_in is null and time_out is null
  end
);

-- 3. "Edited": AM/PM are 8 hours, AM/PM (both) is 12 h 30 m. A generated
-- column can't be altered, so it's rebuilt (it holds no data of its own).
alter table public.attendance_logs drop column time_out_edited;
alter table public.attendance_logs
  add column time_out_edited boolean generated always as (
    time_in is not null
    and time_out is not null
    and case status
      when 'am' then time_out <> time_in + interval '8 hours'
      when 'pm' then time_out <> time_in + interval '8 hours'
      when 'am_pm' then time_out <> time_in + interval '12 hours 30 minutes'
      else false
    end
  ) stored;

comment on column public.attendance_logs.time_out_edited is
  'A shift whose time out was changed from its length (AM/PM 8 h, AM/PM both 12 h 30 m).';

-- 4. A record saved without a rate: AM/PM uses the AM/PM rate, others the
-- employee's current daily rate.
create or replace function public.attendance_logs_fill_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.daily_rate is null then
    if new.status = 'am_pm' then
      select s.am_pm_rate into new.daily_rate from public.contribution_settings s;
    else
      new.daily_rate := public.employee_daily_rate(new.employee_id);
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.attendance_logs_fill_rate() from public;
