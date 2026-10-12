// delete_my_account(): the account holder deletes their own account, and the
// cascade the initial schema promised runs from that one call. (cascade.test.ts
// keeps pinning the same cascade driven by the auth admin API.)
import { beforeAll, describe, expect, it } from 'bun:test';
import {
  admin,
  anonClient,
  assertStackRunning,
  connectUsers,
  createTestUser,
  provisionTag,
} from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

/** Gone means an empty, error-free select: a policy error is not absence. */
function expectEmpty(result: { data: unknown[] | null; error: unknown }): void {
  expect(result.error).toBeNull();
  expect(result.data).toEqual([]);
}

describe('delete_my_account', () => {
  it('removes the caller and cascades: connections, requests, blocks gone; tags reset; scans erased', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const carol = await createTestUser('Carol');
    const dave = await createTestUser('Dave');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });
    await anonClient().rpc('log_scan', { p_uid: uid, p_user_agent: 'delete-test' });
    await connectUsers(alice, bob);
    await alice.client.rpc('send_connect_request', { p_recipient: carol.id });
    await alice.client.from('blocks').insert({ blocker_id: alice.id, blocked_id: dave.id });

    const { error } = await alice.client.rpc('delete_my_account');
    expect(error).toBeNull();

    // Her JWT stays valid until it expires; Storage must still refuse it.
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const uploadAs = (user: typeof alice) =>
      user.client.storage
        .from('avatars')
        .upload(`${user.id}/${crypto.randomUUID()}.jpg`, photo, { contentType: 'image/jpeg' });
    expect((await uploadAs(bob)).error).toBeNull(); // control: a live account can
    expect((await uploadAs(alice)).error).not.toBeNull();

    const { data: auth } = await admin.auth.admin.getUserById(alice.id);
    expect(auth.user).toBeNull();
    expectEmpty(await admin.from('profiles').select('id').eq('id', alice.id));
    expectEmpty(await bob.client.from('connections').select('*'));
    expectEmpty(await carol.client.from('connect_requests').select('*'));
    expectEmpty(await admin.from('blocks').select('*').eq('blocker_id', alice.id));
    const { data: tag, error: tagError } = await admin
      .from('tags')
      .select('status, claimed_by, destination')
      .eq('uid', uid)
      .single();
    expect(tagError).toBeNull();
    expect(tag).toEqual({ status: 'unclaimed', claimed_by: null, destination: null });
    expectEmpty(await admin.from('tag_scans').select('*').eq('tag_uid', uid));
    expect((await bob.client.rpc('claim_tag', { p_uid: uid })).error).toBeNull();
  });

  it('the gatherings you host go with you, and you leave the ones you joined', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const carol = await createTestUser('Carol');
    const created = await alice.client.rpc('create_gathering', {
      p_title: 'Alice hosts',
      p_starts_at: tomorrow(),
    });
    expect(created.error).toBeNull();
    const hosted = created.data as { id: string };
    await bob.client.rpc('join_gathering', { p_gathering_id: hosted.id });
    const other = await carol.client.rpc('create_gathering', {
      p_title: 'Carol hosts',
      p_starts_at: tomorrow(),
    });
    expect(other.error).toBeNull();
    const joined = other.data as { id: string };
    await alice.client.rpc('join_gathering', { p_gathering_id: joined.id });

    expect((await alice.client.rpc('delete_my_account')).error).toBeNull();

    expectEmpty(await admin.from('gatherings').select('id').eq('id', hosted.id));
    expectEmpty(
      await admin.from('gathering_members').select('profile_id').eq('gathering_id', hosted.id),
    );
    const { data: left, error } = await admin
      .from('gathering_members')
      .select('profile_id')
      .eq('gathering_id', joined.id);
    expect(error).toBeNull();
    expect(left?.map((member) => member.profile_id)).toEqual([carol.id]);
  });

  it('deletes only the caller', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const carol = await createTestUser('Carol');
    await connectUsers(alice, bob);
    await connectUsers(bob, carol);

    expect((await alice.client.rpc('delete_my_account')).error).toBeNull();

    expect((await admin.auth.admin.getUserById(bob.id)).data.user?.id).toBe(bob.id);
    expect((await admin.from('profiles').select('id').in('id', [bob.id, carol.id])).data).toHaveLength(
      2,
    );
    const { data: remaining } = await bob.client.from('connections').select('user_a, user_b');
    expect(remaining).toHaveLength(1); // bob and carol, untouched
  });

  it('anon cannot call it', async () => {
    const alice = await createTestUser('Alice');
    const { error } = await anonClient().rpc('delete_my_account');
    expect(error?.code).toBe('42501');
    expect((await admin.auth.admin.getUserById(alice.id)).data.user?.id).toBe(alice.id);
  });
});
