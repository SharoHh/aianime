-- AIanime v162: player/episode issue reports.
-- Run this in Supabase SQL editor once before using /admin/reports.

create table if not exists public.player_reports (
  id bigserial primary key,
  anime_slug text not null,
  anime_title text,
  episode_number integer,
  voice text,
  reason text not null default 'other',
  reason_label text,
  message text,
  page_url text,
  user_id uuid,
  user_email text,
  user_name text,
  client_id text,
  status text not null default 'open',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_reports_status_check check (status in ('open','checking','fixed','ignored')),
  constraint player_reports_reason_check check (reason in ('not_loading','wrong_episode','wrong_voice','bad_quality','other'))
);

create index if not exists player_reports_status_created_idx on public.player_reports (status, created_at desc);
create index if not exists player_reports_anime_slug_idx on public.player_reports (anime_slug);
create index if not exists player_reports_created_idx on public.player_reports (created_at desc);

alter table public.player_reports enable row level security;

-- Direct public table access is blocked. The app writes/reads through server API with service role.
drop policy if exists "No direct public access to player reports" on public.player_reports;
create policy "No direct public access to player reports"
  on public.player_reports
  for all
  using (false)
  with check (false);
