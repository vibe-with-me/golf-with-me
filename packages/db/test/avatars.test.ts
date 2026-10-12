// Avatars: a public bucket you can read by path but never list, writes only
// inside your own folder, objects immutable, and a profile column that holds
// a path — never a URL. Storage calls go through each user's own JWT client;
// nothing here uses the service role.
import { beforeAll, describe, expect, it } from 'bun:test';
import type { Db } from '../src/index.ts';
import {
  SUPABASE_URL,
  anonClient,
  assertStackRunning,
  createTestUser,
  pendingRequestId,
  provisionTag,
} from '../src/test-utils/index.ts';

beforeAll(assertStackRunning);

// Leading bytes only: Storage never decodes an image. These sniff as JPEG / WebP.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

const pathFor = (owner: string, ext: 'jpg' | 'webp' = 'jpg') =>
  `${owner}/${crypto.randomUUID()}.${ext}`;

const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;

// Postgres's wording for a policy refusal, which storage-api passes through.
const RLS = 'row-level security';

function upload(
  client: Db,
  path: string,
  body: Uint8Array = JPEG,
  contentType = 'image/jpeg',
  upsert = false,
) {
  return client.storage.from('avatars').upload(path, body, { contentType, upsert });
}

/** Invisible means an empty, error-free result: a policy error is not invisibility. */
function expectEmpty(result: { data: unknown[] | null; error: unknown }): void {
  expect(result.error).toBeNull();
  expect(result.data).toEqual([]);
}

describe('the avatars bucket', () => {
  it('the owner uploads into their own folder, and anyone reads it by path', async () => {
    const alice = await createTestUser('Alice');
    const path = pathFor(alice.id);
    const { error } = await upload(alice.client, path);
    expect(error).toBeNull();

    const res = await fetch(publicUrl(path)); // no credentials at all
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  it("a user cannot write into another user's folder", async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    expect((await upload(alice.client, pathFor(alice.id))).error).toBeNull();

    const { error } = await upload(bob.client, pathFor(alice.id));
    expect(error?.message).toContain(RLS);
  });

  it("a user cannot delete or replace another user's avatar, and nobody overwrites in place", async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const path = pathFor(alice.id);
    expect((await upload(alice.client, path)).error).toBeNull();

    expectEmpty(await bob.client.storage.from('avatars').remove([path])); // RLS matches nothing
    expect((await upload(bob.client, path, WEBP, 'image/webp', true)).error?.message).toContain(RLS);
    // not even the owner: replacing a photo is a new path (no update policy)
    expect((await upload(alice.client, path, WEBP, 'image/webp', true)).error?.message).toContain(
      RLS,
    );

    const res = await fetch(publicUrl(path));
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);

    // control: the owner's own delete goes through, and the file is no longer served
    const { data: removed, error } = await alice.client.storage.from('avatars').remove([path]);
    expect(error).toBeNull();
    expect(removed).toHaveLength(1);
    expect((await fetch(publicUrl(path))).status).not.toBe(200);
  });

  it('anon can neither upload nor list, and nobody lists a folder but its owner', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const path = pathFor(alice.id);
    expect((await upload(alice.client, path)).error).toBeNull();

    // the owner sees her own folder (account deletion empties it through this)
    const { data: own, error } = await alice.client.storage.from('avatars').list(alice.id);
    expect(error).toBeNull();
    expect(own?.map((entry) => `${alice.id}/${entry.name}`)).toEqual([path]);

    // a listable bucket would be a directory of everyone with a photo
    expectEmpty(await bob.client.storage.from('avatars').list(alice.id));
    expectEmpty(await bob.client.storage.from('avatars').list());
    const anon = anonClient();
    expectEmpty(await anon.storage.from('avatars').list(alice.id));
    expectEmpty(await anon.storage.from('avatars').list());
    expect((await upload(anon, pathFor(alice.id))).error?.message).toContain(RLS);
  });

  it('names must be <own-uid>/<uuid>.(webp|jpg)', async () => {
    const alice = await createTestUser('Alice');
    expect(
      (await upload(alice.client, pathFor(alice.id, 'webp'), WEBP, 'image/webp')).error,
    ).toBeNull();

    for (const path of [
      `${alice.id}/avatar.jpg`, // not a uuid name
      `${alice.id}/${crypto.randomUUID()}.png`, // off-extension
      `${alice.id}/nested/${crypto.randomUUID()}.jpg`, // off-folder depth
      `${alice.id.toUpperCase()}/${crypto.randomUUID()}.jpg`, // not the canonical id
    ]) {
      expect((await upload(alice.client, path)).error?.message).toContain(RLS);
    }
  });

  it('the bucket refuses anything but a JPEG or WebP up to 1 MiB', async () => {
    const alice = await createTestUser('Alice');
    expect((await upload(alice.client, pathFor(alice.id))).error).toBeNull();

    // never HTML or SVG on the project's origin
    expect((await upload(alice.client, pathFor(alice.id), JPEG, 'text/html')).error).not.toBeNull();
    expect(
      (await upload(alice.client, pathFor(alice.id), JPEG, 'image/svg+xml')).error,
    ).not.toBeNull();
    const oversized = new Uint8Array(1_048_577);
    oversized.set(JPEG);
    expect((await upload(alice.client, pathFor(alice.id), oversized)).error).not.toBeNull();
  });
});

describe('profiles.avatar_path', () => {
  it("holds a path in the profile's own folder, never a URL or another folder", async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const { error: ok } = await alice.client
      .from('profiles')
      .update({ avatar_path: pathFor(alice.id, 'webp') })
      .eq('id', alice.id);
    expect(ok).toBeNull();

    for (const avatar_path of [
      pathFor(bob.id),
      'https://evil.example/a.jpg',
      `${alice.id}/${crypto.randomUUID()}.png`,
      `${alice.id}/../${bob.id}/${crypto.randomUUID()}.jpg`,
    ]) {
      const { error } = await alice.client.from('profiles').update({ avatar_path }).eq('id', alice.id);
      expect(error?.message).toContain('profiles_avatar_path_shape');
    }
  });

  it('the card carries avatar_path, never a URL, wherever it crosses a boundary', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const path = pathFor(alice.id);
    const { error } = await alice.client
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', alice.id);
    expect(error).toBeNull();

    // the anonymous resolve
    const uid = await provisionTag();
    await alice.client.rpc('claim_tag', { p_uid: uid });
    const { data, error: resolveError } = await anonClient().rpc('resolve_tag', { p_uid: uid });
    expect(resolveError).toBeNull();
    const card = (data as { profile: Record<string, unknown> }).profile;
    expect(card.avatar_path).toBe(path);
    expect('avatar_url' in card).toBe(false);

    // the accepted connection's card
    await alice.client.rpc('send_connect_request', { p_recipient: bob.id });
    const requestId = await pendingRequestId(alice, bob);
    const { data: accepted, error: acceptError } = await bob.client.rpc(
      'accept_connect_request',
      { p_request_id: requestId },
    );
    expect(acceptError).toBeNull();
    expect((accepted as { profile: { avatar_path: string | null } }).profile.avatar_path).toBe(path);
  });
});
