// Gatherings: membership-scoped visibility, block-respecting joins, and the
// tap-to-join destination. The negative space is the spec: strangers and
// blocked users must see nothing — not even a different error message.
import { beforeAll, describe, expect, it } from 'bun:test';
import {
  admin,
  anonClient,
  assertStackRunning,
  createTestUser,
  provisionTag,
} from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

type Client = Awaited<ReturnType<typeof createTestUser>>['client'];

async function createGathering(
  client: Client,
  title = 'Rooftop listening session',
): Promise<string> {
  const { data, error } = await client.rpc('create_gathering', {
    p_title: title,
    p_starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    p_location: 'The roof',
  });
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

describe('gathering membership and visibility', () => {
  it('creating a gathering makes the host a member', async () => {
    const alice = await createTestUser('Alice');
    const id = await createGathering(alice.client);

    const { data: rows } = await alice.client.from('gatherings').select('*').eq('id', id);
    expect(rows).toHaveLength(1);
    const { data: members } = await alice.client
      .from('gathering_members')
      .select('profile_id')
      .eq('gathering_id', id);
    expect(members?.map((m) => m.profile_id)).toEqual([alice.id]);
  });

  it('a stranger sees neither the gathering nor its members', async () => {
    const alice = await createTestUser('Alice');
    const mallory = await createTestUser('Mallory');
    const id = await createGathering(alice.client);

    expect(
      (await mallory.client.from('gatherings').select('*').eq('id', id)).data ?? [],
    ).toEqual([]);
    expect(
      (await mallory.client.from('gathering_members').select('*').eq('gathering_id', id)).data ??
        [],
    ).toEqual([]);
  });

  it('joining admits the user, and co-members can now read each other cards', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);

    // before joining, alice is invisible to bob (no enumeration)
    expect((await bob.client.from('profiles').select('id').eq('id', alice.id)).data ?? []).toEqual(
      [],
    );

    const { error } = await bob.client.rpc('join_gathering', { p_gathering_id: id });
    expect(error).toBeNull();

    const { data: members } = await bob.client
      .from('gathering_members')
      .select('profile_id')
      .eq('gathering_id', id);
    expect(members).toHaveLength(2);

    // the gathering is the introduction context: the host's card is now visible
    const { data: hostCard } = await bob.client
      .from('profiles')
      .select('id, display_name')
      .eq('id', alice.id);
    expect(hostCard).toHaveLength(1);
  });

  it('leaving removes gathering visibility and the card bridge', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);
    await bob.client.rpc('join_gathering', { p_gathering_id: id });

    const { error } = await bob.client
      .from('gathering_members')
      .delete()
      .eq('gathering_id', id)
      .eq('profile_id', bob.id);
    expect(error).toBeNull();

    expect((await bob.client.from('gatherings').select('*').eq('id', id)).data ?? []).toEqual([]);
    expect((await bob.client.from('profiles').select('id').eq('id', alice.id)).data ?? []).toEqual(
      [],
    );
  });

  it('anon can neither create nor join', async () => {
    const alice = await createTestUser('Alice');
    const id = await createGathering(alice.client);
    const anon = anonClient();

    const { error: createError } = await anon.rpc('create_gathering', {
      p_title: 'X',
      p_starts_at: new Date().toISOString(),
    });
    expect(createError?.message).toContain('authentication required');
    const { error: joinError } = await anon.rpc('join_gathering', { p_gathering_id: id });
    expect(joinError?.message).toContain('authentication required');
  });

  it('only the host can edit or delete the gathering', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);
    await bob.client.rpc('join_gathering', { p_gathering_id: id });

    // a member's edit and delete match zero rows
    await bob.client.from('gatherings').update({ title: 'Hijacked' }).eq('id', id);
    await bob.client.from('gatherings').delete().eq('id', id);
    const { data: untouched } = await admin
      .from('gatherings')
      .select('title')
      .eq('id', id)
      .single();
    expect(untouched?.title).toBe('Rooftop listening session');

    // the host edits the granted columns only
    const { error: editError } = await alice.client
      .from('gatherings')
      .update({ title: 'Moved indoors' })
      .eq('id', id);
    expect(editError).toBeNull();
    const { error: hostIdError } = await alice.client
      .from('gatherings')
      .update({ host_id: bob.id })
      .eq('id', id);
    expect(hostIdError).not.toBeNull();

    const { error: deleteError } = await alice.client.from('gatherings').delete().eq('id', id);
    expect(deleteError).toBeNull();
    expect((await admin.from('gatherings').select('*').eq('id', id)).data ?? []).toEqual([]);
    expect((await bob.client.from('gatherings').select('*').eq('id', id)).data ?? []).toEqual([]);
  });
});

