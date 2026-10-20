-- Golf With Me after the starter's card link platforms
-- (20261018120000_card_link_platforms.sql) and connection met-at
-- (20261019120000_connection_met_at.sql).
--
-- Both restate a function golf changed, from the starter's own previous
-- body, so on this fork they would undo golf's lines
-- (docs/staying-current.md, "Objects you both changed"):
--   * resolve_tag: course_name in the gathering summary (20261017001532)
--     and handicap / home_course on the card (20261017003647_extend_profile);
--   * accept_connect_request: handicap / home_course on the new connection's
--     card (20261017003647_extend_profile).
-- This reapplies them on top of the newest bodies (copied from those two
-- migrations; the only changes are golf's lines). Grants survive the replace.

-- ============================================================ resolve_tag ==
-- Newest: 20261018120000_card_link_platforms.sql.
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
       and private.sees_gathering(v_gathering.id) then
      v_gathering_json := jsonb_build_object(
        'id', v_gathering.id,
        'title', v_gathering.title,
        'starts_at', v_gathering.starts_at,
        'location', v_gathering.location,
        'course_name', v_gathering.course_name
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
      'avatar_path', v_profile.avatar_path,
      'bio', v_profile.bio,
      'handicap', v_profile.handicap,
      'home_course', v_profile.home_course
    ),
    -- Platform names only, never a value: the card tier.
    'link_platforms', coalesce(
      (select jsonb_agg(l.platform order by l.sort_order, l.platform)
         from public.profile_links l
        where l.profile_id = v_profile.id
          and l.tenant_id = private.current_tenant_id()),
      '[]'::jsonb
    )
  );
end
$$;

-- ================================================= accept_connect_request ==
-- Newest: 20261019120000_connection_met_at.sql.
create or replace function public.accept_connect_request(p_request_id uuid)
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
  v_gathering_id uuid;
  v_gathering public.gatherings%rowtype;
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

  -- (a)(b) The gathering they were both at when the request was sent.
  select g.id into v_gathering_id
    from public.gatherings g
    join public.gathering_members ma
      on ma.gathering_id = g.id and ma.profile_id = v_user
    join public.gathering_members mb
      on mb.gathering_id = g.id and mb.profile_id = v_req.requester_id
   where g.tenant_id = v_req.tenant_id
     and g.starts_at between v_req.created_at - interval '12 hours'
                         and v_req.created_at + interval '2 hours'
   order by abs(extract(epoch from g.starts_at - v_req.created_at)), g.id
   limit 1;

  insert into public.connections (tenant_id, user_a, user_b, gathering_id)
  values (
    v_req.tenant_id,
    least(v_user, v_req.requester_id),
    greatest(v_user, v_req.requester_id),
    v_gathering_id
  )
  on conflict (user_a, user_b) do update
    set gathering_id = coalesce(public.connections.gathering_id, excluded.gathering_id)
  returning * into v_conn;

  select * into v_profile from public.profiles where id = v_req.requester_id;

  -- (c) The accepter's own view of it, the same rule the list reads.
  if v_conn.gathering_id is not null and private.sees_gathering(v_conn.gathering_id) then
    select * into v_gathering from public.gatherings where id = v_conn.gathering_id;
  end if;

  return jsonb_build_object(
    'id', v_conn.id,
    'created_at', v_conn.created_at,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_path', v_profile.avatar_path,
      'bio', v_profile.bio,
      'handicap', v_profile.handicap,
      'home_course', v_profile.home_course
    ),
    'links', (
      select coalesce(
        jsonb_agg(jsonb_build_object('platform', l.platform, 'value', l.value) order by l.sort_order),
        '[]'::jsonb
      )
      from public.profile_links l
      where l.profile_id = v_req.requester_id
    ),
    'gathering', case when v_gathering.id is null then null else jsonb_build_object(
      'id', v_gathering.id,
      'title', v_gathering.title,
      'starts_at', v_gathering.starts_at
    ) end
  );
end
$$;
