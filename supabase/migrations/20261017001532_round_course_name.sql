-- Golf With Me: a round records the course it is played on.
--
-- customize-gathering §2. Additive: a required-on-create `course_name`
-- (plain text, one line, at most 80 characters) on public.gatherings, shown on
-- the round's row, its detail header, and the resolver summary, so a tapper
-- sees the course before joining. Rows that predate the column read ''.
--
-- create_gathering is rebuilt from its NEWEST body
-- (20261016120000_abuse_limits_and_erasure.sql: the per-host ledger and the
-- 20-upcoming cap), with p_course_name before the defaulted p_location.
-- resolve_tag is redefined from its newest body (20261011120000_avatars.sql)
-- with course_name in the gathering summary. No policy moves.

alter table public.gatherings
  add column course_name text not null default ''
    constraint gatherings_course_name_length check (char_length(course_name) <= 80)
    constraint gatherings_course_name_plain check (private.is_plain_text(course_name));

-- ======================================================= create_gathering ==
drop function public.create_gathering(text, timestamptz, text);

create function public.create_gathering(
  p_title text,
  p_starts_at timestamptz,
  p_course_name text,
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
  -- The contract requires a course on create; so does a direct RPC call.
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

  insert into public.gatherings (host_id, title, starts_at, location, course_name)
  values (
    v_user, trim(p_title), p_starts_at, nullif(trim(p_location), ''), trim(p_course_name)
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
    'host_id', v_gathering.host_id,
    'created_at', v_gathering.created_at
  );
end
$$;

revoke execute on function public.create_gathering(text, timestamptz, text, text) from public, anon;
grant execute on function public.create_gathering(text, timestamptz, text, text) to authenticated, service_role;

-- ============================================================ resolve_tag ==
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
      'bio', v_profile.bio
    )
  );
end
$$;

-- ============================================================ host edits ==
grant update (title, starts_at, location, course_name) on public.gatherings to authenticated;
