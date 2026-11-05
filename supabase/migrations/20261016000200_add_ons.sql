-- Paid extras a client can add when booking online (extra photographer,
-- videographer, ...), managed under /admin/services. Their prices are added to
-- the booking total on the server; each booking keeps a copy of the name and
-- price it was booked with, so later price changes don't rewrite history.

create table public.add_ons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 300),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index add_ons_active_sort_idx on public.add_ons (is_active, sort_order);

create trigger add_ons_updated_at
before update on public.add_ons
for each row execute function public.set_updated_at();

create table public.booking_add_ons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  -- Deleting an add-on keeps the booking's copy of its name and price.
  add_on_id uuid references public.add_ons (id) on delete set null,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now()
);

create index booking_add_ons_booking_id_idx on public.booking_add_ons (booking_id);
create index booking_add_ons_add_on_id_idx on public.booking_add_ons (add_on_id);

alter table public.add_ons enable row level security;
alter table public.booking_add_ons enable row level security;

create policy "add_ons: public read active"
on public.add_ons for select to anon, authenticated
using (is_active or (select public.is_admin()));

create policy "add_ons: admin insert"
on public.add_ons for insert to authenticated
with check ((select public.is_admin()));

create policy "add_ons: admin update"
on public.add_ons for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "add_ons: admin delete"
on public.add_ons for delete to authenticated
using ((select public.is_admin()));

-- Written only by create_booking (service role); admins can read them.
create policy "booking_add_ons: admin read"
on public.booking_add_ons for select to authenticated
using ((select public.is_admin()));

-- Starters, hidden until the owner sets a price and switches them on.
insert into public.add_ons (name, description, price_cents, is_active, sort_order) values
  ('Extra photographer', 'A second photographer to cover more angles and moments.', 0, false, 0),
  ('Videographer', 'Video coverage of your shoot, edited into a short film.', 0, false, 1);

-- ---------------------------------------------------------------------------
-- create_booking: adds p_add_on_ids. Add-on prices come from the add_ons table
-- (never the client) and are added to the total. A package with a fixed deposit
-- keeps it; otherwise the default deposit % applies to the whole total.
-- New error: add_on_unavailable (an add-on was switched off or removed).
-- ---------------------------------------------------------------------------
drop function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text
);

create function public.create_booking(
  p_full_name text,
  p_email text,
  p_phone text,
  p_preferred_contact public.contact_method,
  p_consent_version text,
  p_service_id uuid,
  p_start_at timestamptz,
  p_location text default null,
  p_participants integer default 1,
  p_special_requests text default null,
  p_messenger text default null,
  p_add_on_ids uuid[] default null
)
returns table (
  booking_id uuid,
  reference_code text,
  status public.booking_status,
  deposit_cents integer,
  hold_expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_settings public.business_settings%rowtype;
  v_service public.services%rowtype;
  v_add_on_ids uuid[];
  v_add_ons_cents integer;
  v_total integer;
  v_end_at timestamptz;
  v_blocked_until timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_deposit integer;
  v_status public.booking_status;
  v_hold timestamptz;
  v_client_id uuid;
  v_reference text;
  v_booking_id uuid;
  v_attempt integer := 0;
begin
  perform public.expire_stale_holds();

  -- Public bookings always need an email (confirmation + booking lookup).
  if nullif(trim(p_email), '') is null then
    raise exception 'email_required';
  end if;

  select * into strict v_settings from public.business_settings where id;

  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then
    raise exception 'service_unavailable';
  end if;

  -- Each add-on at most once, and every one must still be offered.
  select coalesce(array_agg(distinct x), '{}') into v_add_on_ids
  from unnest(coalesce(p_add_on_ids, '{}')) x;
  select coalesce(sum(a.price_cents), 0) into v_add_ons_cents
  from public.add_ons a where a.id = any (v_add_on_ids) and a.is_active;
  if (select count(*) from public.add_ons a where a.id = any (v_add_on_ids) and a.is_active)
     <> cardinality(v_add_on_ids) then
    raise exception 'add_on_unavailable';
  end if;
  v_total := v_service.price_cents + v_add_ons_cents;

  v_end_at := p_start_at + make_interval(mins => v_service.duration_minutes);
  v_blocked_until := v_end_at + make_interval(mins => v_settings.buffer_minutes);
  v_local_start := p_start_at at time zone v_settings.timezone;
  v_local_end := v_end_at at time zone v_settings.timezone;

  if extract(second from v_local_start) <> 0
     or (extract(hour from v_local_start)::int * 60 + extract(minute from v_local_start)::int)
        % v_settings.slot_interval_minutes <> 0 then
    raise exception 'invalid_start_time';
  end if;

  if p_start_at < now() + make_interval(hours => v_settings.min_notice_hours) then
    raise exception 'too_soon';
  end if;

  if p_start_at > now() + make_interval(days => v_settings.max_advance_days) then
    raise exception 'too_far';
  end if;

  if exists (select 1 from public.blackout_dates where date = v_local_start::date) then
    raise exception 'blackout_date';
  end if;

  if v_local_end::date <> v_local_start::date or not exists (
    select 1 from public.availability_rules r
    where r.day_of_week = extract(dow from v_local_start)::int
      and r.start_time <= v_local_start::time
      and r.end_time >= v_local_end::time
  ) then
    raise exception 'outside_business_hours';
  end if;

  perform public.assert_capacity(p_start_at, v_blocked_until);

  v_deposit := coalesce(
    v_service.deposit_cents,
    round(v_total * v_settings.default_deposit_percent / 100.0)::integer
  );

  if v_deposit > 0 then
    v_status := 'pending_payment';
    v_hold := now() + make_interval(mins => v_settings.hold_minutes);
  else
    v_status := 'pending';
    v_hold := null;
  end if;

  -- One client row per email; public submissions never overwrite name/phone.
  insert into public.clients as c (full_name, email, phone, preferred_contact, consent_given_at, consent_version)
  values (trim(p_full_name), lower(trim(p_email)), trim(p_phone), p_preferred_contact, now(), p_consent_version)
  on conflict ((lower(email))) do update
    set consent_given_at = excluded.consent_given_at,
        consent_version = excluded.consent_version
  returning c.id into v_client_id;

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'BK-' || to_char(v_local_start, 'YYYY') || '-'
                   || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.bookings (
        reference_code, client_id, service_id, status, start_at, end_at, blocked_until,
        contact_name, contact_phone, preferred_contact, messenger, location, participants,
        special_requests, price_cents, deposit_cents, hold_expires_at
      ) values (
        v_reference, v_client_id, v_service.id, v_status, p_start_at, v_end_at, v_blocked_until,
        trim(p_full_name), trim(p_phone), p_preferred_contact, nullif(trim(p_messenger), ''),
        nullif(trim(p_location), ''), coalesce(p_participants, 1),
        nullif(trim(p_special_requests), ''), v_total, v_deposit, v_hold
      )
      returning id into v_booking_id;
      exit;
    exception
      when unique_violation then
        -- reference code collision (1 in 16.7M per year); retry a few times
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;

  insert into public.booking_add_ons (booking_id, add_on_id, name, price_cents)
  select v_booking_id, a.id, a.name, a.price_cents
  from public.add_ons a where a.id = any (v_add_on_ids)
  order by a.sort_order;

  return query select v_booking_id, v_reference, v_status, v_deposit, v_hold;
end;
$$;

revoke execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.create_booking(
  text, text, text, public.contact_method, text, uuid, timestamptz, text, integer, text, text, uuid[]
) to service_role;
