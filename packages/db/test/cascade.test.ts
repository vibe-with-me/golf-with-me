// Account deletion cascades: profile gone, connections and requests deleted,
// blocks deleted, claimed tags reset to unclaimed, their scan history erased.
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

describe('account deletion', () => {
  it('cascades through every table and resets claimed tags', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const carol = await createTestUser('Carol');
    const dave = await createTestUser('Dave');

    // Alice: claims a tag with scans, connects with Bob, has a pending
    // request to Carol, and has blocked Dave.
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });
    await anonClient().rpc('log_scan', { p_uid: uid, p_user_agent: 'cascade-test' });
    await connectUsers(alice, bob);
    await alice.client.rpc('send_connect_request', { p_recipient: carol.id });
    await alice.client.from('blocks').insert({ blocker_id: alice.id, blocked_id: dave.id });

    // Delete the auth user — the way account deletion actually happens.
    const { error } = await admin.auth.admin.deleteUser(alice.id);
    expect(error).toBeNull();

    // Profile: gone.
    const { data: profile } = await admin.from('profiles').select('*').eq('id', alice.id);
    expect(profile ?? []).toEqual([]);

    // Connections: gone (Bob sees nothing).
    expect((await bob.client.from('connections').select('*')).data ?? []).toEqual([]);

    // Pending requests: gone (Carol's inbox empty).
    expect((await carol.client.from('connect_requests').select('*')).data ?? []).toEqual([]);

    // Blocks: gone.
    const { data: blocks } = await admin.from('blocks').select('*').eq('blocker_id', alice.id);
    expect(blocks ?? []).toEqual([]);

    // Tag: reset to unclaimed with destination nulled.
    const { data: tag } = await admin.from('tags').select('*').eq('uid', uid).single();
    expect(tag?.status).toBe('unclaimed');
    expect(tag?.claimed_by).toBeNull();
    expect(tag?.destination).toBeNull();

    // Scan history for her tags: erased.
    const { data: scans } = await admin.from('tag_scans').select('*').eq('tag_uid', uid);
    expect(scans ?? []).toEqual([]);

    // And the tag is immediately re-claimable.
    const { error: reclaim } = await bob.client.rpc('claim_tag', { p_uid: uid });
    expect(reclaim).toBeNull();
  });
});
