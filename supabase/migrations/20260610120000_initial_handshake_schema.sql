-- withme-starter initial schema: the V1 handshake.
--
-- Single-tenant with a dormant multi-tenant seam: every table carries
-- tenant_id defaulting to the fixed default tenant, and every RLS policy
-- predicates on it. V1 never varies it; a future config layer swaps
-- private.current_tenant_id() without migration pain.
--
-- Safety semantics are enforced HERE (RLS + security-definer functions),
-- not in UI:
--   * Blocks are absolute and invisible (silent drops, no signal ever).
--   * No enumeration: profiles reachable only via tag scan or connection.
--   * Unilateral connection removal; requests expire after 7 days.
--   * Rate limiting on connect requests (10/hour, counted server-side).
--   * Account deletion cascades (requests/connections/blocks) and resets
--     claimed tags to unclaimed, deleting their scan history.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ============================================================ tenant seam ==

create function private.current_tenant_id()
returns uuid
language sql
stable
as $$
  select '00000000-0000-0000-0000-000000000001'::uuid
$$;

grant execute on function private.current_tenant_id() to anon, authenticated;

-- =================================================================== enums ==

create type public.tag_status as enum ('unclaimed', 'claimed', 'disabled');
create type public.connect_request_status as enum ('pending', 'accepted', 'declined', 'expired');

-- ================================================================== tables ==

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null default private.current_tenant_id(),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  -- The immutable NFC UID (NTAG213-style: 7 bytes, 14 hex chars, uppercase).
  uid text primary key check (uid ~ '^[0-9A-F]{14}$'),
  tenant_id uuid not null default private.current_tenant_id(),
  claimed_by uuid references public.profiles (id),
  destination jsonb,
  status public.tag_status not null default 'unclaimed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- destination must match the typed union from @withme/contract exactly —
  -- no extra keys, no oversized payloads. V1 has one member; future types
  -- extend this constraint by migration.
  constraint tags_destination_shape check (
    destination is null
    or destination = '{"type": "profile"}'::jsonb
  ),
  constraint tags_state_consistent check (
    (status <> 'unclaimed' or (claimed_by is null and destination is null))
    and (status <> 'claimed' or (claimed_by is not null and destination is not null))
  )
);

create table public.tag_scans (
  id uuid primary key default gen_random_uuid(),
  tag_uid text not null references public.tags (uid) on delete cascade,
  tenant_id uuid not null default private.current_tenant_id(),
  scanned_at timestamptz not null default now(),
  user_agent text
  -- Privacy-default by design: no GPS, no IP, no fingerprint columns.
);

create table public.connect_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status public.connect_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  constraint connect_requests_distinct_parties check (requester_id <> recipient_id)
);

-- One pending request per directed pair. Expired-but-still-pending rows are
-- swept lazily in send_connect_request, so re-sending after expiry works.
create unique index connect_requests_one_pending_per_pair
  on public.connect_requests (requester_id, recipient_id)
  where status = 'pending';

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint connections_canonical_order check (user_a < user_b),
  constraint connections_unique_pair unique (user_a, user_b)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_distinct_parties check (blocker_id <> blocked_id),
  constraint blocks_unique_pair unique (blocker_id, blocked_id)
);

