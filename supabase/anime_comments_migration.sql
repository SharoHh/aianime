-- AIanime comments: public comments with admin moderation.
create table if not exists public.anime_comments (
  id bigserial primary key,
  anime_slug text not null,
  user_id uuid,
  user_name text,
  text text not null,
  status text not null default 'published',
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.anime_comments
  add column if not exists anime_slug text,
  add column if not exists user_id uuid,
  add column if not exists user_name text,
  add column if not exists text text,
  add column if not exists status text default 'published',
  add column if not exists likes integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists anime_comments_slug_created_idx
  on public.anime_comments (anime_slug, created_at desc);

create index if not exists anime_comments_status_created_idx
  on public.anime_comments (status, created_at desc);

create index if not exists anime_comments_user_idx
  on public.anime_comments (user_id);

alter table public.anime_comments enable row level security;

-- Public site can read only published comments through anon/client access.
drop policy if exists "Public can read published comments" on public.anime_comments;
create policy "Public can read published comments"
on public.anime_comments
for select
to anon, authenticated
using (status = 'published');

-- Authenticated users can insert their own comments if the client writes directly.
-- The production UI uses /api/comments, but this keeps Supabase rules sane.
drop policy if exists "Users can create own comments" on public.anime_comments;
create policy "Users can create own comments"
on public.anime_comments
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can update/delete only their own comments through direct client access.
-- Admin moderation uses service_role through /api/admin/comments.
drop policy if exists "Users can update own comments" on public.anime_comments;
create policy "Users can update own comments"
on public.anime_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own comments" on public.anime_comments;
create policy "Users can delete own comments"
on public.anime_comments
for delete
to authenticated
using (auth.uid() = user_id);

-- v26: persistent comment likes, one vote per user/browser key.
create table if not exists public.anime_comment_likes (
  id bigserial primary key,
  comment_id bigint not null references public.anime_comments(id) on delete cascade,
  user_id uuid,
  client_id text,
  voter_key text not null,
  created_at timestamptz not null default now()
);

alter table public.anime_comment_likes
  add column if not exists comment_id bigint,
  add column if not exists user_id uuid,
  add column if not exists client_id text,
  add column if not exists voter_key text,
  add column if not exists created_at timestamptz default now();

create unique index if not exists anime_comment_likes_unique_vote_idx
  on public.anime_comment_likes (comment_id, voter_key);

create index if not exists anime_comment_likes_comment_idx
  on public.anime_comment_likes (comment_id);

create index if not exists anime_comment_likes_user_idx
  on public.anime_comment_likes (user_id);

alter table public.anime_comment_likes enable row level security;

-- Likes are written through /api/comments with service_role.
-- Direct client access stays closed by default.
