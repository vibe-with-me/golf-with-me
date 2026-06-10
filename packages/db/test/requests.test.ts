// Connect requests: mutual consent, expiry, rate limiting, unilateral remove.
import { beforeAll, describe, expect, it } from 'bun:test';
import {
  admin,
  assertStackRunning,
  connectUsers,
  createTestUser,
  pendingRequestId,
} from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

describe('consent flow', () => {
  it('accept creates a canonical connection visible to both parties', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    await connectUsers(alice, bob);

    const { data: aliceView } = await alice.client.from('connections').select('*');
    const { data: bobView } = await bob.client.from('connections').select('*');
    expect(aliceView).toHaveLength(1);
    expect(bobView).toHaveLength(1);
    const conn = aliceView?.[0];
    expect(conn && conn.user_a < conn.user_b).toBe(true);
  });

  it('decline resolves the request without creating a connection', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    const requestId = await pendingRequestId(alice, bob);

    const { error } = await bob.client.rpc('decline_connect_request', {
      p_request_id: requestId,
    });
    expect(error).toBeNull();
    expect((await alice.client.from('connections').select('*')).data ?? []).toEqual([]);
  });

  it('only the recipient can accept', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const mallory = await createTestUser('Mallory');
    await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    const requestId = await pendingRequestId(alice, bob);

    const { error } = await mallory.client.rpc('accept_connect_request', {
      p_request_id: requestId,
    });
    expect(error?.message).toContain('request not found');
  });

  it('duplicate sends are idempotent: one pending row, same ack', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    const { error } = await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    expect(error).toBeNull();

    const { data } = await bob.client.from('connect_requests').select('*');
    expect(data).toHaveLength(1);
  });

  it('sending to an unknown recipient acks silently (no enumeration oracle)', async () => {
    const alice = await createTestUser('Alice');
    const { error } = await alice.client.rpc('send_connect_request', {
      p_recipient: crypto.randomUUID(),
    });
    expect(error).toBeNull();
  });
});

describe('expiry', () => {
  it('an expired request cannot be accepted', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    const requestId = await pendingRequestId(alice, bob);

    await admin
      .from('connect_requests')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', requestId);

    const { error } = await bob.client.rpc('accept_connect_request', {
      p_request_id: requestId,
    });
    expect(error?.message).toContain('request expired');
  });

  it('an expired request can be re-sent (lazy sweep)', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    const requestId = await pendingRequestId(alice, bob);
    await admin
      .from('connect_requests')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', requestId);

    const { error } = await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    expect(error).toBeNull();

    const fresh = await pendingRequestId(alice, bob);
    expect(fresh).not.toBe(requestId);
  });
});

describe('rate limiting', () => {
  it('the 11th send attempt within an hour is rejected', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');

    // 10 attempts pass (duplicates still count as attempts)...
    for (let i = 0; i < 10; i++) {
      const { error } = await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
      expect(error).toBeNull();
    }
    // ...the 11th is refused.
    const { error } = await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    expect(error?.message).toContain('rate limit exceeded');
  });
});

describe('unilateral remove', () => {
  it('either party can remove a connection; the other simply no longer sees it', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    await connectUsers(alice, bob);

    const { data } = await alice.client.from('connections').select('id');
    await alice.client.from('connections').delete().eq('id', data![0]!.id);

    expect((await alice.client.from('connections').select('*')).data ?? []).toEqual([]);
    expect((await bob.client.from('connections').select('*')).data ?? []).toEqual([]);
  });

  it('a stranger cannot remove someone else’s connection', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const mallory = await createTestUser('Mallory');
    await connectUsers(alice, bob);

    await mallory.client.from('connections').delete().neq('id', crypto.randomUUID());

    expect((await alice.client.from('connections').select('*')).data).toHaveLength(1);
  });
});