-- Invisible rate-limit ledger: every send attempt lands here (stored or
-- silently dropped alike), so the rate limiter cannot become a block oracle.
-- Not exposed via PostgREST; rows self-clean per user inside the send RPC.
create table private.connect_request_attempts (
  requester_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index connect_request_attempts_requester_idx
  on private.connect_request_attempts (requester_id, attempted_at desc);

-- Defense in depth: deny-all RLS so the ledger stays invisible to client
-- roles even if the private schema were ever exposed. Definer functions
-- (owned by postgres) are unaffected.
alter table private.connect_request_attempts enable row level security;

-- ================================================================= indexes ==

create index tags_claimed_by_idx on public.tags (claimed_by);
create index tag_scans_tag_uid_scanned_at_idx on public.tag_scans (tag_uid, scanned_at desc);
create index connect_requests_recipient_pending_idx
  on public.connect_requests (recipient_id) where status = 'pending';
create index connections_user_a_idx on public.connections (user_a);
create index connections_user_b_idx on public.connections (user_b);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ================================================================= helpers ==

-- "Is p_viewer blocked by p_owner?" Definer so it sees blocks regardless of
-- the caller's RLS view (the blocked user must never be able to detect it).
create function private.is_blocked(p_viewer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = p_owner and blocked_id = p_viewer
  )
$$;

grant execute on function private.is_blocked(uuid, uuid) to anon, authenticated;

-- Serializes all relationship mutations (send/accept/block) for a user pair
-- within their transactions, closing block-vs-send and block-vs-accept races
-- that could otherwise leave a request or connection coexisting with a block.
create function private.lock_pair(a uuid, b uuid)
returns void
language sql
as $$
  select pg_advisory_xact_lock(
    hashtextextended(least(a, b)::text || ':' || greatest(a, b)::text, 0)
  )
$$;

grant execute on function private.lock_pair(uuid, uuid) to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function private.set_updated_at();

-- Blocking auto-removes the connection and cancels pending requests in both
-- directions. Deletion (not status change) leaves no trace either party
-- could read as a signal.
create function private.on_block_created()
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
  return new;
end
$$;

create trigger blocks_after_insert
  after insert on public.blocks
  for each row execute function private.on_block_created();

-- Account-deletion cascade, the parts FKs cannot express: claimed tags reset
-- to unclaimed with destination nulled, and their scan history is deleted.
-- (Connections, requests, and blocks cascade via FKs; profiles cascade from
-- auth.users.)
create function private.on_profile_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tag_scans
   where tag_uid in (select uid from public.tags where claimed_by = old.id);
  update public.tags
     set claimed_by = null, destination = null, status = 'unclaimed'
   where claimed_by = old.id;
  return old;
end
$$;

create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function private.on_profile_deleted();

-- ====================================================================== RLS ==

alter table public.profiles enable row level security;
alter table public.tags enable row level security;
alter table public.tag_scans enable row level security;
alter table public.connect_requests enable row level security;
alter table public.connections enable row level security;
alter table public.blocks enable row level security;

-- --- profiles ---------------------------------------------------------------
-- No enumeration: a profile is visible only to (a) itself, (b) a connection,
-- (c) the recipient of its live pending request (the consent surface), or
-- (d) someone who blocked it (the blocker's list UI). Anonymous tap-resolution
-- goes through resolve_tag(), which is capability-based on knowing the UID —
-- there is deliberately NO anon select policy here.
-- A blocked viewer sees nothing, ever.

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
        )
      )
    )
  );

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and tenant_id = private.current_tenant_id());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and tenant_id = private.current_tenant_id())
  with check (id = (select auth.uid()) and tenant_id = private.current_tenant_id());

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()) and tenant_id = private.current_tenant_id());

-- --- tags --------------------------------------------------------------------
-- Owners manage their claimed tags (disable/re-enable, change destination).
-- Claiming is atomic via claim_tag(); provisioning new tags is an operator
-- action (service role / seed). No anon access — resolution is RPC-only.
-- Column-level grants pin owner updates to (destination, status): the uid is
-- immutable (a writable PK would let an owner squat on future tag batches),
-- and claimed_by/tenant_id can never be reassigned by a client.

revoke update on public.tags from authenticated;
grant update (destination, status) on public.tags to authenticated;

create policy tags_select_own on public.tags
  for select to authenticated
  using (tenant_id = private.current_tenant_id() and claimed_by = (select auth.uid()));

create policy tags_update_own on public.tags
  for update to authenticated
  using (tenant_id = private.current_tenant_id() and claimed_by = (select auth.uid()))
  with check (tenant_id = private.current_tenant_id() and claimed_by = (select auth.uid()));

-- --- tag_scans ---------------------------------------------------------------
-- No client-role policies at all: inserts happen only through log_scan(),
-- and V1 exposes no scan reads (no analytics — that's the invariant).

-- --- connect_requests --------------------------------------------------------
-- Recipients see requests addressed to them. Requesters deliberately cannot
-- read their own outgoing rows: if they could, a silently-dropped (blocked)
-- request would be visible by its absence. Writes go through RPCs only.

create policy connect_requests_select_recipient on public.connect_requests
  for select to authenticated
  using (tenant_id = private.current_tenant_id() and recipient_id = (select auth.uid()));

-- --- connections -------------------------------------------------------------

create policy connections_select on public.connections
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and ((select auth.uid()) in (user_a, user_b))
  );

