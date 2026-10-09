-- Gatherings: the one universal feature. A host creates one, points a tag at
-- it, and a tap on that tag is the invitation.
--
-- Same safety semantics as the handshake:
--   * No enumeration: a gathering is reachable only via membership or a tag
--     whose destination points at it (capability = holding the tag). There
--     is no browse surface and no policy that could power one.
--   * Blocks are absolute and invisible: a join blocked by the host gets the
--     same 'gathering not found' as a nonexistent gathering; blocking evicts
--     the blocked party from gatherings the pair hosts for each other.
--   * Multi-step writes (create+self-join, checked join) are
--     security-definer RPCs; plain policies cover owner CRUD only.
--
-- Four mechanisms are load-bearing, marked (a)–(d) below and re-stated by
-- packages/db/test/gatherings.test.ts. A fork may add fields; it must not
-- loosen these (see .agents/skills/customize-gathering/SKILL.md §3).

-- ================================================================== tables ==

create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  location text check (location is null or char_length(location) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.gathering_members (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null default private.current_tenant_id(),
  joined_at timestamptz not null default now(),
  primary key (gathering_id, profile_id)
);

create index gatherings_host_idx on public.gatherings (host_id);
create index gathering_members_profile_idx on public.gathering_members (profile_id);

-- ================================================================= helpers ==

-- (a) Definer: a gathering_members policy cannot reference gathering_members
-- without infinite RLS recursion; this helper reads it with RLS bypassed.
create function private.is_gathering_member(p_gathering uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gathering_members
    where gathering_id = p_gathering and profile_id = p_user
  )
$$;

grant execute on function private.is_gathering_member(uuid, uuid) to authenticated;

-- (b) "Do a and b share any gathering?" — the visibility bridge that lets
-- co-members see each other's cards before they are connections.
create function private.shares_gathering(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.gathering_members ma
      join public.gathering_members mb on mb.gathering_id = ma.gathering_id
     where ma.profile_id = a and mb.profile_id = b
  )
$$;

grant execute on function private.shares_gathering(uuid, uuid) to authenticated;

-- ====================================================================== RLS ==

alter table public.gatherings enable row level security;
alter table public.gathering_members enable row level security;

-- Hosts edit title/time/location only: host_id and tenant_id stay immutable
-- even through RLS-passing rows (the same column-grant idiom as tags).
revoke update on public.gatherings from authenticated;
grant update (title, starts_at, location) on public.gatherings to authenticated;

create policy gatherings_select on public.gatherings
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and (host_id = (select auth.uid())
      or private.is_gathering_member(id, (select auth.uid())))
  );

create policy gatherings_update_host on public.gatherings
  for update to authenticated
  using (tenant_id = private.current_tenant_id() and host_id = (select auth.uid()))
  with check (tenant_id = private.current_tenant_id() and host_id = (select auth.uid()));

create policy gatherings_delete_host on public.gatherings
  for delete to authenticated
  using (tenant_id = private.current_tenant_id() and host_id = (select auth.uid()));

-- The member list is visible to members only. Joining goes through
-- join_gathering(); leaving is deleting your own row. NO insert policy on
-- either table: creation and joining are RPCs.
create policy gathering_members_select on public.gathering_members
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.is_gathering_member(gathering_id, (select auth.uid()))
  );

create policy gathering_members_delete_own on public.gathering_members
  for delete to authenticated
  using (tenant_id = private.current_tenant_id() and profile_id = (select auth.uid()));

-- (b) Co-members of a gathering see each other's cards (the gathering IS the
-- introduction context). profiles_select is dropped and recreated: every
-- clause below is byte-identical to the initial schema; the only addition is
-- the shares_gathering disjunct inside the not-blocked branch.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and (
      id = (select auth.uid())
      -- the blocker always sees whom they blocked (their own list UI),
      -- even under a mutual block
      or exists (
        select 1 from public.blocks b
        where b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id
      )
      or (
        not private.is_blocked((select auth.uid()), id)
        and (
          exists (
            select 1 from public.connections c
            where (c.user_a = (select auth.uid()) and c.user_b = profiles.id)
               or (c.user_b = (select auth.uid()) and c.user_a = profiles.id)
          )
          or exists (
            select 1 from public.connect_requests r
            where r.requester_id = profiles.id
              and r.recipient_id = (select auth.uid())
              and r.status = 'pending'
              and r.expires_at > now()
          )
          or private.shares_gathering((select auth.uid()), profiles.id)
        )
      )
    )
  );

-- (c) Blocking also evicts the blocked party from gatherings the pair hosts
-- for each other, in both directions. Co-membership in third-party
-- gatherings is untouched: the profiles block guard hides those cards.
-- Replaced in place with every attribute of the original restated.
create or replace function private.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_pair(new.blocker_id, new.blocked_id);
  delete from public.connections
   where user_a = least(new.blocker_id, new.blocked_id)
     and user_b = greatest(new.blocker_id, new.blocked_id);
  delete from public.connect_requests
   where status = 'pending'
     and ((requester_id = new.blocker_id and recipient_id = new.blocked_id)
       or (requester_id = new.blocked_id and recipient_id = new.blocker_id));
  delete from public.gathering_members gm
   using public.gatherings g
   where gm.gathering_id = g.id
     and ((g.host_id = new.blocker_id and gm.profile_id = new.blocked_id)
       or (g.host_id = new.blocked_id and gm.profile_id = new.blocker_id));
  return new;
