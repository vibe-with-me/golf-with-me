-- Golf With Me after the starter's gathering visibility and capacity
-- (20261017203000_gathering_visibility_and_capacity.sql).
--
-- That migration redefines create_gathering and resolve_tag from the
-- starter's own newest bodies and re-issues the host's column grant, so on
-- this fork it would undo three things golf added (docs/staying-current.md,
-- "Objects you both changed"):
--   * create_gathering's required p_course_name (20261017001532): the
--     starter's drop names the starter's old signature, so golf's four-argument
--     version survived beside the new five-argument one, without visibility or
--     capacity;
--   * resolve_tag's course_name in the gathering summary (20261017001532) and
--     handicap / home_course on the card (20261017003647_extend_profile);
--   * course_name in the host's column grant.
-- This reapplies them on top of the newest bodies (copied from
-- 20261017203000; the only changes are golf's lines), and leaves exactly one
-- create_gathering.

-- ======================================================= create_gathering ==
drop function public.create_gathering(text, timestamptz, text, text);
drop function public.create_gathering(text, timestamptz, text, text, integer);

create function public.create_gathering(
  p_title text,
  p_starts_at timestamptz,
  p_course_name text,
  p_location text default null,
  p_visibility text default 'everyone',
  p_capacity integer default null
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
  -- Golf With Me: the contract requires a course on create; so does a direct RPC call.
  if coalesce(trim(p_course_name), '') = '' then
    raise exception 'course name required' using errcode = '22023';
  end if;

  -- 5 creations per rolling hour, and at most 20 upcoming at once.
  perform pg_advisory_xact_lock(hashtextextended('create_gathering:' || v_user::text, 0));
  delete from private.gathering_create_attempts
   where host_id = v_user and attempted_at <= now() - interval '1 hour';
  if (select count(*) from private.gathering_create_attempts where host_id = v_user) >= 5 then
    raise exception 'rate limit exceeded' using errcode = 'P0004';
  end if;
  if (
    select count(*) from public.gatherings where host_id = v_user and starts_at > now()
  ) >= 20 then
    raise exception 'too many upcoming gatherings' using errcode = 'P0004';
  end if;
  insert into private.gathering_create_attempts (host_id) values (v_user);

  -- The CHECKs refuse an unknown visibility or an out-of-range capacity (23514).
  insert into public.gatherings (host_id, title, starts_at, location, course_name, visibility, capacity)
  values (
    v_user,
    trim(p_title),
    p_starts_at,
    nullif(trim(p_location), ''),
    trim(p_course_name),
    coalesce(p_visibility, 'everyone'),
    p_capacity
  )
  returning * into v_gathering;

  insert into public.gathering_members (gathering_id, profile_id, tenant_id)
  values (v_gathering.id, v_user, v_gathering.tenant_id);

  return jsonb_build_object(
    'id', v_gathering.id,
    'title', v_gathering.title,
    'starts_at', v_gathering.starts_at,
    'location', v_gathering.location,
    'course_name', v_gathering.course_name,
    'visibility', v_gathering.visibility,
    'capacity', v_gathering.capacity,
    'host_id', v_gathering.host_id,
    'created_at', v_gathering.created_at
  );
end
$$;

revoke execute on function public.create_gathering(text, timestamptz, text, text, text, integer) from public, anon;
grant execute on function public.create_gathering(text, timestamptz, text, text, text, integer) to authenticated;

-- ============================================================ resolve_tag ==
-- Newest: 20261017203000_gathering_visibility_and_capacity.sql.
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
    )
  );
end
$$;

-- ============================================================ host edits ==
grant update (title, starts_at, location, course_name, visibility, capacity) on public.gatherings to authenticated;
