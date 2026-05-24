-- User account data tables
create table if not exists user_favorites (
  id bigserial primary key,
  user_id uuid not null,
  anime_slug text not null,
  title text,
  poster text,
  rating text,
  meta text,
  saved_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique(user_id, anime_slug)
);

create table if not exists user_history (
  id bigserial primary key,
  user_id uuid not null,
  anime_slug text not null,
  title text,
  poster text,
  banner text,
  episode integer default 1,
  progress numeric default 0,
  watched_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, anime_slug)
);

create table if not exists user_ratings (
  id bigserial primary key,
  user_id uuid not null,
  anime_slug text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  updated_at timestamp with time zone default now(),
  unique(user_id, anime_slug)
);

create table if not exists user_ai_history (
  id bigserial primary key,
  user_id uuid not null,
  query text not null,
  created_at timestamp with time zone default now()
);

create index if not exists user_favorites_user_idx on user_favorites(user_id);
create index if not exists user_history_user_idx on user_history(user_id);
create index if not exists user_ratings_user_idx on user_ratings(user_id);
create index if not exists user_ai_history_user_idx on user_ai_history(user_id);

alter table user_favorites enable row level security;
alter table user_history enable row level security;
alter table user_ratings enable row level security;
alter table user_ai_history enable row level security;

drop policy if exists "Users can manage own favorites" on user_favorites;
create policy "Users can manage own favorites" on user_favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own history" on user_history;
create policy "Users can manage own history" on user_history
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own ratings" on user_ratings;
create policy "Users can manage own ratings" on user_ratings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can manage own ai history" on user_ai_history;
create policy "Users can manage own ai history" on user_ai_history
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AIanime live site statistics: real online users by heartbeat.
create table if not exists public.site_presence (
  visitor_id text primary key,
  page text,
  last_seen timestamptz not null default now()
);

create index if not exists site_presence_last_seen_idx
  on public.site_presence (last_seen desc);
