-- AIanime Russian content fields and safe backfill helpers
-- Run in Supabase SQL Editor.

alter table public.anime add column if not exists description_ru text;
alter table public.anime add column if not exists title_ru text;
alter table public.anime add column if not exists title_orig_kodik text;
alter table public.anime add column if not exists kodik_link text;
alter table public.anime add column if not exists kodik_id text;
alter table public.anime add column if not exists kodik_type text;
alter table public.anime add column if not exists kodik_quality text;
alter table public.anime add column if not exists quality text;
alter table public.anime add column if not exists translation_title text;
alter table public.anime add column if not exists translation_type text;
alter table public.anime add column if not exists translation_id bigint;
alter table public.anime add column if not exists kodik_screenshots jsonb default '[]'::jsonb;
alter table public.anime add column if not exists kodik_raw jsonb default '{}'::jsonb;

create index if not exists anime_title_ru_idx on public.anime(title_ru);
create index if not exists anime_kodik_id_idx on public.anime(kodik_id);

select pg_notify('pgrst', 'reload schema');
