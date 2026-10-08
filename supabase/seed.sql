-- Development seed data. PLACEHOLDER content: prices, packages and hours are
-- examples only — replace them through the admin panel (Phase 3).
-- Prices are integer centavos (₱1 = 100).

update public.business_settings
set tagline = 'Chasing light, keeping memories.',
    about = 'Light Chasers Studio is a photography studio based in Zamboanga City, capturing weddings, portraits, events and brands.',
    email = 'lightchasers.studio@gmail.com',
    address = 'Zamboanga City, Philippines'
where id;

insert into public.services
  (name, slug, category, summary, description, duration_minutes, price_cents, deposit_cents, inclusions, sort_order)
values
  ('Wedding Day Coverage', 'wedding-day-coverage', 'wedding',
   'Full-day coverage from preparations to reception.',
   'Two photographers documenting your wedding day from getting ready through the ceremony and reception.',
   600, 4500000, 1000000,
   '["2 photographers", "Up to 10 hours coverage", "500+ edited photos", "Online gallery", "Same-day edit slideshow"]', 10),
  ('Prenup Session', 'prenup-session', 'wedding',
   'A relaxed couple session at the location of your choice.',
   'Up to two outfit changes and one location within Zamboanga City.',
   180, 1200000, null,
   '["1 photographer", "Up to 3 hours", "80+ edited photos", "Online gallery"]', 20),
  ('Family Portrait Session', 'family-portrait-session', 'portrait',
   'Studio or outdoor portraits for families of up to 8.',
   'A one-hour session for families, couples or individuals, in studio or outdoors.',
   60, 350000, null,
   '["1 hour session", "30 edited photos", "Online gallery"]', 30),
  ('Maternity & Newborn', 'maternity-newborn', 'portrait',
   'Gentle, unhurried sessions for growing families.',
   'Maternity or newborn session with props and wraps provided.',
   120, 500000, null,
   '["Up to 2 hours", "40 edited photos", "Props and wraps provided"]', 40),
  ('Event Coverage', 'event-coverage', 'event',
   'Birthdays, debuts, christenings and corporate events.',
   'Photo coverage of your event, priced for up to four hours.',
   240, 1500000, null,
   '["1 photographer", "Up to 4 hours", "200+ edited photos", "Online gallery"]', 50),
  ('Product Photography', 'product-photography', 'commercial',
   'Clean, consistent product images for your shop or menu.',
   'Studio product photography on white or styled backgrounds, up to 15 products.',
   180, 800000, null,
   '["Up to 15 products", "White or styled background", "Web-ready files"]', 60);

-- Open every day 08:00–19:00 (0 = Sunday).
insert into public.availability_rules (day_of_week, start_time, end_time)
select d, '08:00', '19:00' from generate_series(0, 6) as d;

insert into public.blackout_dates (date, reason)
values ('2026-12-25', 'Christmas Day'), ('2027-01-01', 'New Year''s Day');
