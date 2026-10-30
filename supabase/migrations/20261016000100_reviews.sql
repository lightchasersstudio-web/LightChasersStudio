-- Client reviews shown on the home page and on package pages, managed from
-- /admin/reviews. Only published reviews are readable by the public.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  category public.service_category not null,
  shoot text not null check (char_length(shoot) between 2 and 80),
  quote text not null check (char_length(quote) between 10 and 800),
  rating smallint check (rating between 1 and 5),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_published_sort_idx on public.reviews (is_published, sort_order);

create trigger reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

create policy "reviews: public read published"
on public.reviews for select to anon, authenticated
using (is_published or (select public.is_admin()));

create policy "reviews: admin insert"
on public.reviews for insert to authenticated
with check ((select public.is_admin()));

create policy "reviews: admin update"
on public.reviews for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "reviews: admin delete"
on public.reviews for delete to authenticated
using ((select public.is_admin()));
