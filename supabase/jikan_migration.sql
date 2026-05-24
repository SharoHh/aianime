-- AIanime: переход каталога на Jikan / MyAnimeList.
-- Можно запускать повторно: команды idempotent.

alter table anime add column if not exists mal_id bigint;
create unique index if not exists anime_mal_id_unique_idx on anime(mal_id) where mal_id is not null;
create index if not exists anime_provider_idx on anime(provider);

comment on column anime.mal_id is 'MyAnimeList id from Jikan API. New primary external id for AIanime catalog.';
comment on column anime.shikimori_id is 'Legacy compatibility column. In Jikan fallback mode it can contain MAL id.';

-- Cursor/state для автоматического Jikan cron sync.
create table if not exists public.sync_state (
  id text primary key,
  provider text not null default 'jikan',
  mode text not null default 'catalog',
  next_page integer not null default 1,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  last_error text,
  total_synced bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists sync_state_provider_idx on public.sync_state(provider);

comment on table public.sync_state is 'AIanime cron cursor/state. Used by automatic Jikan/MAL parser to continue from next page instead of parsing the same pages forever.';

-- Kodik metadata enrichment columns. Safe to run with the Jikan migration.
alter table public.anime add column if not exists title_ru text;
alter table public.anime add column if not exists title_orig_kodik text;
alter table public.anime add column if not exists other_title text;
alter table public.anime add column if not exists kodik_id text;
alter table public.anime add column if not exists kodik_link text;
alter table public.anime add column if not exists kodik_type text;
alter table public.anime add column if not exists kodik_year integer;
alter table public.anime add column if not exists kodik_shikimori_id bigint;
alter table public.anime add column if not exists translation_id bigint;
alter table public.anime add column if not exists translation_title text;
alter table public.anime add column if not exists translation_type text;
alter table public.anime add column if not exists quality text;
alter table public.anime add column if not exists kodik_screenshots jsonb not null default '[]'::jsonb;
alter table public.anime add column if not exists kodik_updated_at timestamptz;
alter table public.anime add column if not exists kodik_raw jsonb not null default '{}'::jsonb;

create index if not exists anime_kodik_id_idx on public.anime(kodik_id);
create index if not exists anime_title_ru_idx on public.anime(title_ru);
create index if not exists anime_translation_title_idx on public.anime(translation_title);
create index if not exists anime_kodik_shikimori_id_idx on public.anime(kodik_shikimori_id);


-- Compatibility repair: supports both old manual sync_state and current cron cursor schema.
alter table public.sync_state add column if not exists mode text default 'catalog';
alter table public.sync_state add column if not exists next_page integer default 1;
alter table public.sync_state add column if not exists last_started_at timestamptz;
alter table public.sync_state add column if not exists last_finished_at timestamptz;
alter table public.sync_state add column if not exists last_status text;
alter table public.sync_state add column if not exists total_synced bigint default 0;
alter table public.sync_state add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.sync_state add column if not exists page integer default 1;
alter table public.sync_state add column if not exists max_page integer default 200;
alter table public.sync_state add column if not exists last_run_at timestamptz;
alter table public.sync_state add column if not exists last_success_at timestamptz;
alter table public.sync_state add column if not exists meta jsonb default '{}'::jsonb;
alter table public.sync_state add column if not exists created_at timestamptz default now();
alter table public.sync_state add column if not exists updated_at timestamptz default now();

insert into public.sync_state (id, provider, mode, next_page, page, max_page, metadata, meta)
values
  ('jikan_catalog', 'jikan', 'catalog', 1, 1, 200, '{}'::jsonb, '{}'::jsonb),
  ('kodik_metadata', 'kodik', 'metadata', 1, 1, 200, '{}'::jsonb, '{}'::jsonb),
  ('kodik_players', 'kodik-player', 'players', 1, 1, 200, '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
