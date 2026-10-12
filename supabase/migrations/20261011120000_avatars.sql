-- Avatars: an uploaded photo replaces the free-form avatar URL.
--
-- Files live in the public `avatars` bucket, one folder per user:
-- `<user-uuid>/<uuid>.(webp|jpg)`. profiles.avatar_path stores that path,
-- never a URL, so an off-origin avatar is unrepresentable and every client
-- builds the URL from its own configured Supabase URL.
--
-- Safety semantics:
--   * Public read means a public bucket: a file is served to anyone holding
--     its path. It does NOT mean listing. There is no select policy for anon
--     or for other users, so the bucket cannot be walked to learn who has an
--     account (no enumeration).
--   * Writes are per-user: insert and delete only inside your own folder, and
--     only names of the exact shape. Inserting also needs a live profile. No
--     update policy: an object is immutable, and replacing a photo is a new
--     path (the API deletes the old).
--   * The bucket refuses anything but JPEG or WebP up to 1 MiB, so it can
--     never host HTML or SVG on the project's origin.
--   * storage.objects is Supabase's table and has no tenant_id. The tenant
--     seam stays on profiles; private.is_avatar_path is the one place a
--     tenant prefix would go.
-- Re-stated by packages/db/test/avatars.test.ts.

-- ================================================================== helper ==

-- The one definition of the shape, shared by the profiles CHECK and the
-- storage insert policy. Immutable, so the CHECK may call it.
create function private.is_avatar_path(p_path text, p_owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_path ~ (
      '^' || p_owner::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
    ),
    false
  )
$$;

revoke execute on function private.is_avatar_path(text, uuid) from public, anon;
grant execute on function private.is_avatar_path(text, uuid) to authenticated, service_role;

-- ================================================================ profiles ==

alter table public.profiles
  add column avatar_path text
  constraint profiles_avatar_path_shape
    check (avatar_path is null or private.is_avatar_path(avatar_path, id));

-- The free-form URL goes. Its values cannot become paths (they point
-- anywhere), so they are dropped with the column.
alter table public.profiles drop column avatar_url;

-- ================================================================== bucket ==

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/webp']);

-- ======================================================== storage policies ==

create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_avatar_path(name, (select auth.uid()))
    -- a deleted user's JWT stays valid until it expires: no profile, no upload
    and exists (select 1 from public.profiles where id = (select auth.uid()))
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================ card emitters ==

-- Both functions build the public card from the profile row; they are
-- replaced in place (every attribute restated) to emit avatar_path. Grants
-- survive create or replace.
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
      'avatar_path', v_profile.avatar_path,
      'bio', v_profile.bio
    )
  );
end
$$;

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
      'bio', v_profile.bio
    )
  );
end
$$;