describe('gatherings respect blocks', () => {
  it('a blocked join is indistinguishable from a missing gathering', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);
    await admin.from('blocks').insert({ blocker_id: alice.id, blocked_id: bob.id });

    const { error: blocked } = await bob.client.rpc('join_gathering', { p_gathering_id: id });
    const { error: missing } = await bob.client.rpc('join_gathering', {
      p_gathering_id: crypto.randomUUID(),
    });
    expect(blocked?.message).toContain('gathering not found');
    expect(missing?.message).toContain('gathering not found');
    expect(blocked?.message).toBe(missing!.message);
  });

  it('blocking evicts the blocked member from the pair-hosted gathering', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);
    await bob.client.rpc('join_gathering', { p_gathering_id: id });

    const { error } = await alice.client
      .from('blocks')
      .insert({ blocker_id: alice.id, blocked_id: bob.id });
    expect(error).toBeNull();

    const { data: raw } = await admin
      .from('gathering_members')
      .select('profile_id')
      .eq('gathering_id', id);
    expect(raw?.map((m) => m.profile_id)).toEqual([alice.id]);
    expect((await bob.client.from('gatherings').select('*').eq('id', id)).data ?? []).toEqual([]);
  });
});

describe('gathering destinations', () => {
  type Resolved = {
    status: string;
    destination: { type: string; gathering_id?: string };
    gathering: { id: string; title: string; starts_at: string; location: string | null } | null;
  };

  it('a gathering tag resolves to the summary, anonymously', async () => {
    const alice = await createTestUser('Alice');
    const id = await createGathering(alice.client, 'Pinehurst at dawn');
    const uid = await provisionTag();
    const { error } = await alice.client.rpc('claim_tag', {
      p_uid: uid,
      p_destination: { type: 'gathering', gathering_id: id },
    });
    expect(error).toBeNull();

    const { data } = await anonClient().rpc('resolve_tag', { p_uid: uid });
    const resolved = data as Resolved;
    expect(resolved.status).toBe('claimed');
    expect(resolved.destination).toEqual({ type: 'gathering', gathering_id: id });
    expect(resolved.gathering?.title).toBe('Pinehurst at dawn');
    expect(resolved.gathering?.location).toBe('The roof');
  });

  it('a dangling gathering destination degrades to the profile card', async () => {
    const alice = await createTestUser('Alice');
    const id = await createGathering(alice.client);
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', {
      p_uid: uid,
      p_destination: { type: 'gathering', gathering_id: id },
    });
    await alice.client.from('gatherings').delete().eq('id', id);

    const resolved = (await anonClient().rpc('resolve_tag', { p_uid: uid })).data as Resolved;
    expect(resolved.status).toBe('claimed');
    expect(resolved.destination).toEqual({ type: 'profile' });
    expect(resolved.gathering).toBeNull();
  });

  it('a tag whose owner left the gathering degrades to the profile card', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);
    await bob.client.rpc('join_gathering', { p_gathering_id: id });
    const uid = await provisionTag();
    await bob.client.rpc('claim_tag', {
      p_uid: uid,
      p_destination: { type: 'gathering', gathering_id: id },
    });
    expect(
      ((await anonClient().rpc('resolve_tag', { p_uid: uid })).data as Resolved).gathering,
    ).not.toBeNull();

    await bob.client
      .from('gathering_members')
      .delete()
      .eq('gathering_id', id)
      .eq('profile_id', bob.id);

    const resolved = (await anonClient().rpc('resolve_tag', { p_uid: uid })).data as Resolved;
    expect(resolved.destination).toEqual({ type: 'profile' });
    expect(resolved.gathering).toBeNull();
  });

  it('malformed gathering destinations are rejected at the DB boundary', async () => {
    const alice = await createTestUser('Alice');
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });

    for (const destination of [
      { type: 'gathering' }, // missing gathering_id — the NULL-check trap
      { type: 'gathering', gathering_id: 'not-a-uuid' },
      { type: 'gathering', gathering_id: crypto.randomUUID(), extra: 'x' },
    ]) {
      const { error } = await alice.client.from('tags').update({ destination }).eq('uid', uid);
      expect(error?.message).toContain('tags_destination_shape');
    }
  });
});
