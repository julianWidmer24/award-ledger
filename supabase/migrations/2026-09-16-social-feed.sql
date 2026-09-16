-- Award Ledger — social feed: posts with photos/videos, kudos and comments, visible to friends.
-- Run once in the Supabase SQL editor after the previous migrations. Safe to re-run.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2000),
  entry_id uuid references public.entries (id) on delete set null,
  expedition_id uuid references public.expeditions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,             -- <user id>/<post id>/<uuid>.<ext> in the media bucket
  kind text not null check (kind in ('image', 'video')),
  mime_type text,
  size_bytes bigint,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists post_media_post_idx on public.post_media (post_id, position);

create table if not exists public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- Private media bucket: readable by the owner and their accepted friends via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 104857600)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "media: owner and friends read" on storage.objects;
create policy "media: owner and friends read" on storage.objects for select
  using (bucket_id = 'media' and (
    auth.uid()::text = (storage.foldername(name))[1]
    or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
  ));
drop policy if exists "media: owner write" on storage.objects;
create policy "media: owner write" on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "media: owner delete" on storage.objects;
create policy "media: owner delete" on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

-- Who may see a post: its author and the author's accepted friends.
create or replace function public.can_see_post(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post and (p.user_id = auth.uid() or public.are_friends(auth.uid(), p.user_id))
  );
$$;

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "posts: read" on public.posts;
create policy "posts: read" on public.posts for select using (auth.uid() = user_id or public.are_friends(auth.uid(), user_id));
drop policy if exists "posts: own write" on public.posts;
create policy "posts: own write" on public.posts for insert with check (auth.uid() = user_id);
drop policy if exists "posts: own edit" on public.posts;
create policy "posts: own edit" on public.posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "posts: own delete" on public.posts;
create policy "posts: own delete" on public.posts for delete using (auth.uid() = user_id);

drop policy if exists "media rows: read" on public.post_media;
create policy "media rows: read" on public.post_media for select using (public.can_see_post(post_id));
drop policy if exists "media rows: own" on public.post_media;
create policy "media rows: own" on public.post_media for insert
  with check (auth.uid() = user_id and exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));
drop policy if exists "media rows: own delete" on public.post_media;
create policy "media rows: own delete" on public.post_media for delete using (auth.uid() = user_id);

drop policy if exists "reactions: read" on public.post_reactions;
create policy "reactions: read" on public.post_reactions for select using (public.can_see_post(post_id));
drop policy if exists "reactions: give" on public.post_reactions;
create policy "reactions: give" on public.post_reactions for insert with check (auth.uid() = user_id and public.can_see_post(post_id));
drop policy if exists "reactions: take back" on public.post_reactions;
create policy "reactions: take back" on public.post_reactions for delete using (auth.uid() = user_id);

drop policy if exists "comments: read" on public.post_comments;
create policy "comments: read" on public.post_comments for select using (public.can_see_post(post_id));
drop policy if exists "comments: write" on public.post_comments;
create policy "comments: write" on public.post_comments for insert with check (auth.uid() = user_id and public.can_see_post(post_id));
drop policy if exists "comments: delete" on public.post_comments;
create policy "comments: delete" on public.post_comments for delete
  using (auth.uid() = user_id or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- The feed, assembled server-side: my posts and my friends' posts, newest first.
create or replace function public.feed(p_limit int default 30, p_before timestamptz default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb) from (
    select p.id, p.user_id, p.caption, p.created_at,
      jsonb_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as author,
      case when e.id is not null then jsonb_build_object('id', e.id, 'date', e.date, 'hours', e.hours, 'activity', a.name, 'area', a.area) end as entry,
      case when x.id is not null then jsonb_build_object('id', x.id, 'name', x.name, 'location', x.location, 'start_date', x.start_date, 'end_date', x.end_date, 'status', x.status) end as expedition,
      coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'kind', m.kind, 'mime', m.mime_type) order by m.position)
                from public.post_media m where m.post_id = p.id), '[]'::jsonb) as media,
      (select count(*) from public.post_reactions r where r.post_id = p.id) as kudos,
      exists (select 1 from public.post_reactions r where r.post_id = p.id and r.user_id = auth.uid()) as kudos_by_me,
      coalesce((select jsonb_agg(pr.display_name order by r.created_at) from (select * from public.post_reactions r2 where r2.post_id = p.id order by r2.created_at limit 3) r
                join public.profiles pr on pr.id = r.user_id), '[]'::jsonb) as kudos_names,
      coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'user_id', c.user_id, 'name', cu.display_name, 'avatar_url', cu.avatar_url, 'body', c.body, 'created_at', c.created_at) order by c.created_at)
                from public.post_comments c join public.profiles cu on cu.id = c.user_id where c.post_id = p.id), '[]'::jsonb) as comments
    from public.posts p
    join public.profiles u on u.id = p.user_id
    left join public.entries e on e.id = p.entry_id
    left join public.activities a on a.id = e.activity_id
    left join public.expeditions x on x.id = p.expedition_id
    where (p.user_id = auth.uid() or public.are_friends(auth.uid(), p.user_id))
      and (p_before is null or p.created_at < p_before)
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100))
  ) t;
$$;

grant all on public.posts, public.post_media, public.post_reactions, public.post_comments to authenticated;
grant execute on all functions in schema public to authenticated;
