-- Deleting employees (owner request 2026-11-10): a delete hides the employee
-- everywhere (Employees, Time record, Payroll, daily payroll report) but keeps
-- their time records and saved payslips, which stay viewable under
-- Employees → Deleted and can be restored. Payroll records are kept on
-- purpose (labour rules expect them for at least 3 years).

alter table public.employees
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  -- A deleted employee is never active.
  add constraint employees_deleted_inactive check (deleted_at is null or not is_active);

comment on column public.employees.deleted_at is
  'Set = deleted: hidden from every list and report; records kept for the history view. Null = not deleted.';

create index employees_deleted_idx on public.employees (deleted_at);
