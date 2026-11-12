-- Payroll (owner request 2026-11-09): employees, benefits, contribution rates,
-- daily time records, semi-monthly payroll periods and payslips.
--
-- * Every admin (owner and admin) can read and edit payroll (owner decision).
-- * Money is numeric(12,2) in pesos here (owner decision), unlike the rest of
--   the schema, which uses integer centavos.
-- * Leave and holiday days are unpaid (owner decision): monthly-paid staff lose
--   a day's pay for each absent/leave/holiday day; daily-paid staff are paid
--   for present days only.
-- * Payslips are computed by the app (src/lib/payroll/) and saved through
--   save_payroll(), which replaces a cut-off's payslips atomically. Each
--   payslip keeps a copy of the rates and names used, so later edits to an
--   employee don't change old payslips.

-- 1. Employees ---------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  -- Private bucket employee-photos: <uuid>.<ext>
  photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}\.(webp|jpg)$'),
  position text not null check (char_length(position) between 2 and 80),
  date_hired date not null,
  phone text check (phone is null or char_length(phone) between 7 and 30),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  address text check (address is null or char_length(address) <= 300),
  is_active boolean not null default true,
  -- Government numbers, digits only (shown with dashes by the app).
  sss_no text check (sss_no is null or sss_no ~ '^\d{10}$'),
  philhealth_no text check (philhealth_no is null or philhealth_no ~ '^\d{12}$'),
  pagibig_no text check (pagibig_no is null or pagibig_no ~ '^\d{12}$'),
  salary_type text not null check (salary_type in ('monthly', 'daily')),
  -- Pesos per month (monthly) or per day (daily). Editable any time; payslips
  -- keep the rate they were computed with.
  salary_rate numeric(12, 2) not null check (salary_rate >= 0 and salary_rate <= 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.employees is
  'Studio staff for payroll (Admin → Employees). Deactivate instead of deleting.';

create index employees_active_name_idx on public.employees (is_active, full_name);

create trigger employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- 2. Benefits on/off, one row per employee ------------------------------------
create table public.employee_benefits (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  sss_enabled boolean not null default true,
  philhealth_enabled boolean not null default true,
  pagibig_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.employee_benefits is
  'Which government contributions are deducted for an employee. Off = ₱0, "Not enrolled" on the payslip.';

create trigger employee_benefits_updated_at
before update on public.employee_benefits
for each row execute function public.set_updated_at();

-- Every employee gets a benefits row (all on) when added.
create function public.employees_add_benefits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.employee_benefits (employee_id) values (new.id)
  on conflict (employee_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.employees_add_benefits() from public;

create trigger employees_add_benefits
after insert on public.employees
for each row execute function public.employees_add_benefits();

-- 3. Contribution rates (single row, editable) --------------------------------
create table public.contribution_settings (
  id boolean primary key default true check (id),
  -- SSS: employee share of the Monthly Salary Credit (MSC). The MSC is the
  -- monthly salary rounded to the nearest step, kept between min and max.
  sss_employee_rate numeric(6, 4) not null default 0.05 check (sss_employee_rate between 0 and 1),
  sss_msc_min numeric(12, 2) not null default 5000 check (sss_msc_min >= 0),
  sss_msc_max numeric(12, 2) not null default 35000,
  sss_msc_step numeric(12, 2) not null default 500 check (sss_msc_step > 0),
  -- PhilHealth: employee share of the monthly salary, kept between floor and ceiling.
  philhealth_employee_rate numeric(6, 4) not null default 0.025 check (philhealth_employee_rate between 0 and 1),
  philhealth_floor numeric(12, 2) not null default 10000 check (philhealth_floor >= 0),
  philhealth_ceiling numeric(12, 2) not null default 100000,
  -- Pag-IBIG: employee share of the monthly salary up to the cap (2% × ₱10,000 = ₱200).
  pagibig_employee_rate numeric(6, 4) not null default 0.02 check (pagibig_employee_rate between 0 and 1),
  pagibig_salary_cap numeric(12, 2) not null default 10000 check (pagibig_salary_cap >= 0),
  -- Working days in a month: daily rate = monthly ÷ this; a daily-paid
  -- employee's monthly salary (for contributions) = daily × this.
  work_days_per_month numeric(5, 2) not null default 26 check (work_days_per_month between 1 and 31),
  updated_at timestamptz not null default now(),
  constraint contribution_settings_sss_range check (sss_msc_max >= sss_msc_min),
  constraint contribution_settings_philhealth_range check (philhealth_ceiling >= philhealth_floor)
);

comment on table public.contribution_settings is
  'Employee-share contribution rates (2026) and working days per month. Half of each monthly amount is deducted per cut-off.';

create trigger contribution_settings_updated_at
before update on public.contribution_settings
for each row execute function public.set_updated_at();

insert into public.contribution_settings (id) values (true);

-- 4. Daily time record ---------------------------------------------------------
create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('present', 'absent', 'leave', 'holiday')),
  -- Manila wall-clock times. A time out earlier than the time in means the
  -- shift ran past midnight.
  time_in time,
  time_out time,
  minutes_worked integer generated always as (
    case
      when time_in is null or time_out is null then 0
      else (extract(epoch from (time_out - time_in)))::integer / 60
        + case when time_out < time_in then 1440 else 0 end
    end
  ) stored,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_logs_one_per_day unique (employee_id, work_date),
  -- Present days have both times; other days have none.
  constraint attendance_logs_times check (
    case
      when status = 'present' then time_in is not null and time_out is not null and time_out <> time_in
      else time_in is null and time_out is null
    end
  )
);

comment on table public.attendance_logs is
  'Daily time record: one row per employee per day (Admin → DTR).';

create index attendance_logs_date_idx on public.attendance_logs (work_date);

create trigger attendance_logs_updated_at
before update on public.attendance_logs
for each row execute function public.set_updated_at();

-- 5. Payroll periods (semi-monthly cut-offs) ---------------------------------
create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null unique,
  period_end date not null,
  saved_at timestamptz not null default now(),
  saved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- 1–15 or 16–last day of the month.
  constraint payroll_periods_cutoff check (
    (extract(day from period_start) = 1 and period_end = period_start + 14)
    or (
      extract(day from period_start) = 16
      and period_end = (
        make_date(extract(year from period_start)::integer, extract(month from period_start)::integer, 1)
        + interval '1 month' - interval '1 day'
      )::date
    )
  )
);