end
$$;

-- ============================================================ destination ==

-- { type: 'gathering', gathering_id } joins the union. The coalesce is
-- load-bearing: a missing key makes the AND chain NULL, and a NULL CHECK
-- result PASSES in Postgres (add-destination-type §2).
alter table public.tags drop constraint tags_destination_shape;
alter table public.tags add constraint tags_destination_shape check (
  destination is null
  or destination = '{"type": "profile"}'::jsonb
  or coalesce(
    jsonb_typeof(destination) = 'object'
    and destination->>'type' = 'gathering'
    and destination->>'gathering_id'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and destination - 'type' - 'gathering_id' = '{}'::jsonb,
    false
  )
);

-- ==================================================================== RPCs ==

-- Create a gathering and join it in one transaction. Returns the entity.
create function public.create_gathering(
  p_title text,
  p_starts_at timestamptz,
  p_location text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_gathering public.gatherings%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'profile required before hosting a gathering' using errcode = 'P0001';
  end if;

  insert into public.gatherings (host_id, title, starts_at, location)
  values (v_user, trim(p_title), p_starts_at, nullif(trim(p_location), ''))
  returning * into v_gathering;

  insert into public.gathering_members (gathering_id, profile_id, tenant_id)
  values (v_gathering.id, v_user, v_gathering.tenant_id);

  return jsonb_build_object(
    'id', v_gathering.id,
    'title', v_gathering.title,
    'starts_at', v_gathering.starts_at,
    'location', v_gathering.location,
    'host_id', v_gathering.host_id,
    'created_at', v_gathering.created_at
  );
end
$$;

-- (d) Join a gathering. A viewer blocked by the host gets 'gathering not
-- found' — byte-identical to the message for a gathering that never existed.
create function public.join_gathering(p_gathering_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_gathering public.gatherings%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'profile required before joining a gathering' using errcode = 'P0001';
  end if;

  select * into v_gathering
    from public.gatherings
   where id = p_gathering_id and tenant_id = private.current_tenant_id();
  if not found then
    raise exception 'gathering not found' using errcode = 'P0003';
  end if;

  -- serialize against a concurrent block by/of the host
  perform private.lock_pair(v_user, v_gathering.host_id);

  if private.is_blocked(v_user, v_gathering.host_id) then
    raise exception 'gathering not found' using errcode = 'P0003';
  end if;

  insert into public.gathering_members (gathering_id, profile_id, tenant_id)
  values (v_gathering.id, v_user, v_gathering.tenant_id)
  on conflict do nothing;
end
$$;

revoke execute on function public.create_gathering(text, timestamptz, text) from public;
revoke execute on function public.join_gathering(uuid) from public;
grant execute on function public.create_gathering(text, timestamptz, text) to authenticated;
grant execute on function public.join_gathering(uuid) to authenticated;

-- ============================================================ resolve_tag ==

-- Replaced to resolve gathering destinations: the claimed payload now ALWAYS
-- carries a 'gathering' key (a summary for gathering tags, null otherwise).
-- A dangling gathering (deleted after the tag was pointed at it) or one the
-- tag's owner no longer belongs to (left, or evicted by a block) degrades to
-- the profile destination: the resolver never breaks, and a tag is an
-- invitation only while its owner is actually in the gathering. A viewer the
-- host blocked gets the profile card too, exactly like a dangling destination.
-- Grants from the initial schema (anon, authenticated) survive the replace.
create or replace function public.resolve_tag(p_uid text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid text := upper(trim(p_uid));
  v_tag public.tags%rowtype;
  v_profile public.profiles%rowtype;
  v_gathering public.gatherings%rowtype;
  v_destination jsonb;
  v_gathering_json jsonb := null;
begin
  select * into v_tag
    from public.tags
   where uid = v_uid and tenant_id = private.current_tenant_id();

  if not found or v_tag.status = 'unclaimed' then
    return jsonb_build_object('status', 'unclaimed', 'uid', v_uid);
  end if;

  if v_tag.status = 'disabled'
     or private.is_blocked((select auth.uid()), v_tag.claimed_by) then
    return jsonb_build_object('status', 'disabled', 'uid', v_uid);
  end if;

  select * into v_profile from public.profiles where id = v_tag.claimed_by;
  if not found then
    return jsonb_build_object('status', 'unclaimed', 'uid', v_uid);
  end if;

  v_destination := v_tag.destination;
  if v_destination->>'type' = 'gathering' then
    select * into v_gathering
      from public.gatherings
     where id = (v_destination->>'gathering_id')::uuid
       and tenant_id = private.current_tenant_id();
    if found
       and private.is_gathering_member(v_gathering.id, v_tag.claimed_by)
       and not private.is_blocked((select auth.uid()), v_gathering.host_id) then
      v_gathering_json := jsonb_build_object(
        'id', v_gathering.id,
        'title', v_gathering.title,
        'starts_at', v_gathering.starts_at,
        'location', v_gathering.location
      );
    else
      v_destination := '{"type": "profile"}'::jsonb;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'claimed',
    'uid', v_uid,
    'destination', v_destination,
    'gathering', v_gathering_json,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'bio', v_profile.bio
    )
  );
end
$$;
