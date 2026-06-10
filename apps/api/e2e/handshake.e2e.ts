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

console.log('\nhandshake e2e: all checks passed');
