-- AIanime v297: authentication security hardening.
-- Run once in Supabase SQL Editor after checking the table names.
-- Safe to run repeatedly.

-- Profiles must never be readable or writable by another user.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';

    execute 'drop policy if exists "Users can read own profile" on public.profiles';
    execute 'drop policy if exists "Users can insert own profile" on public.profiles';
    execute 'drop policy if exists "Users can update own profile" on public.profiles';
    execute 'drop policy if exists "Users can delete own profile" on public.profiles';

    execute 'create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id)';
    execute 'create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id)';
    execute 'create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)';
    execute 'create policy "Users can delete own profile" on public.profiles for delete to authenticated using (auth.uid() = id)';

    execute 'revoke all on table public.profiles from anon';
    execute 'grant select, insert, update, delete on table public.profiles to authenticated';
  end if;
end $$;

-- Personal tables already have own-row policies in user_schema.sql. Re-enable RLS
-- defensively in case it was disabled manually in the dashboard.
alter table if exists public.user_favorites enable row level security;
alter table if exists public.user_history enable row level security;
alter table if exists public.user_ratings enable row level security;
alter table if exists public.user_ai_history enable row level security;
alter table if exists public.user_anime_library enable row level security;

-- Quick verification report. Every personal table should show rowsecurity = true.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles','user_favorites','user_history','user_ratings','user_ai_history','user_anime_library')
order by c.relname;
