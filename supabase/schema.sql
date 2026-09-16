-- Award Ledger — database schema for Supabase.
-- Paste the whole file into the Supabase SQL editor (Database → SQL) and run it once.
-- It is safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- ─── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.area_key as enum ('vps', 'pd', 'pf');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.entry_status as enum ('logged', 'sent', 'validated');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.goal_status as enum ('draft', 'awaiting', 'signed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.expedition_status as enum ('planned', 'completed');
exception when duplicate_object then null; end $$;

-- ─── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  school text,
  friend_code text not null unique,
  birthday date,
  registered_on date,
  target_level text not null default 'gm',
  advisor_name text,
  sharing jsonb not null default '{"hours": true, "target": true, "week": true, "activities": false}',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  area public.area_key not null,
  name text not null,
  validator_name text,
  validator_title text,
  validator_contact text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists activities_user_idx on public.activities (user_id);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  date date not null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  description text,
  status public.entry_status not null default 'logged',
  created_at timestamptz not null default now()
);
create index if not exists entries_user_date_idx on public.entries (user_id, date desc);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  area text not null check (area in ('vps', 'pd', 'pf', 'exp')),
  title text not null default '',
  text text not null default '',
  version int not null default 1,
  status public.goal_status not null default 'draft',
  dated date not null default current_date,
  history jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (user_id, area)
);

create table if not exists public.expeditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  location text,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status public.expedition_status not null default 'planned',
  purpose text,
  itinerary jsonb not null default '[]',
  validator_name text,
  validator_title text,
  validator_contact text,
  reflection text,
  created_at timestamptz not null default now()
);
create index if not exists expeditions_user_idx on public.expeditions (user_id);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists checkins_to_idx on public.checkins (to_user, created_at desc);
create index if not exists checkins_from_idx on public.checkins (from_user, created_at desc);

-- ─── New-user setup ──────────────────────────────────────────────────────────
create or replace function public.generate_friend_code()
returns text language plpgsql as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := substr(letters, 1 + floor(random() * 24)::int, 1)
         || substr(letters, 1 + floor(random() * 24)::int, 1)
         || substr(letters, 1 + floor(random() * 24)::int, 1)
         || '-'
         || (select string_agg(substr(chars, 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 4));
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, friend_code)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    public.generate_friend_code()
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Helpers ─────────────────────────────────────────────────────────────────
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Look a friend up by code and create a pending request. Runs as the owner so
-- users can never list or search other profiles directly.
create or replace function public.send_friend_request(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  code text := upper(trim(p_code));
begin
  if me is null then raise exception 'Not signed in'; end if;
  select * into target from public.profiles where friend_code = code;
  if not found then raise exception 'No one has the code %', code; end if;
  if target.id = me then raise exception 'That is your own friend code'; end if;
  if exists (
    select 1 from public.friendships
    where (requester_id = me and addressee_id = target.id) or (requester_id = target.id and addressee_id = me)
  ) then
    raise exception 'You already have a request or friendship with %', target.display_name;
  end if;
  insert into public.friendships (requester_id, addressee_id) values (me, target.id);
  return target.display_name;
end $$;

create or replace function public.pending_requests()
returns table (id uuid, requester_id uuid, display_name text, school text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.requester_id, p.display_name, p.school, f.created_at
  from public.friendships f
  join public.profiles p on p.id = f.requester_id
  where f.addressee_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

-- What each accepted friend has chosen to share, aggregated server-side so raw
-- entries, descriptions and validators never leave their owner's account.
create or replace function public.friend_summaries()
returns table (
  friendship_id uuid, id uuid, display_name text, school text, target_level text, registered_on date,
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
  select fr.friendship_id, p.id, p.display_name, p.school,
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

create or replace function public.my_checkins()
returns table (id uuid, from_user uuid, to_user uuid, from_name text, to_name text, message text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.from_user, c.to_user, pf.display_name, pt.display_name, c.message, c.created_at
  from public.checkins c
  join public.profiles pf on pf.id = c.from_user
  join public.profiles pt on pt.id = c.to_user
  where c.from_user = auth.uid() or c.to_user = auth.uid()
  order by c.created_at desc
  limit 40;
$$;

-- ─── Row-level security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.entries enable row level security;
alter table public.goals enable row level security;
alter table public.expeditions enable row level security;
alter table public.friendships enable row level security;
alter table public.checkins enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "activities: own" on public.activities;
create policy "activities: own" on public.activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "entries: own" on public.entries;
create policy "entries: own" on public.entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals: own" on public.goals;
create policy "goals: own" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expeditions: own" on public.expeditions;
create policy "expeditions: own" on public.expeditions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Friendships are created through send_friend_request(); either side can end one,
-- and only the addressee can accept.
drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own" on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists "friendships: accept" on public.friendships;
create policy "friendships: accept" on public.friendships for update
  using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);
drop policy if exists "friendships: remove" on public.friendships;
create policy "friendships: remove" on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "checkins: read own" on public.checkins;
create policy "checkins: read own" on public.checkins for select
  using (auth.uid() = from_user or auth.uid() = to_user);
drop policy if exists "checkins: send to friends" on public.checkins;
create policy "checkins: send to friends" on public.checkins for insert
  with check (auth.uid() = from_user and public.are_friends(from_user, to_user));

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