comment on table public.payroll_periods is
  'A saved semi-monthly payroll (1–15 or 16–end of month).';

-- 6. Payslips ----------------------------------------------------------------
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  -- Copies at the time of saving.
  employee_name text not null,
  employee_position text not null,
  salary_type text not null check (salary_type in ('monthly', 'daily')),
  salary_rate numeric(12, 2) not null check (salary_rate >= 0),
  daily_rate numeric(12, 2) not null check (daily_rate >= 0),
  monthly_salary numeric(12, 2) not null check (monthly_salary >= 0),
  days_present integer not null default 0 check (days_present >= 0),
  days_absent integer not null default 0 check (days_absent >= 0),
  days_leave integer not null default 0 check (days_leave >= 0),
  days_holiday integer not null default 0 check (days_holiday >= 0),
  minutes_worked integer not null default 0 check (minutes_worked >= 0),
  basic_pay numeric(12, 2) not null check (basic_pay >= 0),
  absence_deduction numeric(12, 2) not null default 0 check (absence_deduction >= 0),
  -- null = not enrolled (benefit switched off).
  sss_deduction numeric(12, 2) check (sss_deduction >= 0),
  philhealth_deduction numeric(12, 2) check (philhealth_deduction >= 0),
  pagibig_deduction numeric(12, 2) check (pagibig_deduction >= 0),
  gross_pay numeric(12, 2) not null check (gross_pay >= 0),
  total_deductions numeric(12, 2) not null check (total_deductions >= 0),
  -- Can be negative when contributions exceed the pay (e.g. no days worked).
  net_pay numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint payslips_one_per_employee unique (payroll_period_id, employee_id),
  constraint payslips_totals check (
    total_deductions = absence_deduction + coalesce(sss_deduction, 0)
      + coalesce(philhealth_deduction, 0) + coalesce(pagibig_deduction, 0)
    and net_pay = gross_pay - total_deductions
  )
);

comment on table public.payslips is
  'One payslip per employee per saved payroll period, with the figures used.';

create index payslips_employee_idx on public.payslips (employee_id);

