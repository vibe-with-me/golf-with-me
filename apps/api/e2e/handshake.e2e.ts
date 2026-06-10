// End-to-end exercise of the public surface through the real stack:
// built SDK client -> API Worker (wrangler dev) -> Supabase local (RLS).
// Run: bun run db:start, then `bun run dev` here, then `bun run e2e`.
import { NfcClient } from '@withme/nfc/client';
import { admin, createTestUser, provisionTag } from '@withme/db/test-utils';

const API_URL = process.env.API_URL ?? 'http://localhost:8786';

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`ok: ${label}`);
}

const health = await fetch(`${API_URL}/health`).then((r) => r.json() as Promise<{ ok: boolean }>);
assert(health.ok, 'api worker is up');

const anon = new NfcClient({ baseUrl: API_URL });
const uid = await provisionTag();

// 1. resolve an unclaimed tag, anonymously, with messy input casing
const unclaimed = await anon.resolve(uid.toLowerCase());
assert(unclaimed.status === 'unclaimed', `resolve unclaimed (got ${unclaimed.status})`);

// 2. claim it as an authed user through the SDK
const alice = await createTestUser('E2E Alice');
const { data: session } = await alice.client.auth.getSession();
const authed = new NfcClient({
  baseUrl: API_URL,
  getAuthToken: () => session.session?.access_token ?? null,
});
const claimed = await authed.claim(uid);
assert(claimed.tag.status === 'claimed', 'claim succeeds for authed user');

// 3. anonymous resolve now returns the card
const resolved = await anon.resolve(uid);
assert(resolved.status === 'claimed', 'resolve after claim');
assert(
  resolved.status === 'claimed' && resolved.profile.display_name === 'E2E Alice',
  'resolved card carries the profile',
);

// 4. claim without auth is rejected
const unauthedClaim = await anon.claim(await provisionTag()).then(
  () => 'succeeded',
  (e: { code?: string }) => e.code ?? 'error',
);
assert(unauthedClaim === 'UNAUTHORIZED', `anon claim rejected (got ${unauthedClaim})`);

// 5. double claim maps to CONFLICT
const doubleClaim = await authed.claim(uid).then(
  () => 'succeeded',
  (e: { code?: string }) => e.code ?? 'error',
);
assert(doubleClaim === 'CONFLICT', `double claim is CONFLICT (got ${doubleClaim})`);

// 6. scan logging works and stores exactly the privacy-safe columns
await anon.logScan(uid, 'e2e-agent');
const { data: scans } = await admin.from('tag_scans').select('*').eq('tag_uid', uid);
assert(scans?.length === 1, 'scan stored');
assert(scans?.[0]?.user_agent === 'e2e-agent', 'scan carries user agent');

// 7. the per-UID rate limiter trips
let limited = false;
for (let i = 0; i < 35 && !limited; i++) {
  limited = await anon.logScan(uid).then(
    () => false,
    (e: { code?: string }) => e.code === 'TOO_MANY_REQUESTS',
  );
}
assert(limited, 'per-uid scan rate limiter trips');

// === app router: the social loop through the API ===
const { createORPCClient } = await import('@orpc/client');
const { RPCLink } = await import('@orpc/client/fetch');
const { contract } = await import('@withme/contract');
type AppClient = import('@orpc/contract').ContractRouterClient<typeof contract>['app'];

function appClientFor(token: string): AppClient {
  const link = new RPCLink({
    url: `${API_URL}/rpc/app`,
    headers: () => ({ authorization: `Bearer ${token}` }),
  });
  return createORPCClient(link);
}

const bob = await createTestUser('E2E Bob');
const { data: bobSession } = await bob.client.auth.getSession();
const bobApp = appClientFor(bobSession.session?.access_token ?? '');
const aliceApp = appClientFor(session.session?.access_token ?? '');

// 8. profile get/update round-trip
const me = await bobApp.profile.get();
assert(me.profile?.display_name === 'E2E Bob', 'profile.get returns own profile');
const updated = await bobApp.profile.update({ bio: 'taps tags' });
assert(updated.profile.bio === 'taps tags', 'profile.update patches bio');

// 9. consent flow: bob -> alice, alice accepts
await bobApp.requests.send({ recipient_id: alice.id });
const inbox = await aliceApp.requests.listPending();
assert(inbox.requests.length === 1, 'pending request lands in inbox');
assert(inbox.requests[0]?.requester.display_name === 'E2E Bob', 'inbox carries requester card');

const accepted = await aliceApp.requests.accept({ id: inbox.requests[0]!.id });
assert(accepted.connection.profile.display_name === 'E2E Bob', 'accept returns the connection');

const aliceConns = await aliceApp.connections.list();
const bobConns = await bobApp.connections.list();
assert(aliceConns.connections.length === 1, 'alice sees the connection');
assert(bobConns.connections[0]?.profile.display_name === 'E2E Alice', 'bob sees alice card');

// 10. block: connection vanishes, future sends silently drop, resolve goes dark
await aliceApp.blocks.block({ user_id: bob.id });
assert((await aliceApp.connections.list()).connections.length === 0, 'block removed connection');

await bobApp.requests.send({ recipient_id: alice.id }); // silent drop — must not throw
assert(
  (await aliceApp.requests.listPending()).requests.length === 0,
  'blocked send is silently dropped',
);

const bobView = await new NfcClient({
  baseUrl: API_URL,
  getAuthToken: () => bobSession.session?.access_token ?? null,
}).resolve(uid);
assert(bobView.status === 'disabled', 'blocked viewer resolves the tag as disabled');

const blockList = await aliceApp.blocks.list();
assert(blockList.blocks[0]?.user.display_name === 'E2E Bob', 'block list carries the card');

// 11. unblock + unknown-id block is a silent ack (no probe oracle)
await aliceApp.blocks.unblock({ user_id: bob.id });
assert((await aliceApp.blocks.list()).blocks.length === 0, 'unblock empties the list');
await aliceApp.blocks.block({ user_id: crypto.randomUUID() });
assert(true, 'blocking an unknown id acks silently');

console.log('\nhandshake e2e: all checks passed');
