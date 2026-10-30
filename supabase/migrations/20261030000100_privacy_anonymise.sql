-- Privacy (RA 10173): delete a client's personal data on request, and student ID
-- photos once a workshop is over.
--
-- * anonymise_client(client): wipes the client's name, email and phone, the
--   contact details and notes on their bookings, their workshop attendees'
--   names/phones/addresses, and the billing details inside stored PayMongo
--   payloads. References, amounts, dates and statuses stay, so the accounts stay
--   true. Refused while the client has an upcoming active booking. Returns the
--   student-ID file paths it cleared so the server can delete the files.
-- * clear_past_student_ids(): clears the ID photo paths of workshops that have
--   ended and returns them for the same reason.
-- A student attendee may now have no ID photo path (deleted after review).

alter table public.booking_attendees drop constraint booking_attendees_check;
alter table public.booking_attendees
  add constraint booking_attendees_student_id_check
  check ((category = 'student') = (id_status is not null));

create or replace function public.anonymise_client(p_client_id uuid)
returns table (student_id_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_ids uuid[];
  v_paths text[];
begin
  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    raise exception 'client_not_found';
  end if;
  if exists (
    select 1 from public.bookings b
    where b.client_id = p_client_id
      and b.status in ('pending_payment', 'pending', 'confirmed')
      and b.end_at > now()
  ) then
    raise exception 'client_has_upcoming_booking';
  end if;

  select coalesce(array_agg(b.id), '{}') into v_booking_ids
  from public.bookings b where b.client_id = p_client_id;

  select coalesce(array_agg(a.student_id_path), '{}') into v_paths
  from public.booking_attendees a
  where a.booking_id = any (v_booking_ids) and a.student_id_path is not null;

  update public.clients
  set full_name = 'Deleted client', email = null, phone = '0000000',
      consent_version = 'anonymised'
  where id = p_client_id;

  update public.bookings
  set contact_name = 'Deleted client', contact_phone = '0000000', messenger = null,
      location = null, special_requests = null, admin_notes = null
  where id = any (v_booking_ids);

  update public.booking_attendees
  set full_name = 'Deleted', phone = null, address = null, student_id_path = null
  where booking_id = any (v_booking_ids);

  -- PayMongo payloads carry the billing name, email and phone.
  update public.payment_webhook_events e
  set payload = jsonb_build_object('anonymised', true)
  where e.payload #>> '{data,attributes,data,id}' in (
          select p.provider_checkout_id from public.payments p
          where p.booking_id = any (v_booking_ids) and p.provider_checkout_id is not null)
     or e.payload ->> 'reference' in (
          select b.reference_code from public.bookings b where b.id = any (v_booking_ids));
  update public.payments set raw = null where booking_id = any (v_booking_ids);

  -- History entries can quote names and contact details.
  update public.audit_logs l
  set metadata = (l.metadata - array['contact_name', 'contact_phone', 'attendee'])
    || case when l.metadata ? 'before'
         then jsonb_build_object('before', (l.metadata -> 'before')
           - array['contact_name', 'contact_phone', 'location', 'special_requests', 'messenger'])
         else '{}'::jsonb end
    || case when l.metadata ? 'after'
         then jsonb_build_object('after', (l.metadata -> 'after')
           - array['contact_name', 'contact_phone', 'location', 'special_requests', 'messenger'])
         else '{}'::jsonb end
  where l.entity = 'booking' and l.entity_id = any (v_booking_ids::text[]);

  return query select unnest(v_paths);
end;
$$;

create or replace function public.clear_past_student_ids()
returns table (student_id_path text)
language sql
security definer
set search_path = ''
as $$
  -- RETURNING would give the new (null) value, so read the paths first.
  with cleared as (
    select a.id, a.student_id_path as path
    from public.booking_attendees a
    join public.bookings b on b.id = a.booking_id
    where b.end_at < now() and a.student_id_path is not null
    for update of a
  ), updated as (
    update public.booking_attendees a
    set student_id_path = null
    from cleared
    where a.id = cleared.id
  )
  select path from cleared;
$$;

revoke execute on function public.anonymise_client(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_client(uuid) to service_role;
revoke execute on function public.clear_past_student_ids() from public, anon, authenticated;
grant execute on function public.clear_past_student_ids() to service_role;