-- 7. Row-level security: admins only ------------------------------------------
alter table public.employees enable row level security;
alter table public.employee_benefits enable row level security;
alter table public.contribution_settings enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payslips enable row level security;

create policy "employees: admin all" on public.employees for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "employee_benefits: admin all" on public.employee_benefits for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "contribution_settings: admin read" on public.contribution_settings for select to authenticated
using ((select public.is_admin()));

create policy "contribution_settings: admin update" on public.contribution_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "attendance_logs: admin all" on public.attendance_logs for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- Periods and payslips are written only by save_payroll(); admins read and delete.
create policy "payroll_periods: admin read" on public.payroll_periods for select to authenticated
using ((select public.is_admin()));

create policy "payroll_periods: admin delete" on public.payroll_periods for delete to authenticated
using ((select public.is_admin()));

create policy "payslips: admin read" on public.payslips for select to authenticated
using ((select public.is_admin()));

-- 8. Employee photos: private bucket, admins only ------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "employee-photos: admin read" on storage.objects for select to authenticated
using (bucket_id = 'employee-photos' and (select public.is_admin()));

create policy "employee-photos: admin insert" on storage.objects for insert to authenticated
with check (bucket_id = 'employee-photos' and (select public.is_admin()));

create policy "employee-photos: admin update" on storage.objects for update to authenticated
using (bucket_id = 'employee-photos' and (select public.is_admin()))
with check (bucket_id = 'employee-photos' and (select public.is_admin()));

create policy "employee-photos: admin delete" on storage.objects for delete to authenticated
using (bucket_id = 'employee-photos' and (select public.is_admin()));

-- 9. save_payroll: replace a cut-off's payslips in one transaction -----------
-- Service role only, called by the admin server action after assertAdmin().
-- p_payslips: [{employee_id, employee_name, employee_position, salary_type,
--   salary_rate, daily_rate, monthly_salary, days_present, days_absent,
--   days_leave, days_holiday, minutes_worked, basic_pay, absence_deduction,
--   sss_deduction, philhealth_deduction, pagibig_deduction, gross_pay,
--   total_deductions, net_pay}]
create function public.save_payroll(
  p_period_start date,
  p_period_end date,
  p_payslips jsonb,
  p_saved_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_id uuid;
begin
  if jsonb_typeof(p_payslips) is distinct from 'array' then
    raise exception 'invalid_payslips';
  end if;

  insert into public.payroll_periods (period_start, period_end, saved_at, saved_by)
  values (p_period_start, p_period_end, now(), p_saved_by)
  on conflict (period_start) do update
    set period_end = excluded.period_end, saved_at = now(), saved_by = excluded.saved_by
  returning id into v_period_id;

  delete from public.payslips where payroll_period_id = v_period_id;

  insert into public.payslips (
    payroll_period_id, employee_id, employee_name, employee_position, salary_type,
    salary_rate, daily_rate, monthly_salary, days_present, days_absent, days_leave,
    days_holiday, minutes_worked, basic_pay, absence_deduction, sss_deduction,
    philhealth_deduction, pagibig_deduction, gross_pay, total_deductions, net_pay
  )
  select
    v_period_id, p.employee_id, p.employee_name, p.employee_position, p.salary_type,
    p.salary_rate, p.daily_rate, p.monthly_salary, p.days_present, p.days_absent, p.days_leave,
    p.days_holiday, p.minutes_worked, p.basic_pay, p.absence_deduction, p.sss_deduction,
    p.philhealth_deduction, p.pagibig_deduction, p.gross_pay, p.total_deductions, p.net_pay
  from jsonb_to_recordset(p_payslips) as p (
    employee_id uuid, employee_name text, employee_position text, salary_type text,
    salary_rate numeric, daily_rate numeric, monthly_salary numeric, days_present integer,
    days_absent integer, days_leave integer, days_holiday integer, minutes_worked integer,
    basic_pay numeric, absence_deduction numeric, sss_deduction numeric,
    philhealth_deduction numeric, pagibig_deduction numeric, gross_pay numeric,
    total_deductions numeric, net_pay numeric
  );

  return v_period_id;
end;
$$;

revoke execute on function public.save_payroll(date, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_payroll(date, date, jsonb, uuid) to service_role;
