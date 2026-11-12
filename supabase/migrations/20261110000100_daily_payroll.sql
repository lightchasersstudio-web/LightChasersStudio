-- Daily payroll report, employee categories and AM / PM / rest-day statuses
-- (owner request 2026-11-10).
--
-- * employees.category: events, photobooth or studio. Existing staff stay
--   NULL ("Uncategorized") until the admin sets it; the app requires it on
--   every save. Make it NOT NULL in a later migration once every row has one.
-- * attendance_logs.status gains:
--     am / pm   - an 8-hour shift: time out = time in + 8 hours (filled in by
--                 the app, editable). Pays the full daily rate.
--     rest_day  - a scheduled day off: no times, pays nothing, not an absence.
--   Times stay Manila wall-clock `time` values: a time out earlier than the
--   time in is the next day (a PM shift past midnight), and the record
--   belongs to work_date, the day of the time in.
-- * attendance_logs.daily_rate: the employee's daily rate copied onto the
--   record when it's saved (or set by hand for one day). Reports use it, so
--   changing an employee's salary later doesn't change past days.
-- * attendance_logs.time_out_edited: an AM/PM record whose time out isn't
--   time in + 8 hours (someone left early or stayed late).

-- 1. Employee category -------------------------------------------------------
alter table public.employees
  add column category text
    check (category is null or category in ('events', 'photobooth', 'studio'));

comment on column public.employees.category is
  'Events, Photobooth or Studio (daily payroll report). Null = not set yet ("Uncategorized").';

-- 2. New statuses ------------------------------------------------------------
alter table public.attendance_logs drop constraint attendance_logs_status_check;
alter table public.attendance_logs add constraint attendance_logs_status_check
  check (status in ('present', 'absent', 'leave', 'holiday', 'am', 'pm', 'rest_day'));

-- Present, AM and PM days have both times; other days have none.
alter table public.attendance_logs drop constraint attendance_logs_times;
alter table public.attendance_logs add constraint attendance_logs_times check (
  case
    when status in ('present', 'am', 'pm')
      then time_in is not null and time_out is not null and time_out <> time_in
    else time_in is null and time_out is null
  end
);

-- time + interval wraps past midnight, the same way time_out does.
alter table public.attendance_logs
  add column time_out_edited boolean generated always as (
    status in ('am', 'pm')
    and time_in is not null
    and time_out is not null
    and time_out <> time_in + interval '8 hours'
  ) stored;

comment on column public.attendance_logs.time_out_edited is
  'AM/PM shift whose time out was changed from time in + 8 hours.';

-- 3. Daily rate on each record -----------------------------------------------
alter table public.attendance_logs
  add column daily_rate numeric(12, 2)
    check (daily_rate is null or (daily_rate >= 0 and daily_rate <= 1000000));

-- The employee's current daily rate: the daily salary, or monthly ÷ days in a
-- month (contribution_settings.work_days_per_month), as the app works it out.
create function public.employee_daily_rate(p_employee_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case e.salary_type
    when 'daily' then e.salary_rate
    else round(e.salary_rate / s.work_days_per_month, 2)
  end
  from public.employees e
  cross join public.contribution_settings s
  where e.id = p_employee_id;
$$;

-- Only the trigger below uses it (as the function owner).
revoke execute on function public.employee_daily_rate(uuid) from public, anon, authenticated;
grant execute on function public.employee_daily_rate(uuid) to service_role;

-- Backfill: existing records get the employee's current rate.
update public.attendance_logs set daily_rate = public.employee_daily_rate(employee_id);

-- A record saved without a rate gets the employee's current one.
create function public.attendance_logs_fill_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.daily_rate is null then
    new.daily_rate := public.employee_daily_rate(new.employee_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.attendance_logs_fill_rate() from public;

create trigger attendance_logs_fill_rate
before insert or update on public.attendance_logs
for each row execute function public.attendance_logs_fill_rate();

alter table public.attendance_logs alter column daily_rate set not null;

comment on column public.attendance_logs.daily_rate is
  'Pesos for this day, copied from the employee when saved (editable per day). Reports use this, not the current salary.';
