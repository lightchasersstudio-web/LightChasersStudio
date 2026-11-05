-- The studio's own Google Maps link (owner request 2026-11-05): a map search for
-- the address text didn't land on the exact spot, so the admin pastes the Share
-- link of the studio's pin in Settings. Footer and Contact open it.

alter table public.business_settings
  add column maps_url text
  constraint business_settings_maps_url_check
    check (maps_url is null or (maps_url ~ '^https://' and char_length(maps_url) <= 500));

comment on column public.business_settings.maps_url is
  'Google Maps link to the studio''s exact pin (Share link). Null = search for the address.';
