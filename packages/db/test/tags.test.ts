// Tag lifecycle: atomic claiming, owner-only management, scan privacy.
import { beforeAll, describe, expect, it } from 'bun:test';
import { DEFAULT_TENANT_ID } from '../src/index.ts';
import {
  admin,
  anonClient,
  assertStackRunning,
  createTestUser,
  provisionTag,
} from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

describe('claiming', () => {
  it('claim is atomic: the second claimant loses', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const uid = await provisionTag();

    const { error: first } = await alice.client.rpc('claim_tag', { p_uid: uid });
    expect(first).toBeNull();
    const { error: second } = await bob.client.rpc('claim_tag', { p_uid: uid });
    expect(second?.message).toContain('not claimable');
  });

  it('claiming an unknown uid fails gracefully with a distinct error', async () => {
    const alice = await createTestUser('Alice');
    const { error } = await alice.client.rpc('claim_tag', { p_uid: '04FFFFFFFFFF98' });
    expect(error?.message).toContain('tag not found');
  });

  it('anon cannot claim', async () => {
    const uid = await provisionTag();
    const { error } = await anonClient().rpc('claim_tag', { p_uid: uid });
    expect(error?.message).toContain('authentication required');
  });

  it('rows carry the default tenant seam', async () => {
    const alice = await createTestUser('Alice');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });

    const { data: tag } = await admin.from('tags').select('tenant_id').eq('uid', uid).single();
    expect(tag?.tenant_id).toBe(DEFAULT_TENANT_ID);
    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id')
      .eq('id', alice.id)
      .single();
    expect(profile?.tenant_id).toBe(DEFAULT_TENANT_ID);
  });
});

describe('owner management', () => {
  it('the owner can disable and re-enable their tag', async () => {
    const alice = await createTestUser('Alice');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });

    const { error } = await alice.client.from('tags').update({ status: 'disabled' }).eq('uid', uid);
    expect(error).toBeNull();
    const { data } = await anonClient().rpc('resolve_tag', { p_uid: uid });
    expect((data as { status: string }).status).toBe('disabled');

    await alice.client.from('tags').update({ status: 'claimed' }).eq('uid', uid);
    const { data: back } = await anonClient().rpc('resolve_tag', { p_uid: uid });
    expect((back as { status: string }).status).toBe('claimed');
  });

  it('a non-owner cannot touch the tag', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });

    await bob.client.from('tags').update({ status: 'disabled' }).eq('uid', uid);
    const { data } = await admin.from('tags').select('status').eq('uid', uid).single();
    expect(data?.status).toBe('claimed'); // unchanged — RLS matched zero rows
  });

  it('destination must match the typed union (DB-level validation)', async () => {
    const alice = await createTestUser('Alice');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });

    const { error } = await alice.client
      .from('tags')
      .update({ destination: { type: 'teleport' } })
      .eq('uid', uid);
    expect(error?.message).toContain('tags_destination_shape');
  });
});

describe('scan privacy', () => {
  it('anon can log a scan; nobody can read scans through the API', async () => {
    const alice = await createTestUser('Alice');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });

    const { error } = await anonClient().rpc('log_scan', {
      p_uid: uid,
      p_user_agent: 'test-agent',
    });
    expect(error).toBeNull();

    // Stored (service-role check)...
    const { data: raw } = await admin.from('tag_scans').select('*').eq('tag_uid', uid);
    expect(raw).toHaveLength(1);
    // ...but invisible to everyone via client roles, including the tag owner.
    expect((await alice.client.from('tag_scans').select('*')).data ?? []).toEqual([]);
    expect((await anonClient().from('tag_scans').select('*')).data ?? []).toEqual([]);
  });

  it('logging a scan for an unknown uid is a silent no-op', async () => {
    const { error } = await anonClient().rpc('log_scan', { p_uid: '04FFFFFFFFFF97' });
    expect(error).toBeNull();
  });

  it('scan rows contain no location or network identity columns', async () => {
    const { data } = await admin.from('tag_scans').select('*').limit(1);
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]!);
      expect(columns.toSorted()).toEqual([
        'id',
        'scanned_at',
        'tag_uid',
        'tenant_id',
        'user_agent',
      ]);
    }
  });
});
