-- 1. FAQ managed in Admin → FAQ (owner request 2026-11-05), replacing the
--    hand-written src/content/faq.ts. Answers may use {tokens} filled from the
--    studio settings on the page ({deposit_percent}, {vat_percent},
--    {hold_minutes}, {max_advance_days}, {city}, {business_name}).
-- 2. The client types their full name as a signature when agreeing to a
--    package contract; it's kept with the booking.

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('booking', 'payment', 'photos', 'workshops', 'privacy', 'other')),
  question text not null check (char_length(question) between 5 and 200),
  answer text not null check (char_length(answer) between 5 and 2000),
  -- Optional button under the answer: a page on the site ("/book") or a full https link.
  link_href text check (link_href is null or link_href ~ '^(/[A-Za-z0-9/_#?=&-]*|https://\S+)$'),
  link_label text check (link_label is null or char_length(link_label) between 2 and 60),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faqs_link_pair check ((link_href is null) = (link_label is null))
);

comment on table public.faqs is
  'Questions & answers on /faq, edited in Admin → FAQ. Only published ones are public.';

create index faqs_published_sort_idx on public.faqs (is_published, sort_order);

create trigger faqs_updated_at
before update on public.faqs
for each row execute function public.set_updated_at();

alter table public.faqs enable row level security;

create policy "faqs: public read published"
on public.faqs for select to anon, authenticated
using (is_published or (select public.is_admin()));

create policy "faqs: admin insert"
on public.faqs for insert to authenticated
with check ((select public.is_admin()));

create policy "faqs: admin update"
on public.faqs for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "faqs: admin delete"
on public.faqs for delete to authenticated
using ((select public.is_admin()));

-- The questions that were on the site, in the same order. The four the studio
-- hadn't answered yet start hidden, with a note of what to write.
insert into public.faqs (topic, question, answer, link_href, link_label, is_published, sort_order) values
  ('booking', 'How do I book a session?',
   'Tap “Book now”, choose a package, pick an open date and time, add a few details about your shoot, then pay the deposit online. It takes about two minutes, and only times that are still free are shown.',
   '/book', 'Book now', true, 0),
  ('booking', 'How far ahead can I book?',
   'You can book up to {max_advance_days} days ahead. For dates further out, message us and we''ll see what we can do.',
   null, null, true, 1),
  ('booking', 'Is my booking confirmed as soon as I pay?',
   'Your deposit holds the time for you straight away. We then review the booking and confirm it, and we''ll get in touch if anything needs to change.',
   null, null, true, 2),
  ('booking', 'How do I check my booking later?',
   'Enter your booking reference and the email you booked with on the “Find your booking” page. You''ll see the date, time and status. Lost your reference? Enter your email there and we''ll send it to you.',
   '/booking', 'Find your booking', true, 3),
  ('booking', 'Do you shoot outside the studio?',
   'Yes. When you book, tell us the location: our studio, a venue, or any address in and around {city}.',
   null, null, true, 4),
  ('payment', 'How much is the deposit?',
   'Each booking shows its deposit before you pay. Usually it''s {deposit_percent}% of your total (package, any add-ons and VAT), and the rest is paid to us separately.',
   null, null, true, 5),
  ('payment', 'Do your prices include VAT?',
   'Package and add-on prices are shown before VAT. {vat_percent}% VAT is added to your total when you book, and you''ll see the full breakdown before you pay.',
   null, null, true, 6),
  ('payment', 'How can I pay?',
   'Deposits are paid securely through PayMongo, by scanning a QR Ph code with GCash, Maya or your bank app. We never see or store your payment details.',
   null, null, true, 7),
  ('payment', 'What if I don''t finish paying?',
   'We hold your chosen time for {hold_minutes} minutes while you pay. If the payment isn''t completed, the time is released so someone else can book it, and you can simply start again.',
   null, null, true, 8),
  ('payment', 'Can I cancel and get my deposit back?',
   'Write your cancellation and refund policy here, then switch this question on.',
   null, null, false, 9),
  ('payment', 'Can I move my session to another date?',
   'Write your rescheduling policy here (how much notice, any fee, how many times), then switch this question on.',
   null, null, false, 10),
  ('photos', 'When will I get my photos?',
   'Write your usual delivery time here, and how photos are sent (e.g. online gallery), then switch this question on.',
   null, null, false, 11),
  ('photos', 'How many edited photos will I get?',
   'Write how many edited photos each kind of package includes, then switch this question on.',
   null, null, false, 12),
  ('photos', 'What should we wear?',
   'Comfortable, well-fitting outfits in two or three colours that go together work best. Solid colours and small textures photograph better than big logos or busy prints. Our preparation guide has more tips on outfits, what to bring and the day itself.',
   '/prepare', 'How to prepare for your shoot', true, 13),
  ('privacy', 'What do you do with my personal details?',
   'We use your details only to arrange and look after your booking, under the Philippine Data Privacy Act of 2012 (RA 10173).',
   '/privacy', 'Read our privacy policy', true, 14);

-- 2. Contract signature ------------------------------------------------------
alter table public.bookings add column contract_signed_name text
  constraint bookings_contract_signed_name_length
    check (contract_signed_name is null or char_length(contract_signed_name) between 2 and 120);

comment on column public.bookings.contract_signed_name is
  'The full name the client typed to sign the package contract (their e-signature).';

-- Anonymising a client also removes the name they signed with.
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
      location = null, special_requests = null, admin_notes = null,
      contract_signed_name = null
  where id = any (v_booking_ids);

  delete from public.booking_requests where booking_id = any (v_booking_ids);

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

revoke execute on function public.anonymise_client(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_client(uuid) to service_role;