-- Unilateral remove: either party deletes; the other is not notified.
create policy connections_delete on public.connections
  for delete to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and ((select auth.uid()) in (user_a, user_b))
  );

-- --- blocks ------------------------------------------------------------------
-- Only the blocker ever sees a block, in any direction.

create policy blocks_select on public.blocks
  for select to authenticated
  using (tenant_id = private.current_tenant_id() and blocker_id = (select auth.uid()));

create policy blocks_insert on public.blocks
  for insert to authenticated
  with check (tenant_id = private.current_tenant_id() and blocker_id = (select auth.uid()));

create policy blocks_delete on public.blocks
  for delete to authenticated
  using (tenant_id = private.current_tenant_id() and blocker_id = (select auth.uid()));

-- ==================================================================== RPCs ==

-- Resolve a tap. Capability-based: knowing the unguessable UID is the only
-- way in. A viewer blocked by the tag owner gets 'disabled' —
-- indistinguishable from a deactivated tag. Unknown UIDs resolve as
-- 'unclaimed' so the resolver page never breaks.
--
-- Known residual signal (deliberate trade-off): someone holding the physical
-- tag can compare a signed-in resolve ('disabled') with an anonymous one
-- ('claimed') and infer a block. Hiding the profile from a blocked viewer and
-- hiding the block from someone with the tag in hand are mutually exclusive;
-- V1 chooses profile invisibility, which is the stronger safety property.
create function public.resolve_tag(p_uid text)
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

  return jsonb_build_object(
    'status', 'claimed',
    'uid', v_uid,
    'destination', v_tag.destination,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'bio', v_profile.bio
    )
  );
end
$$;

