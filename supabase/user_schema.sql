-- AIanime user account data tables
-- Safe migration: can be run multiple times on existing/old schemas.

create table if not exists public.user_favorites (
  id bigserial primary key,
  user_id uuid not null,
  anime_slug text not null,
  title text,
  poster text,
  rating text,
  meta text,
  saved_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, anime_slug)
);

create table if not exists public.user_history (
  id bigserial primary key,
  user_id uuid not null,
  anime_slug text not null,
  title text,
  poster text,
  banner text,
  episode integer default 1,
  progress numeric default 0,
  voice text,
  provider text,
  watched_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, anime_slug)
);

create table if not exists public.user_ratings (
  id bigserial primary key,
  user_id uuid not null,
  anime_slug text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, anime_slug)
);

create table if not exists public.user_ai_history (
  id bigserial primary key,
  user_id uuid not null,
  query text not null,
  created_at timestamptz default now()
);

-- Existing-table compatibility. CREATE TABLE IF NOT EXISTS does not add missing columns,

-- v82 compatibility: older tables may exist without anime_slug.
alter table if exists public.user_favorites add column if not exists anime_slug text;
alter table if exists public.user_history add column if not exists anime_slug text;
alter table if exists public.user_ratings add column if not exists anime_slug text;

create unique index if not exists user_favorites_user_anime_slug_uidx
  on public.user_favorites(user_id, anime_slug)
  where anime_slug is not null;
create unique index if not exists user_history_user_anime_slug_uidx
  on public.user_history(user_id, anime_slug)
  where anime_slug is not null;
create unique index if not exists user_ratings_user_anime_slug_uidx
  on public.user_ratings(user_id, anime_slug)
  where anime_slug is not null;

-- so every column used by app/indexes is added explicitly.
alter table if exists public.user_favorites add column if not exists title text;
alter table if exists public.user_favorites add column if not exists poster text;
alter table if exists public.user_favorites add column if not exists rating text;
alter table if exists public.user_favorites add column if not exists meta text;
alter table if exists public.user_favorites add column if not exists saved_at timestamptz default now();
alter table if exists public.user_favorites add column if not exists updated_at timestamptz default now();
alter table if exists public.user_favorites add column if not exists created_at timestamptz default now();

alter table if exists public.user_history add column if not exists title text;
alter table if exists public.user_history add column if not exists poster text;
alter table if exists public.user_history add column if not exists banner text;
alter table if exists public.user_history add column if not exists episode integer default 1;
alter table if exists public.user_history add column if not exists progress numeric default 0;
alter table if exists public.user_history add column if not exists voice text;
alter table if exists public.user_history add column if not exists provider text;
alter table if exists public.user_history add column if not exists watched_at timestamptz default now();
alter table if exists public.user_history add column if not exists updated_at timestamptz default now();
alter table if exists public.user_history add column if not exists created_at timestamptz default now();

alter table if exists public.user_ratings add column if not exists updated_at timestamptz default now();
alter table if exists public.user_ratings add column if not exists created_at timestamptz default now();

alter table if exists public.user_ai_history add column if not exists created_at timestamptz default now();

create index if not exists user_favorites_user_idx on public.user_favorites(user_id);
create index if not exists user_history_user_idx on public.user_history(user_id);
create index if not exists user_ratings_user_idx on public.user_ratings(user_id);
create index if not exists user_ai_history_user_idx on public.user_ai_history(user_id);

create index if not exists user_favorites_user_saved_idx on public.user_favorites(user_id, saved_at desc);
create index if not exists user_history_user_watched_idx on public.user_history(user_id, watched_at desc);
create index if not exists user_ratings_user_updated_idx on public.user_ratings(user_id, updated_at desc);

alter table public.user_favorites enable row level security;
alter table public.user_history enable row level security;
alter table public.user_ratings enable row level security;
alter table public.user_ai_history enable row level security;

drop policy if exists "Users can manage own favorites" on public.user_favorites;
create policy "Users can manage own favorites" on public.user_favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own history" on public.user_history;
create policy "Users can manage own history" on public.user_history
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own ratings" on public.user_ratings;
create policy "Users can manage own ratings" on public.user_ratings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own ai history" on public.user_ai_history;
create policy "Users can manage own ai history" on public.user_ai_history
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AIanime live site statistics: real online users by heartbeat.
create table if not exists public.site_presence (
  visitor_id text primary key,
  page text,
  last_seen timestamptz not null default now()
);

create index if not exists site_presence_last_seen_idx
  on public.site_presence (last_seen desc);

-- Profile additions. Safe to run multiple times.
alter table if exists public.profiles add column if not exists profile_status text;
alter table if exists public.profiles add column if not exists profile_payload jsonb default '{}'::jsonb;
alter table if exists public.profiles add column if not exists banner_url text;
alter table if exists public.profiles add column if not exists bio text;
alter table if exists public.profiles add column if not exists updated_at timestamptz default now();

-- AIanime v123 popularity events: views/clicks used for “Популярное сейчас”.
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
create policy "anime_popularity_events_insert_public"
on public.anime_popularity_events
for insert
to anon, authenticated
with check (true);
