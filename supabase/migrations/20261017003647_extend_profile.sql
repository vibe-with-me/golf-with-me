-- extend-profile, card tier only: a handicap and a home course on the card.
--
--   Card tier: columns on public.profiles. They ride every card (the
--   anonymous resolve, a pending request, a gathering member list, a block
--   list, a connection), so everyone profiles_select admits reads them.
--
--   No connections tier here: Golf With Me's connections-only field is a
--   phone number, which is already a Profile → Links platform
--   (public.profile_links, connections-only).
--
-- profiles_select is not touched. The CHECKs mirror @withme/contract:
-- HandicapSchema (-10.0 to 54.0; numeric(3,1) rounds, so precision is zod's)
-- and CardLineSchema (1 to 80 characters of plain text).

-- =============================================================== card tier ==

alter table public.profiles
  add column handicap numeric(3,1)
    constraint profiles_handicap_range
    check (handicap is null or handicap between -10.0 and 54.0),
  add column home_course text
    constraint profiles_home_course_length
    check (home_course is null or char_length(home_course) between 1 and 80)
    constraint profiles_home_course_plain
    check (home_course is null or private.is_plain_text(home_course));

-- ============================================================ resolve_tag ==
-- Newest: 20261017001532_round_course_name.sql.
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
    )
  );
end
$$;

-- ================================================= accept_connect_request ==
-- Newest: 20261014190000_profile_links.sql.
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
    )
  );
end
$$;
