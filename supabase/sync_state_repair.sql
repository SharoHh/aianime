-- AIanime sync_state compatibility repair.
-- Run this if diagnostics says sync_state is missing columns or if cron state writes fail.

create table if not exists public.sync_state (
  id text primary key,
  provider text not null default 'jikan',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sync_state add column if not exists mode text default 'catalog';
alter table public.sync_state add column if not exists next_page integer default 1;
alter table public.sync_state add column if not exists last_started_at timestamptz;
alter table public.sync_state add column if not exists last_finished_at timestamptz;
alter table public.sync_state add column if not exists last_status text;
alter table public.sync_state add column if not exists last_error text;
alter table public.sync_state add column if not exists total_synced bigint default 0;
alter table public.sync_state add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.sync_state add column if not exists page integer default 1;
alter table public.sync_state add column if not exists max_page integer default 200;
alter table public.sync_state add column if not exists last_run_at timestamptz;
alter table public.sync_state add column if not exists last_success_at timestamptz;
alter table public.sync_state add column if not exists meta jsonb default '{}'::jsonb;

create index if not exists sync_state_provider_idx on public.sync_state(provider);

insert into public.sync_state (id, provider, mode, next_page, page, max_page, metadata, meta)
values
  ('jikan_catalog', 'jikan', 'catalog', 1, 1, 200, '{}'::jsonb, '{}'::jsonb),
  ('kodik_metadata', 'kodik', 'metadata', 1, 1, 200, '{}'::jsonb, '{}'::jsonb),
  ('kodik_players', 'kodik-player', 'players', 1, 1, 200, '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