-- Log a tap. Unknown UID is a silent no-op — the resolver must be unbreakable.
-- A per-UID floor throttle (60/min) bounds direct anonymous PostgREST abuse;
-- the API Worker applies its own edge rate limit in front of this.
create function public.log_scan(p_uid text, p_user_agent text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid text := upper(trim(p_uid));
begin
  if (
    select count(*)
      from public.tag_scans
     where tag_uid = v_uid and scanned_at > now() - interval '1 minute'
  ) >= 60 then
    return;
  end if;

  insert into public.tag_scans (tag_uid, tenant_id, user_agent)
  select t.uid, t.tenant_id, nullif(left(p_user_agent, 512), '')
    from public.tags t
   where t.uid = v_uid;
end
$$;

-- Atomically claim an unclaimed tag for the calling user.
create function public.claim_tag(
  p_uid text,
  p_destination jsonb default '{"type": "profile"}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid text := upper(trim(p_uid));
  v_user uuid := (select auth.uid());
  v_tag public.tags%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'profile required before claiming' using errcode = 'P0001';
  end if;

  update public.tags
     set claimed_by = v_user, destination = p_destination, status = 'claimed'
   where uid = v_uid
     and tenant_id = private.current_tenant_id()
     and status = 'unclaimed'
  returning * into v_tag;

  if not found then
    if exists (select 1 from public.tags where uid = v_uid) then
      raise exception 'tag is not claimable' using errcode = 'P0002';
    end if;
    raise exception 'tag not found' using errcode = 'P0003';
  end if;

  return jsonb_build_object(
    'uid', v_tag.uid,
    'status', v_tag.status,
    'destination', v_tag.destination
  );
end
$$;

-- Send a connect request. Returns void unconditionally: a request silently
-- dropped by a block is indistinguishable from a stored one. Every attempt
-- is rate-limit-accounted in a private ledger BEFORE the block check, so the
-- limiter cannot be used as a block oracle either.
create function public.send_connect_request(p_recipient uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_attempts bigint;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_recipient = v_user then
    raise exception 'cannot connect to yourself' using errcode = 'P0001';
  end if;

  -- self-cleaning rate-limit ledger: 10 attempts per rolling hour
  delete from private.connect_request_attempts
   where requester_id = v_user and attempted_at <= now() - interval '1 hour';
  select count(*) into v_attempts
    from private.connect_request_attempts
   where requester_id = v_user;
  if v_attempts >= 10 then
    raise exception 'rate limit exceeded' using errcode = 'P0004';
  end if;
  insert into private.connect_request_attempts (requester_id) values (v_user);

  -- unknown recipient: silent ack (no enumeration oracle)
  if not exists (select 1 from public.profiles where id = p_recipient) then
    return;
  end if;

  -- serialize against concurrent blocks/accepts for this pair
  perform private.lock_pair(v_user, p_recipient);

  -- lazily expire a stale pending request so re-sending works
  update public.connect_requests
     set status = 'expired'
   where requester_id = v_user and recipient_id = p_recipient
     and status = 'pending' and expires_at <= now();

  -- blocks are absolute and invisible: ack without storing
  if private.is_blocked(v_user, p_recipient) then
    return;
  end if;

  -- already connected: idempotent ack
  if exists (
    select 1 from public.connections
     where user_a = least(v_user, p_recipient)
       and user_b = greatest(v_user, p_recipient)
  ) then
    return;
  end if;

  -- duplicate pending (same direction): idempotent ack
  insert into public.connect_requests (requester_id, recipient_id)
  values (v_user, p_recipient)
  on conflict do nothing;
end
$$;

-- Accept a pending request addressed to you; creates the connection
-- atomically and returns it with the requester's card.
create function public.accept_connect_request(p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_requester uuid;
  v_req public.connect_requests%rowtype;
  v_conn public.connections%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Take the pair lock BEFORE the row lock (same order as send/block) so a
  -- block landing concurrently cannot interleave with this accept.
  select requester_id into v_requester
    from public.connect_requests
   where id = p_request_id and recipient_id = v_user and status = 'pending';
  if not found then
    raise exception 'request not found' using errcode = 'P0003';
  end if;
  perform private.lock_pair(v_user, v_requester);

  select * into v_req
    from public.connect_requests
   where id = p_request_id and recipient_id = v_user and status = 'pending'
   for update;
  if not found
     or private.is_blocked(v_user, v_req.requester_id)
     or private.is_blocked(v_req.requester_id, v_user) then
    -- deleted or blocked while we waited: identical to never-existed
    raise exception 'request not found' using errcode = 'P0003';
  end if;

  if v_req.expires_at <= now() then
    update public.connect_requests set status = 'expired' where id = p_request_id;
    raise exception 'request expired' using errcode = 'P0005';
  end if;

  update public.connect_requests set status = 'accepted' where id = p_request_id;

  insert into public.connections (tenant_id, user_a, user_b)
  values (
    v_req.tenant_id,
    least(v_user, v_req.requester_id),
    greatest(v_user, v_req.requester_id)
  )
  on conflict (user_a, user_b) do update set user_a = excluded.user_a
  returning * into v_conn;

  select * into v_profile from public.profiles where id = v_req.requester_id;

  return jsonb_build_object(
    'id', v_conn.id,
    'created_at', v_conn.created_at,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'bio', v_profile.bio
    )
  );
end
$$;

-- Decline a pending request addressed to you.
create function public.decline_connect_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.connect_requests
     set status = 'declined'
   where id = p_request_id and recipient_id = v_user and status = 'pending';
  if not found then
    raise exception 'request not found' using errcode = 'P0003';
  end if;
end
$$;

-- ================================================================== grants ==
-- Functions default to EXECUTE for PUBLIC in Postgres; tighten to exactly
-- the intended audiences.

revoke execute on function public.resolve_tag(text) from public;
revoke execute on function public.log_scan(text, text) from public;
revoke execute on function public.claim_tag(text, jsonb) from public;
revoke execute on function public.send_connect_request(uuid) from public;
revoke execute on function public.accept_connect_request(uuid) from public;
revoke execute on function public.decline_connect_request(uuid) from public;

grant execute on function public.resolve_tag(text) to anon, authenticated;
grant execute on function public.log_scan(text, text) to anon, authenticated;
grant execute on function public.claim_tag(text, jsonb) to authenticated;
grant execute on function public.send_connect_request(uuid) to authenticated;
grant execute on function public.accept_connect_request(uuid) to authenticated;
grant execute on function public.decline_connect_request(uuid) to authenticated;
