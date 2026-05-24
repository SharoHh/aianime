-- AIanime production schema patch for Russian titles, Kodik metadata and poster/player sync.
-- Safe to run many times in Supabase SQL Editor.

alter table public.anime add column if not exists mal_id bigint;
alter table public.anime add column if not exists title_ru text;
alter table public.anime add column if not exists description_ru text;
alter table public.anime add column if not exists title_orig text;
alter table public.anime add column if not exists title_orig_kodik text;
alter table public.anime add column if not exists other_title text;

alter table public.anime add column if not exists kodik_id text;
alter table public.anime add column if not exists kodik_link text;
alter table public.anime add column if not exists kodik_type text;
alter table public.anime add column if not exists kodik_year integer;
alter table public.anime add column if not exists kodik_quality text;
alter table public.anime add column if not exists kodik_shikimori_id bigint;
alter table public.anime add column if not exists kodik_match_score integer;
alter table public.anime add column if not exists kodik_raw jsonb default '{}'::jsonb;
alter table public.anime add column if not exists kodik_screenshots jsonb default '[]'::jsonb;
alter table public.anime add column if not exists kodik_created_at timestamptz;
alter table public.anime add column if not exists kodik_updated_at timestamptz;

alter table public.anime add column if not exists translation_id bigint;
alter table public.anime add column if not exists translation_name text;
alter table public.anime add column if not exists translation_title text;
alter table public.anime add column if not exists translation_type text;
alter table public.anime add column if not exists kodik_translation_id bigint;
alter table public.anime add column if not exists kodik_translation_title text;
alter table public.anime add column if not exists kodik_translation_type text;

alter table public.anime add column if not exists screenshots jsonb default '[]'::jsonb;
alter table public.anime add column if not exists blocked_countries jsonb default '[]'::jsonb;
alter table public.anime add column if not exists camrip boolean default false;
alter table public.anime add column if not exists lgbt boolean default false;
alter table public.anime add column if not exists kinopoisk_id bigint;
alter table public.anime add column if not exists imdb_id text;
alter table public.anime add column if not exists worldart_link text;

create index if not exists anime_mal_id_idx on public.anime(mal_id);
create index if not exists anime_kodik_id_idx on public.anime(kodik_id);
create index if not exists anime_kodik_shikimori_id_idx on public.anime(kodik_shikimori_id);
create index if not exists anime_kodik_match_score_idx on public.anime(kodik_match_score);
create index if not exists anime_title_ru_idx on public.anime(title_ru);
create index if not exists anime_translation_id_idx on public.anime(translation_id);

select pg_notify('pgrst', 'reload schema');
