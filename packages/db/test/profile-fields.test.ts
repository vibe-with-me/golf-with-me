// extend-profile, card tier only: a handicap and a home course on the card.
// The card tier rides every card (the anonymous resolve, a pending request,
// accept's return), so everyone profiles_select admits reads it; that is its
// tier. Golf With Me's connections-only field (phone) is a Profile → Links
// platform, already connections-only in profile_links, so there is no
// profile_details table here.
import { beforeAll, describe, expect, it } from 'bun:test';
import {
  anonClient,
  assertStackRunning,
  createTestUser,
  pendingRequestId,
  provisionTag,
} from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

type CardFields = { handicap: number | null; home_course: string | null };

describe('card tier', () => {
  it('rides the anonymous resolve', async () => {
    const alice = await createTestUser('Alice');
    const uid = await provisionTag();
    const { error: claimError } = await alice.client.rpc('claim_tag', { p_uid: uid });
    expect(claimError).toBeNull();
    const { error } = await alice.client
      .from('profiles')
      .update({ handicap: -2.4, home_course: 'Riverside Muni' })
      .eq('id', alice.id);
    expect(error).toBeNull();

    const { data } = await anonClient().rpc('resolve_tag', { p_uid: uid });
    const resolved = data as { status: string; profile: CardFields };
    expect(resolved.status).toBe('claimed');
    expect(resolved.profile.handicap).toBe(-2.4);
    expect(resolved.profile.home_course).toBe('Riverside Muni');
  });

  it('the home course is length- and plain-text-checked at the database boundary', async () => {
    const alice = await createTestUser('Alice');
    for (const [home_course, constraint] of [
      ['', 'profiles_home_course_length'],
      ['x'.repeat(81), 'profiles_home_course_length'],
      ['River‮side', 'profiles_home_course_plain'],
    ] as const) {
      const { error } = await alice.client.from('profiles').update({ home_course }).eq('id', alice.id);
      expect(error?.message).toContain(constraint);
    }
    // Positive control: 80 plain characters is the limit, not past it.
    const { error } = await alice.client
      .from('profiles')
      .update({ home_course: 'x'.repeat(80) })
      .eq('id', alice.id);
    expect(error).toBeNull();
  });

  it('the handicap is range-checked: one past each end refused, both ends accepted', async () => {
    const alice = await createTestUser('Alice');
    for (const handicap of [-10.1, 54.1]) {
      const { error } = await alice.client.from('profiles').update({ handicap }).eq('id', alice.id);
      expect(error?.message).toContain('profiles_handicap_range');
    }
    for (const handicap of [-10, 54]) {
      const { error } = await alice.client.from('profiles').update({ handicap }).eq('id', alice.id);
      expect(error).toBeNull();
    }
  });

  it('rides the card accept returns', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const { error: updateError } = await alice.client
      .from('profiles')
      .update({ handicap: 14.2, home_course: 'Cedar Hills' })
      .eq('id', alice.id);
    expect(updateError).toBeNull();
    const { error: sendError } = await alice.client.rpc('send_connect_request', {
      p_recipient: bob.id,
    });
    expect(sendError).toBeNull();
    const { data, error } = await bob.client.rpc('accept_connect_request', {
      p_request_id: await pendingRequestId(alice, bob),
    });
    expect(error).toBeNull();
    const profile = (data as { profile: CardFields }).profile;
    expect(profile.handicap).toBe(14.2);
    expect(profile.home_course).toBe('Cedar Hills');
  });
});
