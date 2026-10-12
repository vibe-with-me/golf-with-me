-- Account deletion, by the account holder.
--
-- Deleting the auth.users row is the whole act. profiles cascades from it,
-- and from the profile everything else follows: connections, requests,
-- blocks, hosted gatherings and memberships by FK; claimed tags reset to
-- unclaimed and their scans erased by private.on_profile_deleted. The
-- rate-limit ledger has no FK, so its rows go here too.
-- No test pins that delete: test-utils has no SQL path into `private`.
--
-- Avatar files are NOT touched here: the API removes them through the
-- Storage API, with the caller's own JWT, before calling this (a SQL delete
-- on storage.objects would orphan the stored blobs).
-- Re-stated by packages/db/test/account.test.ts.
create function public.delete_my_account()
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

  delete from private.connect_request_attempts where requester_id = v_user;
  delete from auth.users where id = v_user;
end
$$;

-- Supabase's default privileges grant anon EXECUTE on new public functions,
-- so revoking from PUBLIC alone would leave anon able to call this.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
