-- AIanime v82 repair: user_history schema compatibility.
-- Run in Supabase SQL editor if profile/history sync says that user_history has no anime_slug.

alter table if exists public.user_history add column if not exists anime_slug text;
alter table if exists public.user_favorites add column if not exists anime_slug text;
alter table if exists public.user_ratings add column if not exists anime_slug text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_history' and column_name = 'slug'
  ) then
    execute 'update public.user_history set anime_slug = slug where anime_slug is null and slug is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_favorites' and column_name = 'slug'
  ) then
    execute 'update public.user_favorites set anime_slug = slug where anime_slug is null and slug is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_ratings' and column_name = 'slug'
  ) then
    execute 'update public.user_ratings set anime_slug = slug where anime_slug is null and slug is not null';
  end if;
end $$;

create unique index if not exists user_history_user_anime_slug_uidx
  on public.user_history(user_id, anime_slug)
  where anime_slug is not null;

create unique index if not exists user_favorites_user_anime_slug_uidx
  on public.user_favorites(user_id, anime_slug)
  where anime_slug is not null;

create unique index if not exists user_ratings_user_anime_slug_uidx
  on public.user_ratings(user_id, anime_slug)
  where anime_slug is not null;
