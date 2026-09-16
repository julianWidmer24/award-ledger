-- Award Ledger — profile photos, document uploads and saved links.
-- Run once in the Supabase SQL editor after schema.sql. Safe to re-run.

-- ─── Profile photo ───────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Files live under <user id>/..., so the first path segment is the owner.
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars: owner write" on storage.objects;
create policy "avatars: owner write" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─── Documents (private) ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "documents: owner all" on storage.objects;
create policy "documents: owner all" on storage.objects for all
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─── Saved resources: uploaded files and links ───────────────────────────────
do $$ begin
  create type public.resource_kind as enum ('file', 'link');
exception when duplicate_object then null; end $$;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.resource_kind not null,
  title text not null,
  url text,                 -- links
  storage_path text,        -- files: <user id>/<uuid>-<filename> in the documents bucket
  mime_type text,
  size_bytes bigint,
  category text not null default 'other' check (category in ('record', 'project', 'official', 'other')),
  notes text,
  created_at timestamptz not null default now(),
  check ((kind = 'link' and url is not null) or (kind = 'file' and storage_path is not null))
);
create index if not exists resources_user_idx on public.resources (user_id, created_at desc);

alter table public.resources enable row level security;
drop policy if exists "resources: own" on public.resources;
create policy "resources: own" on public.resources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant all on public.resources to authenticated;

-- ─── Friend functions now carry the photo ────────────────────────────────────
drop function if exists public.pending_requests();
create or replace function public.pending_requests()
returns table (id uuid, requester_id uuid, display_name text, school text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.requester_id, p.display_name, p.school, p.avatar_url, f.created_at
  from public.friendships f
  join public.profiles p on p.id = f.requester_id
  where f.addressee_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

drop function if exists public.friend_summaries();
create or replace function public.friend_summaries()
returns table (
  friendship_id uuid, id uuid, display_name text, school text, avatar_url text, target_level text, registered_on date,
  hours_vps numeric, hours_pd numeric, hours_pf numeric, week_hours numeric, last_logged date, activity_names text[]
)
language sql stable security definer set search_path = public as $$
  with fr as (
    select f.id as friendship_id,
           case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as fid
    from public.friendships f
    where f.status = 'accepted' and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  ),
  hrs as (
    select e.user_id, a.area, sum(e.hours) as h,
           sum(e.hours) filter (where e.date >= current_date - 6) as wk,
           max(e.date) as last
    from public.entries e
    join public.activities a on a.id = e.activity_id
    where e.user_id in (select fid from fr)
    group by e.user_id, a.area
  ),
  agg as (
    select user_id,
           sum(h) filter (where area = 'vps') as vps,
           sum(h) filter (where area = 'pd') as pd,
           sum(h) filter (where area = 'pf') as pf,
           sum(wk) as wk, max(last) as last
    from hrs group by user_id
  )
  select fr.friendship_id, p.id, p.display_name, p.school, p.avatar_url,
         case when coalesce((p.sharing ->> 'target')::boolean, true) then p.target_level end,
         p.registered_on,
         case when coalesce((p.sharing ->> 'hours')::boolean, true) then coalesce(agg.vps, 0) end,
         case when coalesce((p.sharing ->> 'hours')::boolean, true) then coalesce(agg.pd, 0) end,
         case when coalesce((p.sharing ->> 'hours')::boolean, true) then coalesce(agg.pf, 0) end,
         case when coalesce((p.sharing ->> 'week')::boolean, true) then coalesce(agg.wk, 0) end,
         agg.last,
         case when coalesce((p.sharing ->> 'activities')::boolean, false)
              then (select array_agg(a.name order by a.name) from public.activities a where a.user_id = p.id and not a.archived) end
  from fr
  join public.profiles p on p.id = fr.fid
  left join agg on agg.user_id = p.id
  order by p.display_name;
$$;

grant execute on all functions in schema public to authenticated;
