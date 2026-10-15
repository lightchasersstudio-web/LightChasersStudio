-- Versa Space: studio space rental. Own migration because a new enum value
-- can't be used in the transaction that adds it.
alter type public.service_category add value if not exists 'studio' after 'portrait';
