-- Workshops (booked like a package, paid half or in full). Own migration because
-- a new enum value can't be used in the transaction that adds it.
alter type public.service_category add value if not exists 'workshop';
