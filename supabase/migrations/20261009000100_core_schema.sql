-- Core schema: enums, tables, constraints, indexes, updated_at triggers.
-- Money is stored as integer centavos (PHP). Timestamps are timestamptz (UTC);
-- local business time is derived via business_settings.timezone.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.admin_role as enum ('owner', 'admin');

create type public.contact_method as enum ('email', 'phone', 'sms', 'messenger', 'viber');

create type public.service_category as enum ('wedding', 'portrait', 'event', 'commercial');

create type public.booking_status as enum (
  'pending_payment', -- created, deposit not yet paid; holds the slot until hold_expires_at
  'pending',         -- deposit paid (or none required); awaiting admin review
  'confirmed',
  'completed',
  'cancelled',
  'declined',
  'expired'          -- hold lapsed without payment
);

create type public.payment_status as enum ('pending', 'paid', 'failed', 'expired', 'refunded');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  role public.admin_role not null default 'admin',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Business settings (exactly one row)
-- ---------------------------------------------------------------------------
create table public.business_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Light Chasers Studio' check (char_length(business_name) between 1 and 120),
  tagline text check (char_length(tagline) <= 200),
  about text check (char_length(about) <= 5000),
  logo_path text,
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 32),
  address text check (char_length(address) <= 300),
  city text not null default 'Zamboanga City',
  facebook_url text check (char_length(facebook_url) <= 300),
  instagram_url text check (char_length(instagram_url) <= 300),
  tiktok_url text check (char_length(tiktok_url) <= 300),
  timezone text not null default 'Asia/Manila',
  currency char(3) not null default 'PHP',
  -- booking rules
  min_notice_hours integer not null default 48 check (min_notice_hours between 0 and 24 * 60),
  max_advance_days integer not null default 180 check (max_advance_days between 1 and 730),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes in (15, 30, 60)),
  buffer_minutes integer not null default 30 check (buffer_minutes between 0 and 480),
  default_deposit_percent integer not null default 30 check (default_deposit_percent between 0 and 100),
  hold_minutes integer not null default 20 check (hold_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);

create trigger business_settings_updated_at
before update on public.business_settings
for each row execute function public.set_updated_at();

insert into public.business_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Services / packages
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  category public.service_category not null,
  summary text check (char_length(summary) <= 300),
  description text check (char_length(description) <= 5000),
  duration_minutes integer not null check (duration_minutes between 15 and 24 * 60),
  price_cents integer not null check (price_cents >= 0),
  -- null = use business_settings.default_deposit_percent
  deposit_cents integer check (deposit_cents >= 0),
  inclusions jsonb not null default '[]'::jsonb check (jsonb_typeof(inclusions) = 'array'),
  cover_image_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_deposit_not_above_price check (deposit_cents is null or deposit_cents <= price_cents)
);

create index services_active_sort_idx on public.services (is_active, sort_order);

create trigger services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Availability: weekly hours (multiple windows per day allowed) and blackouts
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint availability_rules_valid_window check (end_time > start_time)
);

create index availability_rules_day_idx on public.availability_rules (day_of_week);

create table public.blackout_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------
create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  category public.service_category not null,
  alt_text text not null check (char_length(alt_text) between 3 and 300),
  caption text check (char_length(caption) <= 300),
  width integer check (width > 0),
  height integer check (height > 0),
  blur_data_url text check (char_length(blur_data_url) <= 4000),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index portfolio_images_category_sort_idx on public.portfolio_images (category, sort_order);
create index portfolio_images_featured_idx on public.portfolio_images (sort_order) where is_featured;

-- ---------------------------------------------------------------------------
-- Clients (created by the booking RPC; one row per email)
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
  phone text not null check (char_length(phone) between 7 and 32),
  preferred_contact public.contact_method not null default 'email',
  consent_given_at timestamptz not null,
  consent_version text not null check (char_length(consent_version) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clients_email_unique_idx on public.clients (lower(email));

create trigger clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique check (reference_code ~ '^BK-[0-9]{4}-[0-9A-F]{6}$'),
  -- restrict: client deletion (privacy requests) goes through an anonymisation routine
  client_id uuid not null references public.clients (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  status public.booking_status not null default 'pending_payment',
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- end_at + buffer at booking time; the exclusion constraint uses this
  blocked_until timestamptz not null,
  -- contact details as submitted with this booking (clients row is never overwritten by the public)
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_phone text not null check (char_length(contact_phone) between 7 and 32),
  preferred_contact public.contact_method not null,
  location text check (char_length(location) <= 300),
  participants integer not null default 1 check (participants between 1 and 500),
  special_requests text check (char_length(special_requests) <= 2000),
  -- price snapshot, computed server-side from the service at booking time
  price_cents integer not null check (price_cents >= 0),
  deposit_cents integer not null check (deposit_cents >= 0 and deposit_cents <= price_cents),
  hold_expires_at timestamptz,
  admin_notes text check (char_length(admin_notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_range check (end_at > start_at and blocked_until >= end_at),
  constraint bookings_hold_only_when_awaiting_payment
    check ((status = 'pending_payment') = (hold_expires_at is not null)),
  -- No double booking: blocking bookings may not overlap (incl. buffer).
  constraint bookings_no_overlap exclude using gist (
    tstzrange(start_at, blocked_until, '[)') with &&
  ) where (status not in ('cancelled', 'declined', 'expired'))
);

create index bookings_start_at_idx on public.bookings (start_at);
create index bookings_status_idx on public.bookings (status);
create index bookings_client_id_idx on public.bookings (client_id);
create index bookings_service_id_idx on public.bookings (service_id);
create index bookings_hold_expiry_idx on public.bookings (hold_expires_at) where status = 'pending_payment';

create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- Allowed status transitions (defence in depth; the app enforces the same rules).
create function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending_payment' and new.status in ('pending', 'expired', 'cancelled')) or
    (old.status = 'pending'         and new.status in ('confirmed', 'declined', 'cancelled')) or
    (old.status = 'confirmed'       and new.status in ('completed', 'cancelled')) or
    -- late payment for a lapsed hold, only if the slot is still free (exclusion constraint decides)
    (old.status = 'expired'         and new.status = 'pending')
  ) then
    raise exception 'invalid booking status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status <> 'pending_payment' then
    new.hold_expires_at := null;
  end if;

  return new;
end;
$$;

create trigger bookings_status_transition
before update of status on public.bookings
for each row execute function public.enforce_booking_status_transition();

-- ---------------------------------------------------------------------------
-- Payments (PayMongo) and webhook idempotency
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  provider text not null default 'paymongo',
  provider_checkout_id text unique,
  provider_payment_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'PHP',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments (booking_id);

create trigger payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table public.payment_webhook_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity text not null check (char_length(entity) <= 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
