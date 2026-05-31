-- AIanime v123 popularity events.
-- Safe to run multiple times.

create table if not exists public.anime_popularity_events (
  id bigserial primary key,
  anime_slug text not null,
  event_type text not null check (event_type in ('view','click','continue','favorite','rating')),
  page text,
  created_at timestamptz not null default now()
);

create index if not exists anime_popularity_events_slug_created_idx
  on public.anime_popularity_events(anime_slug, created_at desc);

create index if not exists anime_popularity_events_created_idx
  on public.anime_popularity_events(created_at desc);

alter table public.anime_popularity_events enable row level security;

drop policy if exists "anime_popularity_events_insert_public" on public.anime_popularity_events;
drop policy if exists "anime_popularity_events_select_service" on public.anime_popularity_events;

create policy "anime_popularity_events_insert_public"
on public.anime_popularity_events
for insert
to anon, authenticated
with check (true);

-- Select is done by the server with service role. Keep public select closed.
notify pgrst, 'reload schema';
