-- Workshop banner slideshow (owner request 2026-10-30): the admin picks the
-- photos that play in the home-page workshop banner, in order. Empty = the
-- banner keeps its automatic pick (cover photo, then upright gallery photos).
--
-- Stored on the service as a small ordered array, so it's read and cached
-- with the workshop itself: [{ "path", "width", "height", "blur" }, …].
-- Files live in the public `portfolio` bucket under `workshop/`.

alter table public.services
  add column workshop_slides jsonb not null default '[]'::jsonb,
  add constraint services_workshop_slides_check check (
    jsonb_typeof(workshop_slides) = 'array' and jsonb_array_length(workshop_slides) <= 12
  );

comment on column public.services.workshop_slides is
  'Workshops only: ordered banner slideshow photos [{path, width, height, blur}] in the portfolio bucket. Empty = automatic pick.';
