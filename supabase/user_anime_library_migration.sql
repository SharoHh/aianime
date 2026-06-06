-- AIanime v175: личная библиотека пользователя.
-- Статусы: watching / planned / completed / dropped.

create table if not exists public.user_anime_library (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_slug text not null,
  status text not null check (status in ('watching', 'planned', 'completed', 'dropped')),
  title text,
  poster text,
  rating text,
  meta text,
  episode integer default 1,
  voice text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, anime_slug)
);

create index if not exists user_anime_library_user_idx
  on public.user_anime_library(user_id);

create index if not exists user_anime_library_user_status_idx
  on public.user_anime_library(user_id, status, updated_at desc);

alter table public.user_anime_library enable row level security;

drop policy if exists "Users can manage own anime library" on public.user_anime_library;
create policy "Users can manage own anime library" on public.user_anime_library
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
