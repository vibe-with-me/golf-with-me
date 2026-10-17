// Demo seed: two users, three tags (unclaimed / claimed / disabled), one
// pending connect request, two gatherings — enough to walk the full handshake
// locally.
// Idempotent: re-running resets the demo users and tags. `bun run db:unseed`
// removes them.
import './local-env.ts';
import { TERMS_VERSION } from '@withme/contract';
import { admin, anonClient } from '@withme/db/test-utils';
import { DEMO_TAGS as TAGS, DEMO_USERS, findDemoUsers } from './demo.ts';

// This seed DELETES the demo users and tags it owns. Refuse anything that
// isn't the local stack unless explicitly overridden.
const seedTarget = new URL(process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321');
if (
  !['127.0.0.1', 'localhost'].includes(seedTarget.hostname) &&
  process.env.SEED_ALLOW_REMOTE !== '1'
) {
  console.error(
    `Refusing to seed non-local Supabase at ${seedTarget.origin}. Set SEED_ALLOW_REMOTE=1 to override.`,
  );
  process.exit(1);
}

// The local password is public (README, .env.example). A hosted project gets
// its own: anyone holding a demo login can accept requests sent to that
// account and read the senders' links, so a published password must never
// be one that every fork shares.
const LOCAL_DEMO_PASSWORD = 'golfwithme-demo-1';
const remote = !['127.0.0.1', 'localhost'].includes(seedTarget.hostname);
const DEMO_PASSWORD = remote ? (process.env.SEED_DEMO_PASSWORD ?? '') : LOCAL_DEMO_PASSWORD;
if (remote && (DEMO_PASSWORD === LOCAL_DEMO_PASSWORD || DEMO_PASSWORD.length < 16)) {
  console.error(
    'Refusing to seed a hosted project without SEED_DEMO_PASSWORD (16+ characters, not the ' +
      'local default). go-live writes one to the keys file.',
  );
  process.exit(1);
}

async function resetDemoUser(email: string): Promise<void> {
  const existing = (await findDemoUsers(admin)).find((user) => user.email === email);
  if (existing) await admin.auth.admin.deleteUser(existing.id);
}

async function createDemoUser(email: string, displayName: string, bio: string) {
  await resetDemoUser(email);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw signInError;
  const { error: profileError } = await client
    .from('profiles')
    .insert({ id: data.user.id, display_name: displayName, bio, terms_version: TERMS_VERSION });
  if (profileError) throw profileError;
  return { id: data.user.id, email, client };
}

console.log('Seeding demo data…');

const ada = await createDemoUser(DEMO_USERS.ada, 'Ada', 'Walks nine before work. Always has a spare ball.');
const lin = await createDemoUser(DEMO_USERS.lin, 'Lin', 'Twilight scrambles and a slow backswing.');

// extend-profile: the card tier. Each sees the other's handicap and home
// course on the card; Ada's phone (a Link, below) stays connections-only.
for (const [user, handicap, home_course] of [
  [ada, 14.2, 'Riverside Muni'],
  [lin, -1.4, 'Cedar Hills'],
] as const) {
  const { error: cardError } = await user.client
    .from('profiles')
    .update({ handicap, home_course })
    .eq('id', user.id);
  if (cardError) throw cardError;
}

// Ada's links: what Lin will see once Ada accepts (Profile → Links).
const { error: linksError } = await ada.client.rpc('set_my_links', {
  p_links: [
    { platform: 'phone', value: '+15555550142' },
    { platform: 'instagram', value: 'ada.plays' },
    { platform: 'website', value: 'https://ada.example' },
  ],
});
if (linksError) throw linksError;

// Tags: recreate from scratch (cascades clear old scans).
await admin.from('tags').delete().in('uid', Object.values(TAGS));
const { error: tagError } = await admin
  .from('tags')
  .insert(Object.values(TAGS).map((uid) => ({ uid })));
if (tagError) throw tagError;

// Ada claims two tags through the real RPC, then disables one herself.
for (const uid of [TAGS.claimed, TAGS.disabled]) {
  const { error } = await ada.client.rpc('claim_tag', { p_uid: uid });
  if (error) throw error;
}
const { error: disableError } = await ada.client
  .from('tags')
  .update({ status: 'disabled' })
  .eq('uid', TAGS.disabled);
if (disableError) throw disableError;

// A couple of scans on the live tag.
for (const ua of ['Seed/iPhone Mobile Safari', 'Seed/Android Chrome Mobile']) {
  const { error: scanError } = await anonClient().rpc('log_scan', {
    p_uid: TAGS.claimed,
    p_user_agent: ua,
  });
  if (scanError) throw scanError;
}

// Lin has tapped Ada's tag and asked to connect.
const { error: requestError } = await lin.client.rpc('send_connect_request', {
  p_recipient: ada.id,
});
if (requestError) throw requestError;

// Ada hosts a round, Lin has joined, and Ada's live tag points at it:
// a tap on 04BBBBBBBBBBBB shows her card as the invitation.
const startsAt = new Date();
startsAt.setDate(startsAt.getDate() + 2);
startsAt.setHours(6, 40, 0, 0);
const { data: gathering, error: gatheringError } = await ada.client.rpc('create_gathering', {
  p_title: 'Dawn nine',
  p_starts_at: startsAt.toISOString(),
  p_course_name: 'Riverside Muni',
  p_location: 'The first tee',
});
if (gatheringError) throw gatheringError;
const gatheringId = (gathering as { id: string }).id;
const { error: joinError } = await lin.client.rpc('join_gathering', {
  p_gathering_id: gatheringId,
});
if (joinError) throw joinError;
// The owner's column-granted update — the same path app.tags.update takes.
const { error: pointError } = await ada.client
  .from('tags')
  .update({ destination: { type: 'gathering', gathering_id: gatheringId } })
  .eq('uid', TAGS.claimed);
if (pointError) throw pointError;

// Lin hosts one too, which Ada has not joined: her Rounds tab shows the
// domain's feed working, not just her own calendar.
const linStartsAt = new Date();
linStartsAt.setDate(linStartsAt.getDate() + 5);
linStartsAt.setHours(17, 10, 0, 0);
const { error: linGatheringError } = await lin.client.rpc('create_gathering', {
  p_title: 'Twilight scramble',
  p_starts_at: linStartsAt.toISOString(),
  p_course_name: 'Cedar Hills',
  p_location: 'Back nine, the 10th tee',
});
if (linGatheringError) throw linGatheringError;

console.log(`
Seeded.
  Users     ${DEMO_USERS.ada} / ${DEMO_PASSWORD}   (has 1 pending request from Lin; hosts a round Lin joined; phone and two links, connections-only)
            ${DEMO_USERS.lin} / ${DEMO_PASSWORD}   (hosts a second round, listed to the domain)
  Tags      /t/${TAGS.claimed}  -> Ada's card, inviting you to her round
            /t/${TAGS.unclaimed}  -> claim flow
            /t/${TAGS.disabled}  -> inactive
`);
