-- Payroll by the hour (owner decision 2026-11-09):
-- * Daily rate = monthly ÷ 30 days, hourly rate = daily ÷ 8 hours (both
--   editable in contribution_settings). Time between time in and time out
--   counts in full (no lunch deduction).
-- * Monthly staff: half the salary per cut-off minus missing time: a present
--   day shorter than a shift deducts the missing hours (undertime); absent,
--   leave and holiday days deduct a full day.
-- * Daily staff: daily rate per present day minus undertime the same way.
-- * Hours past a shift are overtime, paid at the employee's own overtime rate
--   per hour (employees.overtime_rate; empty = not paid).

alter table public.contribution_settings
  add column hours_per_day numeric(4, 2) not null default 8
    check (hours_per_day between 1 and 24);
alter table public.contribution_settings alter column work_days_per_month set default 30;
update public.contribution_settings set work_days_per_month = 30;

comment on column public.contribution_settings.work_days_per_month is
  'Days in a month: daily rate = monthly ÷ this; a daily-paid employee''s monthly salary (for contributions) = daily × this.';
comment on column public.contribution_settings.hours_per_day is
  'Hours in a shift: hourly rate = daily ÷ this; time past it is overtime, time short of it is undertime.';

alter table public.employees
  add column overtime_rate numeric(12, 2)
    check (overtime_rate is null or (overtime_rate >= 0 and overtime_rate <= 1000000));

comment on column public.employees.overtime_rate is
  'Pesos per overtime hour (past a shift). Null = overtime isn''t paid.';

alter table public.payslips
  add column hourly_rate numeric(12, 2) not null default 0 check (hourly_rate >= 0),
  add column overtime_rate numeric(12, 2) check (overtime_rate >= 0),
  add column regular_minutes integer not null default 0 check (regular_minutes >= 0),
  add column undertime_minutes integer not null default 0 check (undertime_minutes >= 0),
  add column overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  add column undertime_deduction numeric(12, 2) not null default 0 check (undertime_deduction >= 0),
  add column overtime_pay numeric(12, 2) not null default 0 check (overtime_pay >= 0);

alter table public.payslips drop constraint payslips_totals;
alter table public.payslips add constraint payslips_totals check (
  gross_pay = basic_pay + overtime_pay
  and total_deductions = absence_deduction + undertime_deduction + coalesce(sss_deduction, 0)
    + coalesce(philhealth_deduction, 0) + coalesce(pagibig_deduction, 0)
  and net_pay = gross_pay - total_deductions
);

-- save_payroll with the new columns (missing ones count as 0).
create or replace function public.save_payroll(
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
    salary_rate, daily_rate, monthly_salary, hourly_rate, overtime_rate, days_present,
    days_absent, days_leave, days_holiday, minutes_worked, regular_minutes,
    undertime_minutes, overtime_minutes, basic_pay, overtime_pay, absence_deduction,
    undertime_deduction, sss_deduction, philhealth_deduction, pagibig_deduction,
    gross_pay, total_deductions, net_pay
  )
  select
    v_period_id, p.employee_id, p.employee_name, p.employee_position, p.salary_type,
    p.salary_rate, p.daily_rate, p.monthly_salary, coalesce(p.hourly_rate, 0), p.overtime_rate,
    p.days_present, p.days_absent, p.days_leave, p.days_holiday, p.minutes_worked,
    coalesce(p.regular_minutes, 0), coalesce(p.undertime_minutes, 0),
    coalesce(p.overtime_minutes, 0), p.basic_pay, coalesce(p.overtime_pay, 0),
    p.absence_deduction, coalesce(p.undertime_deduction, 0), p.sss_deduction,
    p.philhealth_deduction, p.pagibig_deduction, p.gross_pay, p.total_deductions, p.net_pay
  from jsonb_to_recordset(p_payslips) as p (
    employee_id uuid, employee_name text, employee_position text, salary_type text,
    salary_rate numeric, daily_rate numeric, monthly_salary numeric, hourly_rate numeric,
    overtime_rate numeric, days_present integer, days_absent integer, days_leave integer,
    days_holiday integer, minutes_worked integer, regular_minutes integer,
    undertime_minutes integer, overtime_minutes integer, basic_pay numeric,
    overtime_pay numeric, absence_deduction numeric, undertime_deduction numeric,
    sss_deduction numeric, philhealth_deduction numeric, pagibig_deduction numeric,
    gross_pay numeric, total_deductions numeric, net_pay numeric
  );

  return v_period_id;
end;
$$;

revoke execute on function public.save_payroll(date, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_payroll(date, date, jsonb, uuid) to service_role;
