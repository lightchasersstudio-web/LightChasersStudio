-- Optional link from a portfolio photo to the package it shows, so the public
-- gallery can offer "Book this package". Deleting the package just unlinks it.
alter table public.portfolio_images
  add column service_id uuid references public.services (id) on delete set null;

create index portfolio_images_service_id_idx on public.portfolio_images (service_id);
