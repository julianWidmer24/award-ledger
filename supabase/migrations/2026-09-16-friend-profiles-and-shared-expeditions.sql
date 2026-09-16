-- Award Ledger — friend profiles (shared goals/log) and collaborative expeditions.
-- Run once in the Supabase SQL editor after the previous migrations. Safe to re-run.

-- ─── Friend profile: what a friend may see, assembled server-side ───────────
create or replace function public.friend_profile(p_friend uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  p public.profiles%rowtype;
  share_goals boolean; share_logs boolean; share_hours boolean; share_target boolean;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not public.are_friends(me, p_friend) then raise exception 'You can only view profiles of accepted friends'; end if;
  select * into p from public.profiles where id = p_friend;
  share_goals  := coalesce((p.sharing ->> 'goals')::boolean, true);
  share_logs   := coalesce((p.sharing ->> 'logs')::boolean, true);
  share_hours  := coalesce((p.sharing ->> 'hours')::boolean, true);
  share_target := coalesce((p.sharing ->> 'target')::boolean, true);
  return jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'school', p.school, 'avatar_url', p.avatar_url,
    'registered_on', p.registered_on,
    'target_level', case when share_target then p.target_level end,
    'shares', jsonb_build_object('goals', share_goals, 'logs', share_logs, 'hours', share_hours, 'target', share_target),
    'hours', case when share_hours then coalesce((
        select jsonb_object_agg(x.area, x.h) from (
          select a.area::text as area, coalesce(sum(e.hours), 0) as h
          from public.activities a left join public.entries e on e.activity_id = a.id
          where a.user_id = p_friend group by a.area
        ) x), '{}'::jsonb) end,
    'goals', case when share_goals then coalesce((
        select jsonb_agg(jsonb_build_object('area', g.area, 'title', g.title, 'text', g.text, 'status', g.status, 'version', g.version, 'dated', g.dated) order by g.area)
        from public.goals g where g.user_id = p_friend), '[]'::jsonb) end,
    'entries', case when share_logs then coalesce((
        select jsonb_agg(jsonb_build_object('id', e.id, 'date', e.date, 'hours', e.hours, 'status', e.status, 'activity', a.name, 'area', a.area) order by e.date desc, e.created_at desc)
        from (select * from public.entries where user_id = p_friend order by date desc, created_at desc limit 80) e
        join public.activities a on a.id = e.activity_id), '[]'::jsonb) end
  );
end $$;

-- ─── Shared expeditions ─────────────────────────────────────────────────────
create table if not exists public.expedition_members (
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'accepted')),
  invited_by uuid references public.profiles (id) on delete set null,
  reflection text,
  created_at timestamptz not null default now(),
  primary key (expedition_id, user_id)
);
create index if not exists expedition_members_user_idx on public.expedition_members (user_id);

-- Owners are members too; carry any existing personal reflection across.
insert into public.expedition_members (expedition_id, user_id, role, status, reflection)
select id, user_id, 'owner', 'accepted', reflection from public.expeditions
on conflict (expedition_id, user_id) do nothing;

create or replace function public.handle_new_expedition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.expedition_members (expedition_id, user_id, role, status)
  values (new.id, new.user_id, 'owner', 'accepted')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_expedition_created on public.expeditions;
create trigger on_expedition_created after insert on public.expeditions
  for each row execute function public.handle_new_expedition();

-- Membership status for a user ('invited' | 'accepted' | null). Security definer so
-- row policies on expeditions and members can consult it without recursing.
create or replace function public.expedition_access(p_exp uuid, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select status from public.expedition_members where expedition_id = p_exp and user_id = p_user;
$$;

create or replace function public.expedition_members_view(p_exp uuid)
returns table (user_id uuid, display_name text, avatar_url text, role text, status text, invited_by_name text)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.display_name, p.avatar_url, m.role, m.status, inv.display_name
  from public.expedition_members m
  join public.profiles p on p.id = m.user_id
  left join public.profiles inv on inv.id = m.invited_by
  where m.expedition_id = p_exp and public.expedition_access(p_exp, auth.uid()) is not null
  order by (m.role = 'owner') desc, p.display_name;
$$;

alter table public.expedition_members enable row level security;

drop policy if exists "expeditions: own" on public.expeditions;
drop policy if exists "expeditions: read" on public.expeditions;
create policy "expeditions: read" on public.expeditions for select
  using (auth.uid() = user_id or public.expedition_access(id, auth.uid()) is not null);
drop policy if exists "expeditions: create" on public.expeditions;
create policy "expeditions: create" on public.expeditions for insert with check (auth.uid() = user_id);
drop policy if exists "expeditions: edit" on public.expeditions;
create policy "expeditions: edit" on public.expeditions for update
  using (auth.uid() = user_id or public.expedition_access(id, auth.uid()) = 'accepted')
  with check (auth.uid() = user_id or public.expedition_access(id, auth.uid()) = 'accepted');
drop policy if exists "expeditions: delete" on public.expeditions;
create policy "expeditions: delete" on public.expeditions for delete using (auth.uid() = user_id);

drop policy if exists "members: read" on public.expedition_members;
create policy "members: read" on public.expedition_members for select
  using (public.expedition_access(expedition_id, auth.uid()) is not null);
drop policy if exists "members: invite friends" on public.expedition_members;
create policy "members: invite friends" on public.expedition_members for insert
  with check (
    role = 'member' and status = 'invited' and invited_by = auth.uid()
    and public.are_friends(auth.uid(), user_id)
    and exists (select 1 from public.expeditions x where x.id = expedition_id and x.user_id = auth.uid())
  );
drop policy if exists "members: own row" on public.expedition_members;
create policy "members: own row" on public.expedition_members for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id and role = (select role from public.expedition_members m2 where m2.expedition_id = expedition_id and m2.user_id = auth.uid()));
drop policy if exists "members: leave or remove" on public.expedition_members;
create policy "members: leave or remove" on public.expedition_members for delete
  using (
    (auth.uid() = user_id and role <> 'owner')
    or exists (select 1 from public.expeditions x where x.id = expedition_id and x.user_id = auth.uid() and x.user_id <> expedition_members.user_id)
  );

grant all on public.expedition_members to authenticated;
grant execute on all functions in schema public to authenticated;
