-- Row Level Security. Every table has RLS enabled.
--   anon/authenticated (non-admin): read public catalogue data only.
--   admins (row in admin_profiles): full management access.
--   clients, bookings, payments: never readable by anon. Bookings are created
--   via the service-role-only create_booking() RPC (see next migration).

-- ---------------------------------------------------------------------------
-- Role check. SECURITY DEFINER so it can read admin_profiles regardless of RLS;
-- identity comes from the verified JWT (auth.uid()), never from client input.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles where user_id = (select auth.uid())
  );
$$;

-- anon needs EXECUTE because anon-facing policies reference it (e.g. services
-- read); it simply returns false when there is no signed-in user.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.admin_profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blackout_dates enable row level security;
alter table public.portfolio_images enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- admin_profiles: admins see each other; a user sees their own row.
-- Rows are created manually / by the service role, not through the API.
-- ---------------------------------------------------------------------------
create policy "admin_profiles: self or admin can read"
on public.admin_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Public catalogue: business_settings, services, availability, blackouts, portfolio
-- ---------------------------------------------------------------------------
create policy "business_settings: public read"
on public.business_settings for select to anon, authenticated
using (true);

create policy "business_settings: admin update"
on public.business_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "services: public read active"
on public.services for select to anon, authenticated
using (is_active or (select public.is_admin()));

create policy "services: admin insert"
on public.services for insert to authenticated
with check ((select public.is_admin()));

create policy "services: admin update"
on public.services for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "services: admin delete"
on public.services for delete to authenticated
using ((select public.is_admin()));

create policy "availability_rules: public read"
on public.availability_rules for select to anon, authenticated
using (true);

create policy "availability_rules: admin write"
on public.availability_rules for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "blackout_dates: public read"
on public.blackout_dates for select to anon, authenticated
using (true);

create policy "blackout_dates: admin write"
on public.blackout_dates for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "portfolio_images: public read"
on public.portfolio_images for select to anon, authenticated
using (true);

create policy "portfolio_images: admin write"
on public.portfolio_images for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Private data: admins only. No anon policies at all.
-- ---------------------------------------------------------------------------
create policy "clients: admin read"
on public.clients for select to authenticated
using ((select public.is_admin()));

create policy "clients: admin update"
on public.clients for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "bookings: admin read"
on public.bookings for select to authenticated
using ((select public.is_admin()));

create policy "bookings: admin update"
on public.bookings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "payments: admin read"
on public.payments for select to authenticated
using ((select public.is_admin()));

-- payment_webhook_events: no policies — service role only.

create policy "audit_logs: admin read"
on public.audit_logs for select to authenticated
using ((select public.is_admin()));

create policy "audit_logs: admin insert own actions"
on public.audit_logs for insert to authenticated
with check ((select public.is_admin()) and actor_id = (select auth.uid()));
