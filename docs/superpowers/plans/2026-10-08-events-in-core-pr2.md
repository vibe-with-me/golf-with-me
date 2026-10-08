# Events in core (PR 2 of the tabs buildout) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the gathering from the `build-gathering` skill into the starter: `gatherings` + `gathering_members` behind the four safety mechanisms, the `{ type: 'gathering', gathering_id }` destination with a summary on resolve, `app.gatherings.*`, an Events tab (first in the bar) with list + create, a detail with members / leave / host edit + delete / "point my tags here", the resolver invitation branch on both platforms, the ten RLS tests, e2e on both harnesses, the docs, and `customize-gathering` replacing `build-gathering`.

**Architecture:** Spec: `docs/superpowers/specs/2026-09-22-app-shell-and-tabs-design.md` (Decisions binding). Executable spec: `.agents/skills/build-gathering/SKILL.md` §1–5. Reference: golf-with-me `17b0425` ("Add Rounds"), ported generically (`round` → `gathering`, `course_name`/`tee_time` → `title`/`starts_at`/`location`) and re-expressed inside the PR 1 shell: web routes live under `_app` and spread `shellStates`; mobile list is a `(tabs)` screen and the detail a stack screen gated by `Stack.Protected`, returning to the tabs with `router.dismissTo`. The web app owns no data access: every read and write goes through `@withme/contract`.

**Tech Stack:** Postgres/Supabase RLS + security-definer RPCs, zod 4 + oRPC contract, Hono API Worker, TanStack Start 1.168 / Router 1.170, Expo Router 56 (`Tabs`, `Stack.Protected`, `useFocusEffect`), lucide-react `Calendar` / Feather `calendar`, bun test, Playwright.

**Scope guard:** No browse surface, ever. Internal identifiers stay `gathering` (tables, contract keys, types, route files, policy names); only the tab label says "Events". No avatars, no account deletion, no My tags section (M3). Every new shell-child loader wraps its API calls in `asSignedInAccount` from `apps/web/src/lib/account-scope.ts`, like the existing `_app.tsx` and `_app.connections.tsx` loaders do.

---

## Decisions made in this plan

1. **Field set.** `title text (1–120)`, `starts_at timestamptz`, `location text (1–160, nullable)`, plus `host_id`, `created_at`, `tenant_id`. The anonymous summary is `{ id, title, starts_at, location }`: holding the tag is the invitation, and an invitee needs the where as much as the when. Nothing else; customize-gathering adds fields.
2. **Host edit and delete.** The spec's Tab contents require them; its contract list omits them. Added `app.gatherings.update` (`PATCH`, host-only patch of title/starts_at/location) and `app.gatherings.remove` (`DELETE`, named like `connections.remove`). Both lean on the `gatherings_update_host` / `gatherings_delete_host` policies plus a column grant `(title, starts_at, location)` (the tags idiom: host_id/tenant_id immutable). An 11th RLS test pins the boundary.
3. **M2-minimal tags endpoints.** The toggle "Point my tags at this gathering" / "Point my tags back to my profile" needs the caller's current tags, so M2 ships BOTH `app.tags.listMine` (`GET /me/tags` → `{ tags: Tag[] }`, RLS `tags_select_own`) and `app.tags.update` (`PATCH /me/tags/{uid}`, input `{ uid, destination }` → `{ tag }`). M3 extends `update` with `status` and builds the Profile → My tags section on these. A bulk "re-point all my tags" update-only design was rejected: M3 would have to redefine it instead of extending it. Neither platform touches Supabase for data.
4. **`resolve_tag` guard.** Beyond golf: the summary is included only if the tag's owner is currently a member (`private.is_gathering_member(gathering.id, tag.claimed_by)`); otherwise the destination degrades to `{"type":"profile"}` exactly like a dangling id. Closes the hole where an evicted ex-member points their own tag at the id and keeps reading title/time/location changes. Test 11.
5. **Seed.** Ada hosts "Rooftop listening session" (two days out, 19:00 local, "The roof, 14 Loom St"); Lin joins through `join_gathering`; Ada's live demo tag `04BBBBBBBBBBBB` is re-pointed at it, so the README demo tap shows the invitation card. The Playwright smoke uses fresh UIDs and is unaffected.
6. **Resolver card.** The host's `ProfileCard` (avatar, name, bio) + one muted line `Title · Thu, Oct 9 · 7:00 PM · Location` + the accent "Join this gathering" (the consent moment). The host sees a quiet "Open gathering". Web: a `Link` to `/gatherings/$id?title=…&starts_at=…`; signed-out tappers are bounced through login by the `_app` guard with the hints preserved in `returnTo`. Mobile: explicit `/login?redirect=/gathering/<id>?title=…&starts_at=…` because `gathering/[id]` sits behind `Stack.Protected`.
7. **Nouns.** Copy says "gathering" everywhere (the spec's literal strings "Join this gathering?" and "Tap a host's tag to join one, or create your own." bind); the tab label alone says "Events". customize-gathering §1 is the rename sweep.
8. **Time entry.** Pre-fill tomorrow 18:00 local on both platforms. Web: `<input type="datetime-local">`. Mobile: two plain `Field`s (`Date` YYYY-MM-DD, `Time` HH:MM) parsed locally — no picker dependency (the spec's new-deps list has none).
9. **Ordering.** `listMine` returns `starts_at` ascending; the UI splits Upcoming (ascending) and Past (most recent first).
10. **Mobile list freshness.** `useFocusEffect` reloads the Events list when the tab regains focus (a detail may have left/edited/deleted underneath it). Detail → list navigations use `router.dismissTo('/gatherings')`, never `replace` (no second tab shell; PR 1 idiom).

---

## Ground rules for every task

- Work on the M2 branch created from `main` after PR 7 (the account-switch follow-up) has merged. `main` then contains PR 1 and PR 7; do not touch what PR 7 added except where a task says so.
- Gate: `bun run lint`, `bun run typecheck`, `bun run test` — lint and the test suites stay green at every commit. Typecheck has two expected red windows, stated in the tasks: `packages/nfc-sdk` from Task 1 until Task 6 (the parity test), `packages/db` from Task 2 until Task 3 (tests call `rpc('create_gathering')` before the types exist).
- `apps/web/src/routeTree.gen.ts` is generated: after adding route files run `cd apps/web && bunx vite build` and commit it. The plugin may rewrite a `createFileRoute('…')` id string — accept that.
- Styling: only `var(--*)` tokens on web, only `useTokens()` / `lib/tokens.ts` on mobile. The accent appears on Connect, Accept, and Join. No new CSS is needed in this PR.
- Shell-quote file names containing `$` and `[`.
- Commit messages: imperative subject, why in the body, end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 0: Baseline

**Files:** none.

```bash
bun install
bun run db:start
bun run db:reset && bun run db:seed
cp -n apps/api/.dev.vars.example apps/api/.dev.vars; cp -n apps/web/.env.example apps/web/.env; cp -n apps/mobile/.env.example apps/mobile/.env
bun run lint && bun run typecheck && bun run test
git log --oneline -3 origin/main   # expect the merge of PR #7 (account-switch follow-up) on top of PR #6
```

Expected: seed prints the demo users; gate green. Note the db suite's test count from the output: it is the baseline, and Task 3 expects it +12. No commit.

---

### Task 1: Contract

**Files:**
- Create: `packages/contract/src/schemas/gathering.ts`
- Modify: `packages/contract/src/schemas/destination.ts`, `src/contract/public.ts`, `src/contract/app.ts`, `src/index.ts`, `test/schemas.test.ts`

**Step 1:** Create `packages/contract/src/schemas/gathering.ts`:

```ts
import { z } from 'zod';
import { PublicProfileSchema } from './profile.ts';

/** An emptied location means "no location": the entity never carries ''. */
const LocationInputSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** A gathering as its members see it. host_id tells the UI who runs it. */
export const GatheringSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(120),
  starts_at: z.iso.datetime({ offset: true }),
  location: z.string().min(1).max(160).nullable(),
  host_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
});

/**
 * What an anonymous tap on a gathering tag may learn — capability-based:
 * holding the tag is the invitation. Crosses the anonymous resolve boundary,
 * so nothing private ever joins this pick.
 */
export const GatheringSummarySchema = GatheringSchema.pick({
  id: true,
  title: true,
  starts_at: true,
  location: true,
});

export const GatheringMemberSchema = z.object({
  joined_at: z.iso.datetime({ offset: true }),
  profile: PublicProfileSchema,
});

export const CreateGatheringInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  starts_at: z.iso.datetime({ offset: true }),
  location: LocationInputSchema,
});

/** Host-only patch; the id travels in the path. At least one field. */
export const UpdateGatheringInputSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120).optional(),
    starts_at: z.iso.datetime({ offset: true }).optional(),
    location: LocationInputSchema,
  })
  .refine(
    (patch) =>
      patch.title !== undefined || patch.starts_at !== undefined || patch.location !== undefined,
    { message: 'Nothing to update' },
  );

export type Gathering = z.infer<typeof GatheringSchema>;
export type GatheringSummary = z.infer<typeof GatheringSummarySchema>;
export type GatheringMember = z.infer<typeof GatheringMemberSchema>;
export type CreateGatheringInput = z.infer<typeof CreateGatheringInputSchema>;
export type UpdateGatheringInput = z.infer<typeof UpdateGatheringInputSchema>;
```

**Step 2:** `destination.ts` — replace the doc comment's "V1 ships only 'profile'" with "The starter ships `profile` and `gathering`; future types (link, menu, vcard, …) join this union without schema change." and add the member:

```ts
/** Tag -> a gathering: tap the host's tag to join. resolve carries a summary alongside. */
export const GatheringDestinationSchema = z.object({
  type: z.literal('gathering'),
  gathering_id: z.uuid(),
});

export const DestinationSchema = z.discriminatedUnion('type', [
  ProfileDestinationSchema,
  GatheringDestinationSchema,
]);
```

**Step 3:** `public.ts` — import `GatheringSummarySchema` from `'../schemas/gathering.ts'`; in the claimed branch add, after `destination`, `gathering: GatheringSummarySchema.nullable(),` (non-optional nullable: the key is always present, which keeps the SDK mirror exactly equal). Extend the doc comment: "`gathering` is a summary for gathering-destination tags (capability-based: holding the tag is the invitation) and null for every other type."

**Step 4:** `app.ts` — add imports:

```ts
import { DestinationSchema } from '../schemas/destination.ts';
import {
  CreateGatheringInputSchema,
  GatheringMemberSchema,
  GatheringSchema,
  UpdateGatheringInputSchema,
} from '../schemas/gathering.ts';
import { TagSchema, TagUidSchema } from '../schemas/tag.ts';
```

and before `appContract`:

```ts
const createGathering = oc
  .route({ method: 'POST', path: '/gatherings', tags: ['Gatherings'] })
  .input(CreateGatheringInputSchema)
  .output(z.object({ gathering: GatheringSchema }));

const getGathering = oc
  .route({ method: 'GET', path: '/gatherings/{id}', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  // Not-found and blocked-by-host are the same NOT_FOUND error — a gathering
  // you may not see is a gathering that does not exist.
  .output(z.object({ gathering: GatheringSchema, members: z.array(GatheringMemberSchema) }));

const joinGathering = oc
  .route({ method: 'POST', path: '/gatherings/{id}/join', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const leaveGathering = oc
  .route({ method: 'POST', path: '/gatherings/{id}/leave', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

const listMyGatherings = oc
  .route({ method: 'GET', path: '/gatherings', tags: ['Gatherings'] })
  // Bare RLS-scoped list of the caller's own gatherings. This is NOT a browse
  // surface and must never grow into one.
  .output(z.object({ gatherings: z.array(GatheringSchema) }));

const updateGathering = oc
  .route({ method: 'PATCH', path: '/gatherings/{id}', tags: ['Gatherings'] })
  .input(UpdateGatheringInputSchema)
  // Host-only; a non-host's patch is NOT_FOUND, same as a stranger's read.
  .output(z.object({ gathering: GatheringSchema }));

const removeGathering = oc
  .route({ method: 'DELETE', path: '/gatherings/{id}', tags: ['Gatherings'] })
  .input(z.object({ id: z.uuid() }))
  .output(z.object({ ok: z.literal(true) }));

// My tags, minimal in M2 (the gathering detail's "point my tags here").
// M3 extends `update` with `status` and builds the Profile section on these.
const listMyTags = oc
  .route({ method: 'GET', path: '/me/tags', tags: ['Tags'] })
  .output(z.object({ tags: z.array(TagSchema) }));

const updateMyTag = oc
  .route({ method: 'PATCH', path: '/me/tags/{uid}', tags: ['Tags'] })
  .input(z.object({ uid: TagUidSchema, destination: DestinationSchema }))
  .output(z.object({ tag: TagSchema }));
```

In `appContract` add:

```ts
  gatherings: {
    create: createGathering,
    get: getGathering,
    join: joinGathering,
    leave: leaveGathering,
    listMine: listMyGatherings,
    update: updateGathering,
    remove: removeGathering,
  },
  tags: { listMine: listMyTags, update: updateMyTag },
```

**Step 5:** `index.ts` — add `export * from './schemas/gathering.ts';` after the destination export.

**Step 6:** `test/schemas.test.ts` — import `GatheringSchema, GatheringSummarySchema, CreateGatheringInputSchema, UpdateGatheringInputSchema`. Keep "rejects unknown destination types" as is (`link` is still unknown). Add inside the DestinationSchema describe:

```ts
  it('accepts a gathering destination', () => {
    const parsed = DestinationSchema.parse({
      type: 'gathering',
      gathering_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    });
    expect(parsed.type).toBe('gathering');
  });

  it('rejects a gathering destination with a malformed or missing id', () => {
    expect(DestinationSchema.safeParse({ type: 'gathering', gathering_id: 'nope' }).success).toBe(false);
    expect(DestinationSchema.safeParse({ type: 'gathering' }).success).toBe(false);
  });
```

In the ResolveOutputSchema describe: add `gathering: null,` to the existing claimed fixture, and:

```ts
  it('accepts a claimed result whose tag points at a gathering', () => {
    const result = ResolveOutputSchema.parse({
      status: 'claimed',
      uid: '04A3B2C1D05E80',
      destination: { type: 'gathering', gathering_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7' },
      gathering: {
        id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        title: 'Rooftop listening session',
        starts_at: '2026-10-09T18:00:00+00:00',
        location: null,
      },
      profile: { id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90', display_name: 'Sam', avatar_url: null, bio: null },
    });
    expect(result.status === 'claimed' && result.gathering?.title).toBe('Rooftop listening session');
  });

  it('rejects a claimed result without the gathering key (always present, nullable)', () => {
    expect(
      ResolveOutputSchema.safeParse({
        status: 'claimed',
        uid: '04A3B2C1D05E80',
        destination: { type: 'profile' },
        profile: { id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90', display_name: 'Sam', avatar_url: null, bio: null },
      }).success,
    ).toBe(false);
  });
```

New describe:

```ts
describe('gathering schemas', () => {
  const gathering = {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    title: 'Rooftop listening session',
    starts_at: '2026-10-09T18:00:00+00:00',
    location: 'The roof',
    host_id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
    created_at: '2026-10-01T00:00:00Z',
  };

  it('parses a gathering', () => {
    expect(GatheringSchema.parse(gathering).title).toBe('Rooftop listening session');
  });

  it('the summary exposes only what a tap may learn', () => {
    expect(Object.keys(GatheringSummarySchema.shape).toSorted()).toEqual(['id', 'location', 'starts_at', 'title']);
  });

  it('rejects an empty or oversized title and a non-ISO start', () => {
    expect(GatheringSchema.safeParse({ ...gathering, title: '' }).success).toBe(false);
    expect(GatheringSchema.safeParse({ ...gathering, title: 'x'.repeat(121) }).success).toBe(false);
    expect(GatheringSchema.safeParse({ ...gathering, starts_at: 'tomorrow' }).success).toBe(false);
  });

  it('trims the create input and allows a null location', () => {
    const parsed = CreateGatheringInputSchema.parse({ title: '  Tee time  ', starts_at: gathering.starts_at, location: null });
    expect(parsed).toEqual({ title: 'Tee time', starts_at: gathering.starts_at, location: null });
  });

  it('rejects an update with nothing to update', () => {
    expect(UpdateGatheringInputSchema.safeParse({ id: gathering.id }).success).toBe(false);
    expect(UpdateGatheringInputSchema.safeParse({ id: gathering.id, title: 'Moved' }).success).toBe(true);
  });
});
```

**Step 7:** `cd packages/contract && bun test && bun run typecheck; cd ../..` → 13 + 9 = 22 pass, typecheck clean. `bun run lint` clean. (`bun run --cwd packages/nfc-sdk typecheck` is now red on the parity test — expected until Task 6.)

**Step 8: Commit**

```bash
git add packages/contract
git commit -m "Contract: the gathering, its destination, and the always-present resolve summary

Entity, summary (what an anonymous tap may learn), member, and create/update
inputs; app.gatherings.{create,get,join,leave,listMine,update,remove}; the
M2-minimal app.tags.{listMine,update} the detail page needs so the web app
keeps owning no data access. The claimed resolve payload now always carries
a nullable gathering key, so the SDK mirror can stay exactly equal.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: RLS tests, red

**Files:** Create `packages/db/test/gatherings.test.ts`.

The twelve tests and their assertions:
1. Creating makes the host a member — the host reads the row and the one membership (their own id).
2. A stranger sees neither the gathering nor its members — both selects empty.
3. Joining admits the user and co-members read each other's cards — the host's profile is INVISIBLE to the joiner before `join_gathering`, two members after, the host card readable after.
4. Leaving removes gathering visibility and the card bridge — after deleting the own membership row, the gathering select and the host profile select are empty.
5. Anon can neither create nor join — both RPC errors contain `authentication required`.
6. (extra) Only the host edits or deletes — a member's update and delete match zero rows; the host's update lands; the host cannot change `host_id` (column not granted); the host's delete removes it for everyone.
7. A blocked join is indistinguishable from a missing gathering — both messages contain `gathering not found` AND are `toBe`-equal.
8. Blocking evicts the pair-hosted membership — service-role read shows only the host; the blocked viewer's gathering select is empty.
9. A gathering tag resolves to the summary, anonymously — `destination` equals `{ type: 'gathering', gathering_id }`, `gathering.title` matches, `gathering.location` matches.
10. A dangling destination degrades to the profile card — host deletes the gathering; anon resolve has `destination { type: 'profile' }` and `gathering null`.
11. (extra) A tag whose owner left the gathering degrades the same way.
12. Malformed destinations rejected at the DB boundary — `{ type: 'gathering' }` (the NULL trap), a non-uuid id, an extra key: each update error contains `tags_destination_shape`.

```ts
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

async function createGathering(client: Client, title = 'Rooftop listening session'): Promise<string> {
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

    expect((await mallory.client.from('gatherings').select('*').eq('id', id)).data ?? []).toEqual([]);
    expect(
      (await mallory.client.from('gathering_members').select('*').eq('gathering_id', id)).data ?? [],
    ).toEqual([]);
  });

  it('joining admits the user, and co-members can now read each other cards', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);

    // before joining, alice is invisible to bob (no enumeration)
    expect((await bob.client.from('profiles').select('id').eq('id', alice.id)).data ?? []).toEqual([]);

    const { error } = await bob.client.rpc('join_gathering', { p_gathering_id: id });
    expect(error).toBeNull();

    const { data: members } = await bob.client
      .from('gathering_members')
      .select('profile_id')
      .eq('gathering_id', id);
    expect(members).toHaveLength(2);

    // the gathering is the introduction context: the host's card is now visible
    const { data: hostCard } = await bob.client.from('profiles').select('id, display_name').eq('id', alice.id);
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
    expect((await bob.client.from('profiles').select('id').eq('id', alice.id)).data ?? []).toEqual([]);
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
    const { data: untouched } = await admin.from('gatherings').select('title').eq('id', id).single();
    expect(untouched?.title).toBe('Rooftop listening session');

    // the host edits the granted columns only
    const { error: editError } = await alice.client.from('gatherings').update({ title: 'Moved indoors' }).eq('id', id);
    expect(editError).toBeNull();
    const { error: hostIdError } = await alice.client.from('gatherings').update({ host_id: bob.id }).eq('id', id);
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
    const { error: missing } = await bob.client.rpc('join_gathering', { p_gathering_id: crypto.randomUUID() });
    expect(blocked?.message).toContain('gathering not found');
    expect(missing?.message).toContain('gathering not found');
    expect(blocked?.message).toBe(missing!.message);
  });

  it('blocking evicts the blocked member from the pair-hosted gathering', async () => {
    const alice = await createTestUser('Alice');
    const bob = await createTestUser('Bob');
    const id = await createGathering(alice.client);
    await bob.client.rpc('join_gathering', { p_gathering_id: id });

    const { error } = await alice.client.from('blocks').insert({ blocker_id: alice.id, blocked_id: bob.id });
    expect(error).toBeNull();

    const { data: raw } = await admin.from('gathering_members').select('profile_id').eq('gathering_id', id);
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
    await alice.client.rpc('claim_tag', { p_uid: uid, p_destination: { type: 'gathering', gathering_id: id } });
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
    await bob.client.rpc('claim_tag', { p_uid: uid, p_destination: { type: 'gathering', gathering_id: id } });
    expect(((await anonClient().rpc('resolve_tag', { p_uid: uid })).data as Resolved).gathering).not.toBeNull();

    await bob.client.from('gathering_members').delete().eq('gathering_id', id).eq('profile_id', bob.id);

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
```

**Verify red:** `cd packages/db && bun test test/gatherings.test.ts; cd ../..` → 12 failures (`create_gathering` does not exist). `bun run lint` clean. `packages/db` typecheck is red on the unknown RPC names — expected until Task 3.

**Commit**

```bash
git add packages/db/test/gatherings.test.ts
git commit -m "Add the gathering RLS tests, red

The ten from build-gathering §5 plus two: host-only edit/delete, and a tag
whose owner left the gathering degrading to the profile card. Red on
purpose: the migration that makes them green is the next commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Migration, seed, regenerated types → green

**Files:**
- Create: `supabase/migrations/20261008120000_add_gatherings.sql`
- Modify: `supabase/seed/index.ts`, `packages/db/src/types/supabase.ts` (generated)

**Step 1:** Create the migration. Dropped and recreated: policy `profiles_select` on `public.profiles` (every existing clause byte-identical; one disjunct added). Replaced in place (`create or replace`, all attributes restated): `private.on_block_created()` and `public.resolve_tag(text)`. Dropped and re-added: constraint `tags_destination_shape`.

```sql
-- Gatherings: the one universal feature. A host creates one, points a tag at
-- it, and a tap on that tag is the invitation.
--
-- Same safety semantics as the handshake:
--   * No enumeration: a gathering is reachable only via membership or a tag
--     whose destination points at it (capability = holding the tag). There
--     is no browse surface and no policy that could power one.
--   * Blocks are absolute and invisible: a join blocked by the host gets the
--     same 'gathering not found' as a nonexistent gathering; blocking evicts
--     the blocked party from gatherings the pair hosts for each other.
--   * Multi-step writes (create+self-join, checked join) are
--     security-definer RPCs; plain policies cover owner CRUD only.
--
-- Four mechanisms are load-bearing, marked (a)–(d) below and re-stated by
-- packages/db/test/gatherings.test.ts. A fork may add fields; it must not
-- loosen these (see .agents/skills/customize-gathering/SKILL.md §3).

-- ================================================================== tables ==

create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  starts_at timestamptz not null,
  location text check (location is null or char_length(location) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.gathering_members (
  gathering_id uuid not null references public.gatherings (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null default private.current_tenant_id(),
  joined_at timestamptz not null default now(),
  primary key (gathering_id, profile_id)
);

create index gatherings_host_idx on public.gatherings (host_id);
create index gathering_members_profile_idx on public.gathering_members (profile_id);

-- ================================================================= helpers ==

-- (a) Definer: a gathering_members policy cannot reference gathering_members
-- without infinite RLS recursion; this helper reads it with RLS bypassed.
create function private.is_gathering_member(p_gathering uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gathering_members
    where gathering_id = p_gathering and profile_id = p_user
  )
$$;

grant execute on function private.is_gathering_member(uuid, uuid) to authenticated;

-- (b) "Do a and b share any gathering?" — the visibility bridge that lets
-- co-members see each other's cards before they are connections.
create function private.shares_gathering(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.gathering_members ma
      join public.gathering_members mb on mb.gathering_id = ma.gathering_id
     where ma.profile_id = a and mb.profile_id = b
  )
$$;

grant execute on function private.shares_gathering(uuid, uuid) to authenticated;

-- ====================================================================== RLS ==

alter table public.gatherings enable row level security;
alter table public.gathering_members enable row level security;

-- Hosts edit title/time/location only: host_id and tenant_id stay immutable
-- even through RLS-passing rows (the same column-grant idiom as tags).
revoke update on public.gatherings from authenticated;
grant update (title, starts_at, location) on public.gatherings to authenticated;

create policy gatherings_select on public.gatherings
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and (host_id = (select auth.uid())
      or private.is_gathering_member(id, (select auth.uid())))
  );

create policy gatherings_update_host on public.gatherings
  for update to authenticated
  using (tenant_id = private.current_tenant_id() and host_id = (select auth.uid()))
  with check (tenant_id = private.current_tenant_id() and host_id = (select auth.uid()));

create policy gatherings_delete_host on public.gatherings
  for delete to authenticated
  using (tenant_id = private.current_tenant_id() and host_id = (select auth.uid()));

-- The member list is visible to members only. Joining goes through
-- join_gathering(); leaving is deleting your own row. NO insert policy on
-- either table: creation and joining are RPCs.
create policy gathering_members_select on public.gathering_members
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.is_gathering_member(gathering_id, (select auth.uid()))
  );

create policy gathering_members_delete_own on public.gathering_members
  for delete to authenticated
  using (tenant_id = private.current_tenant_id() and profile_id = (select auth.uid()));

-- (b) Co-members of a gathering see each other's cards (the gathering IS the
-- introduction context). profiles_select is dropped and recreated: every
-- clause below is byte-identical to the initial schema; the only addition is
-- the shares_gathering disjunct inside the not-blocked branch.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and (
      id = (select auth.uid())
      -- the blocker always sees whom they blocked (their own list UI),
      -- even under a mutual block
      or exists (
        select 1 from public.blocks b
        where b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id
      )
      or (
        not private.is_blocked((select auth.uid()), id)
        and (
          exists (
            select 1 from public.connections c
            where (c.user_a = (select auth.uid()) and c.user_b = profiles.id)
               or (c.user_b = (select auth.uid()) and c.user_a = profiles.id)
          )
          or exists (
            select 1 from public.connect_requests r
            where r.requester_id = profiles.id
              and r.recipient_id = (select auth.uid())
              and r.status = 'pending'
              and r.expires_at > now()
          )
          or private.shares_gathering((select auth.uid()), profiles.id)
        )
      )
    )
  );

-- (c) Blocking also evicts the blocked party from gatherings the pair hosts
-- for each other, in both directions. Co-membership in third-party
-- gatherings is untouched: the profiles block guard hides those cards.
-- Replaced in place with every attribute of the original restated.
create or replace function private.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_pair(new.blocker_id, new.blocked_id);
  delete from public.connections
   where user_a = least(new.blocker_id, new.blocked_id)
     and user_b = greatest(new.blocker_id, new.blocked_id);
  delete from public.connect_requests
   where status = 'pending'
     and ((requester_id = new.blocker_id and recipient_id = new.blocked_id)
       or (requester_id = new.blocked_id and recipient_id = new.blocker_id));
  delete from public.gathering_members gm
   using public.gatherings g
   where gm.gathering_id = g.id
     and ((g.host_id = new.blocker_id and gm.profile_id = new.blocked_id)
       or (g.host_id = new.blocked_id and gm.profile_id = new.blocker_id));
  return new;
end
$$;

-- ============================================================ destination ==

-- { type: 'gathering', gathering_id } joins the union. The coalesce is
-- load-bearing: a missing key makes the AND chain NULL, and a NULL CHECK
-- result PASSES in Postgres (add-destination-type §2).
alter table public.tags drop constraint tags_destination_shape;
alter table public.tags add constraint tags_destination_shape check (
  destination is null
  or destination = '{"type": "profile"}'::jsonb
  or coalesce(
    jsonb_typeof(destination) = 'object'
    and destination->>'type' = 'gathering'
    and destination->>'gathering_id'
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and destination - 'type' - 'gathering_id' = '{}'::jsonb,
    false
  )
);

-- ==================================================================== RPCs ==

-- Create a gathering and join it in one transaction. Returns the entity.
create function public.create_gathering(
  p_title text,
  p_starts_at timestamptz,
  p_location text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_gathering public.gatherings%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'profile required before hosting a gathering' using errcode = 'P0001';
  end if;

  insert into public.gatherings (host_id, title, starts_at, location)
  values (v_user, trim(p_title), p_starts_at, nullif(trim(p_location), ''))
  returning * into v_gathering;

  insert into public.gathering_members (gathering_id, profile_id, tenant_id)
  values (v_gathering.id, v_user, v_gathering.tenant_id);

  return jsonb_build_object(
    'id', v_gathering.id,
    'title', v_gathering.title,
    'starts_at', v_gathering.starts_at,
    'location', v_gathering.location,
    'host_id', v_gathering.host_id,
    'created_at', v_gathering.created_at
  );
end
$$;

-- (d) Join a gathering. A viewer blocked by the host gets 'gathering not
-- found' — byte-identical to the message for a gathering that never existed.
create function public.join_gathering(p_gathering_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_gathering public.gatherings%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'profile required before joining a gathering' using errcode = 'P0001';
  end if;

  select * into v_gathering
    from public.gatherings
   where id = p_gathering_id and tenant_id = private.current_tenant_id();
  if not found then
    raise exception 'gathering not found' using errcode = 'P0003';
  end if;

  -- serialize against a concurrent block by/of the host
  perform private.lock_pair(v_user, v_gathering.host_id);

  if private.is_blocked(v_user, v_gathering.host_id) then
    raise exception 'gathering not found' using errcode = 'P0003';
  end if;

  insert into public.gathering_members (gathering_id, profile_id, tenant_id)
  values (v_gathering.id, v_user, v_gathering.tenant_id)
  on conflict do nothing;
end
$$;

revoke execute on function public.create_gathering(text, timestamptz, text) from public;
revoke execute on function public.join_gathering(uuid) from public;
grant execute on function public.create_gathering(text, timestamptz, text) to authenticated;
grant execute on function public.join_gathering(uuid) to authenticated;

-- ============================================================ resolve_tag ==

-- Replaced to resolve gathering destinations: the claimed payload now ALWAYS
-- carries a 'gathering' key (a summary for gathering tags, null otherwise).
-- A dangling gathering (deleted after the tag was pointed at it) or one the
-- tag's owner no longer belongs to (left, or evicted by a block) degrades to
-- the profile destination: the resolver never breaks, and a tag is an
-- invitation only while its owner is actually in the gathering.
-- Grants from the initial schema (anon, authenticated) survive the replace.
create or replace function public.resolve_tag(p_uid text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid text := upper(trim(p_uid));
  v_tag public.tags%rowtype;
  v_profile public.profiles%rowtype;
  v_gathering public.gatherings%rowtype;
  v_destination jsonb;
  v_gathering_json jsonb := null;
begin
  select * into v_tag
    from public.tags
   where uid = v_uid and tenant_id = private.current_tenant_id();

  if not found or v_tag.status = 'unclaimed' then
    return jsonb_build_object('status', 'unclaimed', 'uid', v_uid);
  end if;

  if v_tag.status = 'disabled'
     or private.is_blocked((select auth.uid()), v_tag.claimed_by) then
    return jsonb_build_object('status', 'disabled', 'uid', v_uid);
  end if;

  select * into v_profile from public.profiles where id = v_tag.claimed_by;
  if not found then
    return jsonb_build_object('status', 'unclaimed', 'uid', v_uid);
  end if;

  v_destination := v_tag.destination;
  if v_destination->>'type' = 'gathering' then
    select * into v_gathering
      from public.gatherings
     where id = (v_destination->>'gathering_id')::uuid
       and tenant_id = private.current_tenant_id();
    if found and private.is_gathering_member(v_gathering.id, v_tag.claimed_by) then
      v_gathering_json := jsonb_build_object(
        'id', v_gathering.id,
        'title', v_gathering.title,
        'starts_at', v_gathering.starts_at,
        'location', v_gathering.location
      );
    else
      v_destination := '{"type": "profile"}'::jsonb;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'claimed',
    'uid', v_uid,
    'destination', v_destination,
    'gathering', v_gathering_json,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'display_name', v_profile.display_name,
      'avatar_url', v_profile.avatar_url,
      'bio', v_profile.bio
    )
  );
end
$$;
```

**Step 2:** `bun run db:reset` → ends `Finished supabase db reset`. `bun run db:types` → `git diff --stat packages/db/src/types/supabase.ts` shows new `gatherings` / `gathering_members` tables and `create_gathering` / `join_gathering` functions.

**Step 3:** Seed — in `supabase/seed/index.ts`, after Lin's connect request block and before `console.log(...)`:

```ts
// Ada hosts a gathering, Lin has joined, and Ada's live tag points at it:
// a tap on 04BBBBBBBBBBBB shows her card as the invitation.
const startsAt = new Date();
startsAt.setDate(startsAt.getDate() + 2);
startsAt.setHours(19, 0, 0, 0);
const { data: gathering, error: gatheringError } = await ada.client.rpc('create_gathering', {
  p_title: 'Rooftop listening session',
  p_starts_at: startsAt.toISOString(),
  p_location: 'The roof, 14 Loom St',
});
if (gatheringError) throw gatheringError;
const gatheringId = (gathering as { id: string }).id;
const { error: joinError } = await lin.client.rpc('join_gathering', { p_gathering_id: gatheringId });
if (joinError) throw joinError;
// The owner's column-granted update — the same path app.tags.update takes.
const { error: pointError } = await ada.client
  .from('tags')
  .update({ destination: { type: 'gathering', gathering_id: gatheringId } })
  .eq('uid', TAGS.claimed);
if (pointError) throw pointError;
```

Update the printed summary: the Ada line becomes `(has 1 pending request from Lin; hosts a gathering Lin joined)` and the claimed-tag line `-> Ada's card, inviting you to her gathering`. Update the header comment ("two users, three tags …, one pending connect request, one gathering").

**Step 4:** `bun run db:seed` prints the new lines. `cd packages/db && bun test; cd ../..` → 52 pass (12 new). `bun run lint && bun run --cwd packages/db typecheck && bun run --cwd packages/contract typecheck` clean.

**Commit**

```bash
git add supabase/migrations/20261008120000_add_gatherings.sql supabase/seed/index.ts packages/db/src/types/supabase.ts
git commit -m "Add gatherings: membership-scoped, block-respecting, joinable by tag

gatherings + gathering_members behind the four mechanisms from
build-gathering: a definer membership helper (no policy recursion), the
shares_gathering bridge in profiles_select (every other clause unchanged),
block eviction in on_block_created, and join_gathering raising the same
'gathering not found' for a missing id and a blocked viewer. No insert
policies; hosts get a (title, starts_at, location) column grant.

{ type: 'gathering', gathering_id } joins the destination CHECK with the
NULL-trap coalesce. resolve_tag now always returns a 'gathering' key and
degrades a dangling destination — or one whose owner is no longer a
member — to the profile card. Seed: Ada hosts one, Lin joined, her live
tag points at it. Regenerated types committed.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Queries

**Files:** Create `packages/db/src/queries/gatherings.ts`, `packages/db/src/queries/tags.ts`; modify `packages/db/src/queries/index.ts`.

`gatherings.ts`:

```ts
import type { Db, Tables } from '../index.ts';
import type { ProfileCard } from './handshake.ts';

const CARD_COLUMNS = 'id, display_name, avatar_url, bio';

/**
 * RLS does the scoping in every query here: a gathering you may not see (a
 * stranger's, or one whose host blocked you) reads as nonexistent.
 */
export async function getGathering(db: Db, gatheringId: string): Promise<Tables<'gatherings'> | null> {
  const { data, error } = await db.from('gatherings').select('*').eq('id', gatheringId).maybeSingle();
  if (error) throw error;
  return data;
}

export interface GatheringMemberRow {
  joined_at: string;
  profile: ProfileCard;
}

/** Members with their cards. A member whose profile is hidden from the
 * viewer (blocked) drops out silently — absence carries no signal. */
export async function listGatheringMembers(db: Db, gatheringId: string): Promise<GatheringMemberRow[]> {
  const { data, error } = await db
    .from('gathering_members')
    .select(`joined_at, profile:profiles!gathering_members_profile_id_fkey(${CARD_COLUMNS})`)
    .eq('gathering_id', gatheringId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.profile ? [{ joined_at: row.joined_at, profile: row.profile }] : [],
  );
}

/** Every gathering the caller can see (host or member), in start-time order. A bare select: RLS scopes it. */
export async function listMyGatherings(db: Db): Promise<Tables<'gatherings'>[]> {
  const { data, error } = await db.from('gatherings').select('*').order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface GatheringPatch {
  title?: string;
  starts_at?: string;
  location?: string | null;
}

/** Host-only by RLS and the column grant: a non-host's patch matches zero rows and reads as null. */
export async function updateGathering(
  db: Db,
  gatheringId: string,
  patch: GatheringPatch,
): Promise<Tables<'gatherings'> | null> {
  const { data, error } = await db
    .from('gatherings')
    .update(patch)
    .eq('id', gatheringId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Host-only by RLS; idempotent — a non-host's delete is a no-op. Memberships cascade. */
export async function deleteGathering(db: Db, gatheringId: string): Promise<void> {
  const { error } = await db.from('gatherings').delete().eq('id', gatheringId);
  if (error) throw error;
}

/** Leaving is deleting your own membership row — idempotent under RLS. */
export async function leaveGathering(db: Db, gatheringId: string, userId: string): Promise<void> {
  const { error } = await db
    .from('gathering_members')
    .delete()
    .eq('gathering_id', gatheringId)
    .eq('profile_id', userId);
  if (error) throw error;
}
```

`tags.ts`:

```ts
import type { Db } from '../index.ts';
import type { Json } from '../types/supabase.ts';

/** The owner's view of a tag. tenant_id and claimed_by never leave the database layer. */
const OWN_TAG_COLUMNS = 'uid, status, destination';

export interface OwnTagRow {
  uid: string;
  status: 'unclaimed' | 'claimed' | 'disabled';
  destination: Json | null;
}

/** Every tag the caller has claimed, including disabled ones. RLS: tags_select_own. */
export async function listOwnTags(db: Db): Promise<OwnTagRow[]> {
  const { data, error } = await db
    .from('tags')
    .select(OWN_TAG_COLUMNS)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Re-point one of the caller's tags. RLS + the (destination, status) column
 * grant make this owner-only and the CHECK constraint validates the shape.
 * A tag that is not yours matches zero rows and reads as null.
 */
export async function updateOwnTagDestination(
  db: Db,
  uid: string,
  destination: Json,
): Promise<OwnTagRow | null> {
  const { data, error } = await db
    .from('tags')
    .update({ destination })
    .eq('uid', uid)
    .select(OWN_TAG_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

`index.ts`: add `export * from './gatherings.ts';` and `export * from './tags.ts';`.

**Verify:** `bun run --cwd packages/db typecheck && bun run lint` clean.

**Commit**

```bash
git add packages/db/src/queries
git commit -m "Queries: gatherings and the owner's tags, scoped by RLS

maybeSingle() everywhere a stranger must read null; the member list drops
hidden cards via flatMap; listMine stays a bare select.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: API handlers

**Files:** Modify `apps/api/src/routers/app.ts`, `apps/api/src/routers/public.ts`.

**Step 1:** `app.ts` — imports become:

```ts
import { ORPCError } from '@orpc/server';
import type { Connection, Gathering, Profile, Tag } from '@withme/contract';
import {
  blockUser,
  deleteGathering,
  getGathering,
  getOwnProfile,
  leaveGathering,
  listBlocks,
  listConnections,
  listGatheringMembers,
  listMyGatherings,
  listOwnTags,
  listPendingRequests,
  removeConnection,
  unblockUser,
  updateGathering,
  updateOwnTagDestination,
  upsertOwnProfile,
} from '@withme/db/queries';
```

Add before `appRouter`:

```ts
const gatheringsCreate = appProcedure.gatherings.create.handler(async ({ input, context }) => {
  requireUser(context);
  const { data, error } = await context.db.rpc('create_gathering', {
    p_title: input.title,
    p_starts_at: input.starts_at,
    p_location: input.location ?? undefined,
  });
  if (error) throwFromDbError(error, context.logger);
  context.logger.info('gathering created');
  return { gathering: data as unknown as Gathering };
});

const gatheringsGet = appProcedure.gatherings.get.handler(async ({ input, context }) => {
  requireUser(context);
  const gathering = await run(context, () => getGathering(context.db, input.id));
  if (!gathering) {
    // invisible (stranger or blocked) and nonexistent are the same answer
    throw new ORPCError('NOT_FOUND', { message: 'Not found' });
  }
  const members = await run(context, () => listGatheringMembers(context.db, input.id));
  return { gathering, members };
});

const gatheringsJoin = appProcedure.gatherings.join.handler(async ({ input, context }) => {
  requireUser(context);
  const { error } = await context.db.rpc('join_gathering', { p_gathering_id: input.id });
  if (error) throwFromDbError(error, context.logger);
  return { ok: true as const };
});

const gatheringsLeave = appProcedure.gatherings.leave.handler(async ({ input, context }) => {
  const userId = requireUser(context);
  await run(context, () => leaveGathering(context.db, input.id, userId));
  return { ok: true as const };
});

const gatheringsListMine = appProcedure.gatherings.listMine.handler(async ({ context }) => {
  requireUser(context);
  const gatherings = await run(context, () => listMyGatherings(context.db));
  return { gatherings };
});

const gatheringsUpdate = appProcedure.gatherings.update.handler(async ({ input, context }) => {
  requireUser(context);
  const { id, ...patch } = input;
  const gathering = await run(context, () => updateGathering(context.db, id, patch));
  if (!gathering) {
    // not the host, or not visible at all: the same answer
    throw new ORPCError('NOT_FOUND', { message: 'Not found' });
  }
  return { gathering };
});

const gatheringsRemove = appProcedure.gatherings.remove.handler(async ({ input, context }) => {
  requireUser(context);
  await run(context, () => deleteGathering(context.db, input.id));
  return { ok: true as const };
});

const tagsListMine = appProcedure.tags.listMine.handler(async ({ context }) => {
  requireUser(context);
  const tags = await run(context, () => listOwnTags(context.db));
  return { tags: tags as Tag[] };
});

const tagsUpdate = appProcedure.tags.update.handler(async ({ input, context }) => {
  requireUser(context);
  const tag = await run(context, () => updateOwnTagDestination(context.db, input.uid, input.destination));
  if (!tag) {
    // not yours and nonexistent are the same answer
    throw new ORPCError('NOT_FOUND', { message: 'Not found' });
  }
  return { tag: tag as Tag };
});
```

In `appRouter` add:

```ts
  gatherings: {
    create: gatheringsCreate,
    get: gatheringsGet,
    join: gatheringsJoin,
    leave: gatheringsLeave,
    listMine: gatheringsListMine,
    update: gatheringsUpdate,
    remove: gatheringsRemove,
  },
  tags: { listMine: tagsListMine, update: tagsUpdate },
```

**Step 2:** `public.ts` — `import type { Destination, ResolveOutput } from '@withme/contract';` and in `claim`: `const tag = data as { uid: string; status: 'claimed'; destination: Destination };`.

**Verify:** `bun run --cwd apps/api typecheck && bun run lint` clean.

**Commit**

```bash
git add apps/api/src/routers
git commit -m "API: gatherings and my-tags handlers; invisible and nonexistent are the same NOT_FOUND

create/join call the definer RPCs; get, update, and tags.update read null
through RLS and answer NOT_FOUND; leave and remove are idempotent deletes.
The claim handler's destination cast widens to the contract union.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: SDK mirrors + parity

**Files:** Modify `packages/nfc-sdk/src/client.ts`.

Replace the `Destination` type and the claimed branch of `ApiResolveResult`:

```ts
/** The typed destination union. Declared structurally; the parity test keeps it equal to the contract. */
export type Destination = { type: 'profile' } | { type: 'gathering'; gathering_id: string };

/** What an anonymous tap on a gathering tag may learn. */
export interface GatheringSummary {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
}

export type ApiResolveResult =
  | { status: 'unclaimed'; uid: string }
  | {
      status: 'claimed';
      uid: string;
      destination: Destination;
      gathering: GatheringSummary | null;
      profile: PublicProfileCard;
    }
  | { status: 'disabled'; uid: string };
```

**Verify:** `bun run --cwd packages/nfc-sdk typecheck` (this is the parity check — the vitest run erases type-level assertions) and `bun run --cwd packages/nfc-sdk test`. Then `bun run typecheck` from the root — green across every workspace again.

**Commit**

```bash
git add packages/nfc-sdk/src/client.ts
git commit -m "SDK: mirror the gathering destination and the resolve summary

The parity test enforces exact equality with the contract under typecheck.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: API e2e extension

**Files:** Modify `apps/api/e2e/handshake.e2e.ts` — insert before the final `console.log`:

```ts
// === gatherings: tap-to-join through the API ===

// 12. create a gathering, point a tag at it, resolve anonymously
const created = await aliceApp.gatherings.create({
  title: 'E2E Rooftop',
  starts_at: new Date(Date.now() + 86_400_000).toISOString(),
  location: 'The roof',
});
assert(created.gathering.title === 'E2E Rooftop', 'gathering created');
assert(created.gathering.host_id === alice.id, 'creator is the host');

const gatheringUid = await provisionTag();
await authed.claim(gatheringUid, { type: 'gathering', gathering_id: created.gathering.id });
const gatheringResolved = await anon.resolve(gatheringUid);
assert(
  gatheringResolved.status === 'claimed' &&
    gatheringResolved.destination.type === 'gathering' &&
    gatheringResolved.gathering?.title === 'E2E Rooftop' &&
    gatheringResolved.gathering.location === 'The roof',
  'gathering tag resolves with the summary',
);
const plainResolved = await anon.resolve(uid);
assert(plainResolved.status === 'claimed' && plainResolved.gathering === null, 'a profile tag carries gathering: null');

// 13. bob joins; the member list carries cards both ways
await bobApp.gatherings.join({ id: created.gathering.id });
const detail = await bobApp.gatherings.get({ id: created.gathering.id });
assert(detail.members.length === 2, 'join lands in the member list');
assert(detail.members.some((m) => m.profile.display_name === 'E2E Alice'), 'member list carries the host card');
const mine = await bobApp.gatherings.listMine();
assert(mine.gatherings.some((g) => g.id === created.gathering.id), 'joined gathering shows in listMine');

// 14. only the host edits; a member's edit reads as not found
const edited = await aliceApp.gatherings.update({ id: created.gathering.id, title: 'E2E Rooftop (moved)' });
assert(edited.gathering.title === 'E2E Rooftop (moved)', 'host edits the gathering');
const bobEdit = await bobApp.gatherings.update({ id: created.gathering.id, title: 'Hijacked' }).then(
  () => 'edited',
  (e: { code?: string }) => e.code ?? 'error',
);
assert(bobEdit === 'NOT_FOUND', `a member cannot edit (got ${bobEdit})`);

// 15. my tags: list, re-point (destination only), stranger denied
const myTags = await aliceApp.tags.listMine();
assert(myTags.tags.some((t) => t.uid === gatheringUid), 'tags.listMine carries the pointed tag');
await aliceApp.tags.update({ uid: gatheringUid, destination: { type: 'profile' } });
const repointed = await anon.resolve(gatheringUid);
assert(
  repointed.status === 'claimed' && repointed.destination.type === 'profile' && repointed.gathering === null,
  'tags.update re-points the tag; the summary is gone',
);
const bobRepoint = await bobApp.tags.update({ uid: gatheringUid, destination: { type: 'profile' } }).then(
  () => 'updated',
  (e: { code?: string }) => e.code ?? 'error',
);
assert(bobRepoint === 'NOT_FOUND', `a stranger cannot re-point another's tag (got ${bobRepoint})`);

// 16. leaving removes visibility entirely
await bobApp.gatherings.leave({ id: created.gathering.id });
const gone = await bobApp.gatherings.get({ id: created.gathering.id }).then(
  () => 'visible',
  (e: { code?: string }) => e.code ?? 'error',
);
assert(gone === 'NOT_FOUND', `a left gathering reads as not found (got ${gone})`);
```

**Verify:** `cd apps/api && bun run dev` in one shell; `cd apps/api && bun run e2e` in another → ends `handshake e2e: all checks passed` with the §12–16 `ok:` lines. `bun run --cwd apps/api typecheck` (covers `e2e/`).

**Commit**

```bash
git add apps/api/e2e/handshake.e2e.ts
git commit -m "API e2e: create -> point tag -> anonymous summary -> join -> edit -> re-point -> leave

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Web — time helper, list route, detail route

**Files:**
- Create: `apps/web/src/lib/format-time.ts`, `apps/web/src/routes/_app.gatherings.tsx`, `apps/web/src/routes/_app.gatherings_.$id.tsx`
- Modify (generated): `apps/web/src/routeTree.gen.ts`

**Step 1:** `lib/format-time.ts`:

```ts
/** "Thu, Oct 9 · 7:00 PM" in the viewer's locale and timezone; null when unparseable. */
export function formatStartsAt(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const when = new Date(ms);
  const day = when.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = when.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `datetime-local` value (local wall clock, no offset). */
export function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The create form's pre-fill: tomorrow at 18:00 local. */
export function tomorrowEvening(): string {
  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(18, 0, 0, 0);
  return toDateTimeLocal(when);
}

/** One line for a gathering: "Title · Thu, Oct 9 · 7:00 PM · Location". */
export function gatheringLine(g: { title: string; starts_at: string; location: string | null }): string {
  return [g.title, formatStartsAt(g.starts_at) ?? g.starts_at, g.location].filter(Boolean).join(' · ');
}
```

**Step 2:** `_app.gatherings.tsx`:

```tsx
import type { Gathering } from '@withme/contract';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { shellStates } from '../components/CalmStates.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { formatStartsAt, tomorrowEvening } from '../lib/format-time.ts';

/**
 * The Events tab: the gatherings you host or have joined, and a form to
 * create one. There is deliberately no browse surface — the only way into
 * someone else's gathering is tapping their tag (docs/the-slice.md).
 */
export const Route = createFileRoute('/_app/gatherings')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Events — withme' }] }),
  loader: async () => {
    const { gatherings } = await asSignedInAccount(() => api.app.gatherings.listMine());
    return { gatherings };
  },
  component: GatheringsPage,
});

function GatheringsPage() {
  const { gatherings } = Route.useLoaderData();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(tomorrowEvening);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = Date.now();
  const upcoming = gatherings.filter((g) => Date.parse(g.starts_at) >= now);
  const past = gatherings.filter((g) => Date.parse(g.starts_at) < now).reverse();

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.app.gatherings.create({
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        location: location.trim() === '' ? null : location.trim(),
      });
      setTitle('');
      setLocation('');
      setStartsAt(tomorrowEvening());
      await router.invalidate();
    } catch {
      setError('Could not create the gathering. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={create}>
        <h1>Create a gathering</h1>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            required
            maxLength={120}
            placeholder="e.g. Rooftop listening session"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="starts_at">Starts</label>
          <input
            id="starts_at"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="location">Location (optional)</label>
          <input
            id="location"
            maxLength={160}
            placeholder="Where to find it"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={busy || !title.trim() || !startsAt}>
          {busy ? 'Creating…' : 'Create gathering'}
        </button>
      </form>

      <h2 className="section-title">Your gatherings</h2>
      {gatherings.length === 0 ? (
        <p className="empty">Tap a host's tag to join one, or create your own.</p>
      ) : upcoming.length === 0 ? (
        <p className="empty">Nothing coming up.</p>
      ) : (
        upcoming.map((g) => <GatheringRow key={g.id} gathering={g} />)
      )}
      {past.length > 0 ? (
        <>
          <h2 className="section-title">Past</h2>
          {past.map((g) => <GatheringRow key={g.id} gathering={g} />)}
        </>
      ) : null}
    </div>
  );
}

function GatheringRow({ gathering }: { gathering: Gathering }) {
  const sub = [formatStartsAt(gathering.starts_at) ?? gathering.starts_at, gathering.location]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="row">
      <div className="row-body">
        <span className="name">{gathering.title}</span>
        <span className="sub">{sub}</span>
      </div>
      <div className="row-actions">
        <Link className="btn btn--quiet" to="/gatherings/$id" params={{ id: gathering.id }}>
          Open
        </Link>
      </div>
    </div>
  );
}
```

**Step 3:** `_app.gatherings_.$id.tsx` (the un-nesting underscore keeps the list page from becoming a layout):

```tsx
import type { Destination, Gathering, GatheringMember, Tag } from '@withme/contract';
import { createFileRoute, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { shellStates } from '../components/CalmStates.tsx';
import { Avatar } from '../components/ProfileCard.tsx';
import { asSignedInAccount } from '../lib/account-scope.ts';
import { api } from '../lib/api.ts';
import { formatStartsAt, toDateTimeLocal } from '../lib/format-time.ts';

type LoaderResult =
  | { kind: 'detail'; gathering: Gathering; members: GatheringMember[] }
  // Non-member, blocked, or missing — all the same NOT_FOUND, so the page
  // offers a calm join instead of an error.
  | { kind: 'not_found' };

/** Display-only hints carried from the tag resolver, shown before joining. Never data. */
interface Hints {
  title?: string;
  starts_at?: string;
}

export const Route = createFileRoute('/_app/gatherings_/$id')({
  ...shellStates,
  head: () => ({ meta: [{ title: 'Gathering — withme' }] }),
  validateSearch: (search): Hints => {
    const hints: Hints = {};
    if (typeof search.title === 'string' && search.title !== '') hints.title = search.title.slice(0, 120);
    if (typeof search.starts_at === 'string' && search.starts_at !== '') {
      hints.starts_at = search.starts_at.slice(0, 40);
    }
    return hints;
  },
  loader: async ({ params }): Promise<LoaderResult> => {
    try {
      const { gathering, members } = await asSignedInAccount(() =>
        api.app.gatherings.get({ id: params.id }),
      );
      return { kind: 'detail', gathering, members };
    } catch (error) {
      if ((error as { code?: string }).code === 'NOT_FOUND') return { kind: 'not_found' };
      throw error;
    }
  },
  component: GatheringPage,
});

function GatheringPage() {
  const result = Route.useLoaderData();
  // The layout fetched the viewer's profile once; every _app child may read it.
  const { profile } = useLoaderData({ from: '/_app' });
  if (result.kind === 'not_found') return <JoinCard />;
  return (
    <GatheringDetail gathering={result.gathering} members={result.members} viewerId={profile?.id ?? null} />
  );
}

/** Not a member (yet): the tag was the invitation, so offer to join. */
function JoinCard() {
  const { id } = Route.useParams();
  const { title, starts_at } = Route.useSearch();
  const router = useRouter();
  const [join, setJoin] = useState<'idle' | 'joining' | 'failed' | 'unavailable'>('idle');
  const hint = [title ?? null, starts_at ? formatStartsAt(starts_at) : null].filter(Boolean).join(' · ');

  return (
    <div className="card card--settle">
      <h1>Join this gathering?</h1>
      {hint ? <p className="hint">{hint}</p> : null}
      {join === 'unavailable' ? (
        <p className="hint">This gathering isn't available.</p>
      ) : (
        <button
          type="button"
          className="btn btn--connect"
          disabled={join === 'joining'}
          onClick={async () => {
            setJoin('joining');
            try {
              await api.app.gatherings.join({ id });
              // The loader now sees the gathering as a member.
              await router.invalidate();
            } catch (error) {
              setJoin((error as { code?: string }).code === 'NOT_FOUND' ? 'unavailable' : 'failed');
            }
          }}
        >
          {join === 'joining' ? 'Joining…' : join === 'failed' ? 'Try again' : 'Join'}
        </button>
      )}
    </div>
  );
}

interface GatheringPatch {
  title: string;
  starts_at: string;
  location: string | null;
}

function GatheringDetail({
  gathering,
  members,
  viewerId,
}: {
  gathering: Gathering;
  members: GatheringMember[];
  viewerId: string | null;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isHost = viewerId === gathering.host_id;
  const isMember = viewerId !== null && members.some((member) => member.profile.id === viewerId);
  const when = [formatStartsAt(gathering.starts_at) ?? gathering.starts_at, gathering.location]
    .filter(Boolean)
    .join(' · ');

  async function save(patch: GatheringPatch) {
    setBusy(true);
    setActionError(null);
    try {
      await api.app.gatherings.update({ id: gathering.id, ...patch });
      await router.invalidate();
      setMode('view');
    } catch {
      setActionError('Could not save. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setActionError(null);
    try {
      await api.app.gatherings.remove({ id: gathering.id });
      navigate({ to: '/gatherings' });
    } catch {
      setActionError('That didn’t go through. Try again.');
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    setActionError(null);
    try {
      await api.app.gatherings.leave({ id: gathering.id });
      navigate({ to: '/gatherings' });
    } catch {
      setActionError('That didn’t go through. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        {mode === 'edit' ? (
          <EditForm gathering={gathering} busy={busy} onSave={save} onCancel={() => setMode('view')} />
        ) : (
          <>
            <h1>{gathering.title}</h1>
            <p className="hint">{when}</p>
            <TagPointer gatheringId={gathering.id} />
          </>
        )}
        {actionError ? (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {mode === 'view' && isHost ? (
          <div className="row-actions">
            <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => setMode('edit')}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              disabled={busy}
              onClick={() => setMode('confirm-delete')}
            >
              Delete gathering
            </button>
          </div>
        ) : null}
        {mode === 'confirm-delete' ? (
          <>
            <p className="bio">
              Delete this gathering? Members lose it, and tags pointing here fall back to your profile.
            </p>
            <div className="row-actions">
              <button type="button" className="btn" disabled={busy} onClick={remove}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
              <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => setMode('view')}>
                Keep
              </button>
            </div>
          </>
        ) : null}
        {mode === 'view' && isMember && !isHost ? (
          <button type="button" className="btn btn--quiet" disabled={busy} onClick={leave}>
            {busy ? 'Leaving…' : 'Leave gathering'}
          </button>
        ) : null}
      </div>

      <h2 className="section-title">Who's coming</h2>
      {members.map((member) => (
        <div className="row" key={member.profile.id}>
          <Avatar profile={member.profile} size="row" />
          <div className="row-body">
            <span className="name">{member.profile.display_name}</span>
            {member.profile.id === gathering.host_id ? (
              <span className="sub">Host</span>
            ) : member.profile.bio ? (
              <span className="sub">{member.profile.bio}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditForm({
  gathering,
  busy,
  onSave,
  onCancel,
}: {
  gathering: Gathering;
  busy: boolean;
  onSave: (patch: GatheringPatch) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(gathering.title);
  const [startsAt, setStartsAt] = useState(() => toDateTimeLocal(new Date(gathering.starts_at)));
  const [location, setLocation] = useState(gathering.location ?? '');
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          title: title.trim(),
          starts_at: new Date(startsAt).toISOString(),
          location: location.trim() === '' ? null : location.trim(),
        });
      }}
    >
      <div className="field">
        <label htmlFor="edit_title">Title</label>
        <input id="edit_title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="edit_starts_at">Starts</label>
        <input
          id="edit_starts_at"
          type="datetime-local"
          required
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="edit_location">Location (optional)</label>
        <input id="edit_location" maxLength={160} value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="row-actions">
        <button className="btn" type="submit" disabled={busy || !title.trim() || !startsAt}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn--quiet" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Members aim their own claimed tags at this gathering so a tap joins it.
 * Through the contract (app.tags.listMine / app.tags.update): the web app
 * owns no data access, even for single-row owner CRUD. The database still
 * enforces it — RLS plus the (destination, status) column grant.
 */
function TagPointer({ gatheringId }: { gatheringId: string }) {
  const [tags, setTags] = useState<Tag[] | 'loading' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [pointError, setPointError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { tags: mine } = await api.app.tags.listMine();
      setTags(mine.filter((tag) => tag.status === 'claimed'));
    } catch {
      setTags('failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (tags === 'loading' || tags === 'failed') return null;
  if (tags.length === 0) return <p className="hint">Claim a tag to point it at this gathering.</p>;

  const pointsHere = (tag: Tag) =>
    tag.destination?.type === 'gathering' && tag.destination.gathering_id === gatheringId;
  const pointingHere = tags.some(pointsHere);

  async function repoint(targets: Tag[], destination: Destination) {
    setBusy(true);
    setPointError(null);
    const results = await Promise.allSettled(
      targets.map((tag) => api.app.tags.update({ uid: tag.uid, destination })),
    );
    if (results.some((result) => result.status === 'rejected')) {
      setPointError('That didn’t go through. Try again.');
    }
    await load();
    setBusy(false);
  }

  return (
    <>
      {pointingHere ? (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => repoint(tags.filter(pointsHere), { type: 'profile' })}
        >
          Point my tags back to my profile
        </button>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => repoint(tags, { type: 'gathering', gathering_id: gatheringId })}
        >
          Point my tags at this gathering
        </button>
      )}
      {pointError ? (
        <p className="form-error" role="alert">
          {pointError}
        </p>
      ) : null}
    </>
  );
}
```

**Step 4:** `cd apps/web && bunx vite build && cd ../.. && bun run --cwd apps/web typecheck && bun run lint`. Expected: `routeTree.gen.ts` gains `/_app/gatherings` (path `/gatherings`) and `/_app/gatherings_/$id` (path `/gatherings/$id`); typecheck and lint clean.

**Commit**

```bash
git add apps/web/src/lib/format-time.ts 'apps/web/src/routes/_app.gatherings.tsx' 'apps/web/src/routes/_app.gatherings_.$id.tsx' apps/web/src/routeTree.gen.ts
git commit -m "Web: the Events tab and the gathering detail inside the shell

List + create under _app; detail with members, leave, host edit/delete, and
'point my tags here' through app.tags.*; a non-member's NOT_FOUND renders
the calm join card with display-only hints from the resolver.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Web — resolver branch, Events first, defaults

**Files:** Modify `apps/web/src/routes/t.$uid.tsx`, `apps/web/src/components/AppShell.tsx`, `apps/web/src/routes/login.tsx`, `auth.callback.tsx`, `index.tsx`.

**Step 1:** `t.$uid.tsx` — add imports `import type { GatheringSummary } from '@withme/contract';` and `import { gatheringLine } from '../lib/format-time.ts';`. After the `disabled` branch in `ResolvePage`, before the profile-card return:

```tsx
  // A gathering tag: the host's card is the invitation, the gathering is the
  // detail. `gathering` is non-null only alongside a gathering destination;
  // a deleted gathering (or one the owner left) degrades upstream to a plain
  // profile destination, so the card below is never blank.
  if (result.destination.type === 'gathering' && result.gathering) {
    return (
      <main className="page">
        <ProfileCard profile={result.profile} settle>
          <p className="hint">{gatheringLine(result.gathering)}</p>
          <GatheringInvite gathering={result.gathering} hostId={result.profile.id} />
        </ProfileCard>
        <WordmarkFooter />
      </main>
    );
  }
```

and a new component:

```tsx
/**
 * The Join link lands on the detail route under the shell, carrying
 * display-only hints. A signed-out tapper is sent through login by the
 * shell's own guard (returnTo keeps the hints), so no login routing here.
 * The host has nothing to join and gets a quiet "Open".
 */
function GatheringInvite({ gathering, hostId }: { gathering: GatheringSummary; hostId: string }) {
  const [isHost, setIsHost] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getSessionUserId().then((userId) => {
      if (!cancelled) setIsHost(userId === hostId);
    });
    return () => {
      cancelled = true;
    };
  }, [hostId]);
  return (
    <Link
      className={isHost ? 'btn' : 'btn btn--connect'}
      to="/gatherings/$id"
      params={{ id: gathering.id }}
      search={{ title: gathering.title, starts_at: gathering.starts_at }}
    >
      {isHost ? 'Open gathering' : 'Join this gathering'}
    </Link>
  );
}
```

**Step 2:** `AppShell.tsx` — import `Calendar` from `lucide-react`; `to: '/gatherings' | '/connections' | '/merch' | '/profile'`; `navItems` begins with `{ to: '/gatherings', label: 'Events', icon: Calendar },`. Add to the doc comment: "Events leads: the one universal feature is the first thing a signed-in user sees." (`navItems[0].to` already drives the wordmark link and the Merch fallback.)

**Step 3:** Defaults — `login.tsx`: `const destination = returnTo ?? '/gatherings';` and extend the context line:

```tsx
  const context = returnTo?.startsWith('/t/')
    ? 'to connect with the person whose tag you tapped'
    : returnTo?.startsWith('/gatherings/')
      ? 'to join the gathering you were invited to'
      : null;
```

`auth.callback.tsx`: `navigate({ href: returnTo ?? '/gatherings', replace: true });`. `index.tsx`: the "Open the app" link `to="/gatherings"`.

**Step 4:** `cd apps/web && bunx vite build && cd ../.. && bun run typecheck && bun run lint` clean. Run `bunx playwright test` in `apps/web` — the existing shell tests + handshake still pass, except the last shell test ("an account change while a navigation into the shell is loading…"), which asserts `returnToOf(first)` is `/connections`: it now reads `/gatherings` because "Open the app" points there. Update that assertion to `'/gatherings'` in this task so the suite is green at this commit.

**Commit**

```bash
git add apps/web/src
git commit -m "Web: the tag is the invitation — resolver branch, Events first, /gatherings default

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Web e2e

**Files:** Create `apps/web/e2e/gatherings.spec.ts`; modify `apps/web/e2e/shell.spec.ts`.

`gatherings.spec.ts`:

```ts
// The gathering: tap the host's tag, join, and see each other.
import { expect, test } from '@playwright/test';
import { admin, freshUid, signUp } from './helpers.ts';

test("tap a host's tag, join the gathering, and both see the member list", async ({ browser }) => {
  const uid = freshUid();
  const stamp = Date.now();
  const { error } = await admin.from('tags').insert({ uid });
  expect(error).toBeNull();

  // --- Ada: sign up with no destination -> Events is the default --------------
  const ada = await (await browser.newContext()).newPage();
  await ada.goto('/login');
  await signUp(ada, `smoke-host-${stamp}@rls.test`);
  await ada.waitForURL(/\/profile\?/);
  await ada.getByLabel('Name').fill('Smoke Ada');
  await ada.getByRole('button', { name: 'Save' }).click();
  await ada.waitForURL('**/gatherings');
  const adaNav = ada.getByRole('navigation', { name: 'Primary' });
  await expect(adaNav.getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');

  // --- Ada claims a tag (signed in: tap -> claim flow) --------------------------
  await ada.goto(`/t/${uid}`);
  await ada.waitForURL(`**/claim/${uid}`);
  await ada.getByRole('button', { name: 'Claim tag' }).click();
  await ada.waitForURL(`**/t/${uid}`);
  await expect(ada.getByText('This is your tag.')).toBeVisible();

  // --- Ada creates a gathering and points her tag at it -------------------------
  await ada.goto('/gatherings');
  await ada.getByLabel('Title').fill('Smoke Rooftop');
  await ada.getByLabel('Location (optional)').fill('The roof');
  await ada.getByRole('button', { name: 'Create gathering' }).click();
  await expect(ada.getByText('Smoke Rooftop')).toBeVisible();
  await ada.getByRole('link', { name: 'Open' }).click();
  await ada.waitForURL(/\/gatherings\/[0-9a-f-]{36}$/);
  const detailPath = new URL(ada.url()).pathname;
  await expect(ada.getByRole('heading', { name: 'Smoke Rooftop' })).toBeVisible();
  await expect(ada.getByText('Host', { exact: true })).toBeVisible();
  await ada.getByRole('button', { name: 'Point my tags at this gathering' }).click();
  await expect(ada.getByRole('button', { name: 'Point my tags back to my profile' })).toBeVisible();

  // --- Bob: taps anonymously, sees the invitation, signs up, joins -------------
  const bob = await (await browser.newContext()).newPage();
  await bob.goto(`/t/${uid}`);
  await expect(bob.getByRole('heading', { name: 'Smoke Ada' })).toBeVisible();
  await expect(bob.getByText(/Smoke Rooftop/)).toBeVisible();
  await bob.getByRole('link', { name: 'Join this gathering' }).click(); // shell guard -> login
  await bob.waitForURL(/\/login\?/);
  await signUp(bob, `smoke-guest-${stamp}@rls.test`);
  await bob.waitForURL(/\/profile\?/); // no profile yet: name first, destination remembered
  await bob.getByLabel('Name').fill('Smoke Bob');
  await bob.getByRole('button', { name: 'Save' }).click();

  await bob.waitForURL(`**${detailPath}**`);
  await expect(bob.getByRole('heading', { name: 'Join this gathering?' })).toBeVisible();
  await expect(bob.getByText(/Smoke Rooftop/)).toBeVisible(); // the hint, before joining
  await bob.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(bob.getByRole('heading', { name: 'Smoke Rooftop' })).toBeVisible();
  await expect(bob.getByText('Smoke Ada')).toBeVisible();
  await expect(bob.getByText('Smoke Bob')).toBeVisible();
  await expect(bob.getByRole('button', { name: 'Leave gathering' })).toBeVisible();

  // --- Ada sees Bob too ----------------------------------------------------------
  await ada.reload();
  await expect(ada.getByText('Smoke Bob')).toBeVisible();
});
```

`shell.spec.ts` — in the first test add `await expect(nav.getByRole('link', { name: 'Events' })).toBeVisible();` next to the Connections assertion, and append:

```ts
test('signing in without a destination lands on Events, the first tab', async ({ page }) => {
  await page.goto('/login');
  await signUp(page, `smoke-default-${Date.now()}@rls.test`);
  await page.waitForURL(/\/profile\?/);
  expect(returnToOf(page)).toBe('/gatherings');
  await page.getByLabel('Name').fill('Smoke Default');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForURL('**/gatherings');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link').first()).toHaveText('Events');
  await expect(nav.getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Create a gathering' })).toBeVisible();
  await expect(page.getByText("Tap a host's tag to join one, or create your own.")).toBeVisible();
});
```

**Verify:** `cd apps/web && CI=1 bunx playwright test; cd ../..` → `10 passed` (8 shell + handshake + gatherings).

**Commit**

```bash
git add apps/web/e2e
git commit -m "Web e2e: tap the host's tag, join, both see the member list; login defaults to Events

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Mobile — time helper, Events tab first, list screen

**Files:** Create `apps/mobile/lib/format-time.ts`, `apps/mobile/app/(tabs)/gatherings.tsx`; modify `apps/mobile/app/(tabs)/_layout.tsx`.

**Step 1:** `lib/format-time.ts`:

```ts
/** "Thu, Oct 9 · 7:00 PM" in the device locale and timezone; null when unparseable. */
export function formatStartsAt(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const when = new Date(ms);
  const day = when.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = when.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface DateAndTime {
  date: string;
  time: string;
}

/** Local wall-clock parts for the two form fields. */
export function toDateAndTime(when: Date): DateAndTime {
  return {
    date: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
    time: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
  };
}

/** The create form's pre-fill: tomorrow at 18:00 local. */
export function tomorrowEvening(): DateAndTime {
  const when = new Date();
  when.setDate(when.getDate() + 1);
  when.setHours(18, 0, 0, 0);
  return toDateAndTime(when);
}

/**
 * "2026-10-09" + "18:00" (local) -> ISO instant, or null when either part is
 * malformed. Two plain fields instead of a native picker: no new dependency,
 * and a keyboard is enough for a date and a time.
 */
export function parseLocalDateTime(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute] = [Number(t[1]), Number(t[2])];
  if (hour > 23 || minute > 59) return null;
  const when = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(when.getTime()) || when.getDate() !== day) return null; // e.g. Feb 30
  return when.toISOString();
}

/** One line for a gathering: "Title · Thu, Oct 9 · 7:00 PM · Location". */
export function gatheringLine(g: { title: string; starts_at: string; location: string | null }): string {
  return [g.title, formatStartsAt(g.starts_at) ?? g.starts_at, g.location].filter(Boolean).join(' · ');
}
```

**Step 2:** `(tabs)/_layout.tsx` — first `Tabs.Screen`:

```tsx
      <Tabs.Screen name="gatherings" options={{ title: 'Events', tabBarIcon: icon('calendar') }} />
```

(keep Connections, Merch, Profile after it in that order).

**Step 3:** `(tabs)/gatherings.tsx`:

```tsx
import type { Gathering } from '@withme/contract';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { formatStartsAt, parseLocalDateTime, tomorrowEvening } from '../../lib/format-time';
import { fonts, radius, space, useTokens } from '../../lib/tokens';

/**
 * The Events tab: gatherings you host or have joined, and a form to create
 * one. No browse surface — the only way into someone else's gathering is
 * their tag.
 */
export default function GatheringsScreen() {
  const t = useTokens();
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(tomorrowEvening);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { gatherings: mine } = await api.app.gatherings.listMine();
      setGatherings(mine);
      setError(null);
    } catch {
      setError('Could not load. Pull to retry.');
    } finally {
      setLoaded(true);
    }
  }, []);

  // Re-load whenever the tab regains focus: a detail screen may have left,
  // edited, or deleted a gathering underneath this list.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function create() {
    if (busy) return;
    const startsAt = parseLocalDateTime(when.date, when.time);
    if (!startsAt) {
      setError('Enter the date as YYYY-MM-DD and the time as HH:MM.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.app.gatherings.create({
        title: title.trim(),
        starts_at: startsAt,
        location: location.trim() === '' ? null : location.trim(),
      });
      setTitle('');
      setLocation('');
      setWhen(tomorrowEvening());
      await load();
    } catch {
      setError('Could not create the gathering. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const upcoming = gatherings.filter((g) => Date.parse(g.starts_at) >= now);
  const past = gatherings.filter((g) => Date.parse(g.starts_at) < now).reverse();

  const row = (gathering: Gathering) => (
    <Pressable
      key={gathering.id}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/gathering/[id]', params: { id: gathering.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: t.ink }]}>{gathering.title}</Text>
        <Text numberOfLines={1} style={[styles.rowSub, { color: t.inkMuted }]}>
          {[formatStartsAt(gathering.starts_at) ?? gathering.starts_at, gathering.location]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Card>
        <Title>Create a gathering</Title>
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="e.g. Rooftop listening session"
        />
        <Field
          label="Date"
          value={when.date}
          onChangeText={(date) => setWhen({ ...when, date })}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="2026-10-09"
        />
        <Field
          label="Time"
          value={when.time}
          onChangeText={(time) => setWhen({ ...when, time })}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="18:00"
        />
        <Field
          label="Location (optional)"
          value={location}
          onChangeText={setLocation}
          maxLength={160}
          placeholder="Where to find it"
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? 'Creating…' : 'Create gathering'}
          onPress={create}
          disabled={busy || !title.trim() || !when.date.trim() || !when.time.trim()}
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: t.ink }]}>Your gatherings</Text>
      {!loaded ? null : gatherings.length === 0 ? (
        <Muted>Tap a host's tag to join one, or create your own.</Muted>
      ) : upcoming.length === 0 ? (
        <Muted>Nothing coming up.</Muted>
      ) : (
        upcoming.map(row)
      )}
      {past.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Past</Text>
          {past.map(row)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.s5, paddingTop: space.s5, gap: space.s3 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.2, marginTop: space.s4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  rowSub: { fontFamily: fonts.body, fontSize: 14 },
});
```

**Verify:** `bun run --cwd apps/mobile typecheck && bun run lint` clean. (Typed routes are off — `pathname: '/gathering/[id]'` compiles before Task 12 creates the file; the route must exist at runtime by Task 13.)

**Commit**

```bash
git add apps/mobile/lib/format-time.ts 'apps/mobile/app/(tabs)/gatherings.tsx' 'apps/mobile/app/(tabs)/_layout.tsx'
git commit -m "Mobile: the Events tab, first in the bar

List + create with a date and a time field (no picker dependency); the list
re-loads on focus so a detail's leave or delete shows up on return.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Mobile — detail stack screen, resolver branch, defaults

**Files:** Create `apps/mobile/app/gathering/[id].tsx`; modify `apps/mobile/app/_layout.tsx`, `app/t/[uid].tsx`, `app/index.tsx`, `app/login.tsx`, `app/(tabs)/merch.tsx`.

**Step 1:** `app/_layout.tsx` — inside `<Stack.Protected guard={!!session}>` add `<Stack.Screen name="gathering/[id]" />` after `(tabs)`.

**Step 2:** `app/gathering/[id].tsx`:

```tsx
import type { Destination, Gathering, GatheringMember, Tag } from '@withme/contract';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, ErrorText, Field, Muted, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { formatStartsAt, parseLocalDateTime, toDateAndTime } from '../../lib/format-time';
import { supabase } from '../../lib/supabase';
import { fonts, radius, space, useTokens } from '../../lib/tokens';

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  // Non-member, blocked, or missing — all the same NOT_FOUND, so the screen
  // offers a calm join instead of an error.
  | { kind: 'join' }
  | { kind: 'detail'; gathering: Gathering; members: GatheringMember[]; userId: string | null };

/** The detail is a stack screen: it pushes over the tab bar (docs/the-slice.md step 6). */
export default function GatheringScreen() {
  const t = useTokens();
  // title/starts_at are display-only hints from the resolver — never data.
  const params = useLocalSearchParams<{ id: string; title?: string; starts_at?: string }>();
  const id = (params.id ?? '').trim();
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [join, setJoin] = useState<'idle' | 'joining' | 'failed' | 'unavailable'>('idle');

  const load = useCallback(async () => {
    try {
      const [{ gathering, members }, { data }] = await Promise.all([
        api.app.gatherings.get({ id }),
        supabase.auth.getSession(),
      ]);
      setState({ kind: 'detail', gathering, members, userId: data.session?.user.id ?? null });
    } catch (error) {
      setState((error as { code?: string }).code === 'NOT_FOUND' ? { kind: 'join' } : { kind: 'failed' });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loading') {
    return <View style={[styles.page, { backgroundColor: t.bg }]} />;
  }

  if (state.kind === 'failed') {
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card>
          <Title>Couldn't load this gathering</Title>
          <ErrorText>Check your connection and try again.</ErrorText>
          <Button label="Retry" onPress={load} />
          <Button label="Back" kind="quiet" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  if (state.kind === 'join') {
    const hint = [params.title ?? null, params.starts_at ? formatStartsAt(params.starts_at) : null]
      .filter(Boolean)
      .join(' · ');
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card settle>
          <Title>Join this gathering?</Title>
          {hint ? <Muted>{hint}</Muted> : null}
          {join === 'unavailable' ? (
            <Muted>This gathering isn't available.</Muted>
          ) : (
            <Button
              kind="connect"
              disabled={join === 'joining'}
              label={join === 'joining' ? 'Joining…' : join === 'failed' ? 'Try again' : 'Join'}
              onPress={async () => {
                setJoin('joining');
                try {
                  // Members see your card, so a profile must exist before you join.
                  const { profile } = await api.app.profile.get();
                  if (!profile) {
                    setJoin('idle'); // this screen stays mounted under the push
                    router.push({ pathname: '/profile', params: { redirect: `/gathering/${id}` } });
                    return;
                  }
                  await api.app.gatherings.join({ id });
                  await load();
                } catch (error) {
                  setJoin((error as { code?: string }).code === 'NOT_FOUND' ? 'unavailable' : 'failed');
                }
              }}
            />
          )}
          <Button label="Back" kind="quiet" onPress={() => router.back()} />
        </Card>
      </View>
    );
  }

  return <GatheringDetail {...state} reload={load} />;
}

interface GatheringPatch {
  title: string;
  starts_at: string;
  location: string | null;
}

function GatheringDetail({
  gathering,
  members,
  userId,
  reload,
}: {
  gathering: Gathering;
  members: GatheringMember[];
  userId: string | null;
  reload: () => Promise<void>;
}) {
  const t = useTokens();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isHost = userId === gathering.host_id;
  const isMember = userId !== null && members.some((member) => member.profile.id === userId);

  async function run(work: () => Promise<unknown>, then: 'reload' | 'list') {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      if (then === 'list') {
        // Pop back to the tabs if they are below us; push them if this was a
        // cold deep link. Never stack a second tab shell.
        router.dismissTo('/gatherings');
        return;
      }
      await reload();
      setEditing(false);
    } catch {
      setActionError("That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this gathering?',
      'Members lose it, and tags pointing here fall back to your profile.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(() => api.app.gatherings.remove({ id: gathering.id }), 'list'),
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        {editing ? (
          <EditFields
            gathering={gathering}
            busy={busy}
            onCancel={() => setEditing(false)}
            onSave={(patch) => run(() => api.app.gatherings.update({ id: gathering.id, ...patch }), 'reload')}
          />
        ) : (
          <>
            <Title>{gathering.title}</Title>
            <Muted>
              {[formatStartsAt(gathering.starts_at) ?? gathering.starts_at, gathering.location]
                .filter(Boolean)
                .join(' · ')}
            </Muted>
            <TagPointer gatheringId={gathering.id} />
          </>
        )}
        {actionError ? <ErrorText>{actionError}</ErrorText> : null}
        {!editing && isHost ? (
          <>
            <Button label="Edit" kind="quiet" disabled={busy} onPress={() => setEditing(true)} />
            <Button label="Delete gathering" kind="quiet" disabled={busy} onPress={confirmDelete} />
          </>
        ) : null}
        {!editing && isMember && !isHost ? (
          <Button
            label={busy ? 'Leaving…' : 'Leave gathering'}
            kind="quiet"
            disabled={busy}
            onPress={() => run(() => api.app.gatherings.leave({ id: gathering.id }), 'list')}
          />
        ) : null}
        {!editing ? <Button label="Back" kind="quiet" onPress={() => router.back()} /> : null}
      </Card>

      <Text style={[styles.sectionTitle, { color: t.ink }]}>Who's coming</Text>
      {members.map((member) => (
        <View
          key={member.profile.id}
          style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Avatar name={member.profile.display_name} url={member.profile.avatar_url} size={44} />
          <View style={styles.rowBody}>
            <Text style={[styles.rowName, { color: t.ink }]}>{member.profile.display_name}</Text>
            {member.profile.bio ? (
              <Text numberOfLines={1} style={[styles.rowSub, { color: t.inkMuted }]}>
                {member.profile.bio}
              </Text>
            ) : null}
          </View>
          {member.profile.id === gathering.host_id ? (
            <Text style={[styles.rowSub, { color: t.inkMuted }]}>Host</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function EditFields({
  gathering,
  busy,
  onSave,
  onCancel,
}: {
  gathering: Gathering;
  busy: boolean;
  onSave: (patch: GatheringPatch) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(gathering.title);
  const [when, setWhen] = useState(() => toDateAndTime(new Date(gathering.starts_at)));
  const [location, setLocation] = useState(gathering.location ?? '');
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
      <Field
        label="Date"
        value={when.date}
        onChangeText={(date) => setWhen({ ...when, date })}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Time"
        value={when.time}
        onChangeText={(time) => setWhen({ ...when, time })}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <Field label="Location (optional)" value={location} onChangeText={setLocation} maxLength={160} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        label={busy ? 'Saving…' : 'Save'}
        disabled={busy || !title.trim()}
        onPress={() => {
          const startsAt = parseLocalDateTime(when.date, when.time);
          if (!startsAt) {
            setError('Enter the date as YYYY-MM-DD and the time as HH:MM.');
            return;
          }
          setError(null);
          onSave({
            title: title.trim(),
            starts_at: startsAt,
            location: location.trim() === '' ? null : location.trim(),
          });
        }}
      />
      <Button label="Cancel" kind="quiet" disabled={busy} onPress={onCancel} />
    </>
  );
}

/**
 * Members aim their own claimed tags at this gathering so a tap joins it.
 * Through the contract (app.tags.listMine / app.tags.update) — the mobile
 * app's only data path is the API, same as web.
 */
function TagPointer({ gatheringId }: { gatheringId: string }) {
  const [tags, setTags] = useState<Tag[] | 'loading' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [pointError, setPointError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { tags: mine } = await api.app.tags.listMine();
      setTags(mine.filter((tag) => tag.status === 'claimed'));
    } catch {
      setTags('failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (tags === 'loading' || tags === 'failed') return null;
  if (tags.length === 0) return <Muted>Claim a tag to point it at this gathering.</Muted>;

  const pointsHere = (tag: Tag) =>
    tag.destination?.type === 'gathering' && tag.destination.gathering_id === gatheringId;
  const pointingHere = tags.some(pointsHere);

  async function repoint(targets: Tag[], destination: Destination) {
    setBusy(true);
    setPointError(null);
    const results = await Promise.allSettled(
      targets.map((tag) => api.app.tags.update({ uid: tag.uid, destination })),
    );
    if (results.some((result) => result.status === 'rejected')) {
      setPointError("That didn't go through. Try again.");
    }
    await load();
    setBusy(false);
  }

  return (
    <>
      {pointingHere ? (
        <Button
          label="Point my tags back to my profile"
          disabled={busy}
          onPress={() => repoint(tags.filter(pointsHere), { type: 'profile' })}
        />
      ) : (
        <Button
          label="Point my tags at this gathering"
          disabled={busy}
          onPress={() => repoint(tags, { type: 'gathering', gathering_id: gatheringId })}
        />
      )}
      {pointError ? <ErrorText>{pointError}</ErrorText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: space.s5 },
  content: { padding: space.s5, paddingTop: space.s7 + space.s4, gap: space.s3 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.2, marginTop: space.s4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  rowSub: { fontFamily: fonts.body, fontSize: 14 },
});
```

**Step 3:** `app/t/[uid].tsx` — import `GatheringSummary` type from `@withme/contract` and `gatheringLine` from `'../../lib/format-time'`. Before the final profile-card return in `ResolveScreen`:

```tsx
  // A gathering tag: the host's card is the invitation, the gathering is the
  // detail. `gathering` is non-null only alongside a gathering destination;
  // a deleted gathering (or one the owner left) degrades upstream.
  if (result.destination.type === 'gathering' && result.gathering) {
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card settle>
          <Avatar name={result.profile.display_name} url={result.profile.avatar_url} />
          <Title>{result.profile.display_name}</Title>
          {result.profile.bio ? <Muted>{result.profile.bio}</Muted> : null}
          <Muted>{gatheringLine(result.gathering)}</Muted>
          <GatheringInvite gathering={result.gathering} hostId={result.profile.id} />
        </Card>
      </View>
    );
  }
```

New component in the same file:

```tsx
/**
 * gathering/[id] sits behind Stack.Protected: a signed-out push would bounce
 * to the anchor and lose the id, so the signed-out path carries the id and
 * the display hints through login. The host gets a quiet "Open".
 */
function GatheringInvite({ gathering, hostId }: { gathering: GatheringSummary; hostId: string }) {
  const [viewer, setViewer] = useState<'loading' | 'anon' | 'host' | 'other'>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      setViewer(!userId ? 'anon' : userId === hostId ? 'host' : 'other');
    });
  }, [hostId]);

  return (
    <Button
      kind={viewer === 'host' ? 'default' : 'connect'}
      disabled={viewer === 'loading'}
      label={viewer === 'host' ? 'Open gathering' : 'Join this gathering'}
      onPress={() => {
        if (viewer === 'anon') {
          const hints = `title=${encodeURIComponent(gathering.title.slice(0, 60))}&starts_at=${encodeURIComponent(gathering.starts_at)}`;
          router.push({
            pathname: '/login',
            params: { redirect: `/gathering/${gathering.id}?${hints}` },
          });
          return;
        }
        router.push({
          pathname: '/gathering/[id]',
          params: { id: gathering.id, title: gathering.title, starts_at: gathering.starts_at },
        });
      }}
    />
  );
}
```

**Step 4:** Defaults — `app/index.tsx`: `<Redirect href={session ? '/gatherings' : '/login'} />`; `app/login.tsx`: `router.replace(safeRedirect(params.redirect) ?? '/gatherings');` and widen its context check to `params.redirect?.startsWith('/gathering/')` with copy "to join the gathering you were invited to" (keep the tag line for `/t/` and `/claim/`); `app/(tabs)/merch.tsx`: `<Redirect href="/gatherings" />`.

**Verify:** `bun run --cwd apps/mobile typecheck && bun run lint` clean.

**Commit**

```bash
git add apps/mobile/app
git commit -m "Mobile: the gathering detail as a stack screen, the resolver invitation, /gatherings default

Join on NOT_FOUND with the resolver's hints; a signed-out tapper carries
the id through login because the screen is Stack.Protected. Leave and
delete dismissTo the tabs instead of stacking a second shell.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Simulator pass

**Files:** none (fix anything found in a small follow-up commit).

`bun run --filter @withme/api dev` in one shell; `cd apps/mobile && bunx expo start --ios` in another. Screenshot each state (`xcrun simctl io booted screenshot ~/Desktop/events-<n>.png`).

1. Cold start signed out → login. Sign in as `ada@demo.withme.local` / `withme-demo-1` → lands on **Events** (first tab, Feather `calendar`), bar order Events · Connections · Profile (no Merch). "Rooftop listening session" is listed under Your gatherings.
2. Tap the row → the detail pushes over the bar: title, date line with location, "Point my tags back to my profile" (the seed pointed Ada's tag), Edit / Delete gathering (host), Who's coming: Ada (Host), Lin. Back returns to the tab.
3. Edit → change the time → Save → the header updates; Back → the list shows the new time (focus reload).
4. Create a gathering with the pre-filled date/time → it appears under Your gatherings; enter `2026-02-30` as the date → the inline error.
5. Deep link `xcrun simctl openurl booted "withme://t/04BBBBBBBBBBBB"` → Ada's card + "Rooftop listening session · … · The roof, 14 Loom St" + quiet "Open gathering" (she is the host) → the detail.
6. Sign out from Profile. Sign in as `lin@demo.withme.local` → Events lists the gathering (joined); detail shows "Leave gathering", no Edit/Delete; leave → lands on the Events tab (no second bar), list is empty with the empty-state copy; the deep link above now shows "Join this gathering" → signed-in push → join card → Join → detail again.
7. Signed out: open the deep link → "Join this gathering" → login with the redirect → after sign-in lands on the join card with the hint line.
8. Tap "Point my tags at this gathering" as Lin (Lin has no tags) → "Claim a tag to point it at this gathering."

Expected: all eight as described.

---

### Task 14: Docs

**Files:** Modify `docs/skills-roadmap.md`, `README.md`, `docs/the-slice.md`, `.agents/skills/add-destination-type/SKILL.md`, `.agents/skills/make-it-yours/SKILL.md`.

**Step 1:** `docs/skills-roadmap.md` — change the status line to `Decided 2026-06-11 (Alex + Claude session). Status: agreed; revised 2026-09-22 — see the dated section at the end.` Leave the body as written (it is a record) and append:

```markdown
## Revised 2026-09-22 — the shell and the gathering move into core

Decided with `docs/superpowers/specs/2026-09-22-app-shell-and-tabs-design.md`
and landed across the shell PRs. Two findings from the first two derivations
(golf-with-me, tailgate-with-me) changed the strategy above:

- **The gathering is core, not a skill.** Both forks hand-built the same
  entity (a round, a tailgate) plus list/detail screens on the flat two-link
  nav before they could do anything vertical-specific — the one universal
  feature cannot be added by prose after the fact. `gatherings` +
  `gathering_members`, the `{ type: 'gathering', gathering_id }` destination,
  the `resolve_tag` summary, `app.gatherings.*`, and the Events tab ship in
  the starter (`supabase/migrations/20261008120000_add_gatherings.sql`,
  `packages/db/test/gatherings.test.ts`). Tier 2 item 4 (**build-gathering**)
  becomes **customize-gathering**: rename user-facing nouns, add fields.
  Internal identifiers stay `gathering` in a fork, as `@withme/*` packages
  stay. The V1 invariant is unchanged: no browse surface, nothing ranks or
  aggregates.
- **Merch is a tab, still a pointer.** The rejected merch/Shopify tab above
  stands as written for commerce; the approved fulfillment pointer is
  promoted from a landing-page link to a tab rendering one card and one
  "Open store" action, present only when `VITE_STORE_URL` /
  `EXPO_PUBLIC_STORE_URL` is set. No Shopify API, no cart, no product data.
- **Chrome is core.** Events, Connections, Merch, Profile on web (`_app`
  layout) and mobile (`(tabs)`). `/me` is now `/profile` — the V1.1 note
  "account-deletion UI in /me" reads `/profile`.
- **Naming.** Tier 2 item 3 ("onboarding") ships as **extend-profile**; its
  two-tier visibility work is unchanged. Tier 3's **provision-tags** is
  distilled from golf-with-me `bee9c9d`.
- **My tags goes through the contract** (`app.tags.listMine` / `update`):
  the web app keeps owning no data access, even for single-row owner CRUD.
```

**Step 2:** `README.md`:
- Contract bullet: `(`{ type: 'profile' }` today; `link | menu | vcard` can join without schema change)` → `(`profile` and `gathering` today; `link | menu | vcard` can join without schema change)`; `app` router description → `(profile, connect, block, gatherings, my tags — session-scoped)`.
- `apps/mobile` bullet → `` `apps/mobile` — the Expo client: the same tabs (Events, Connections, Merch, Profile) and resolver over the same contract; NFC reading in development builds. ``
- Safety semantics: add a bullet after "Mutual consent": `- **Gatherings are membership-scoped.** The one feature beyond the handshake: a host creates a gathering, points a tag at it, and a tap is the invitation. Only members see a gathering or each other's cards through it; a join refused by a block is indistinguishable from a gathering that does not exist; blocking evicts. There is no browse surface.` Replace the `37` in the phrase `37 policy tests` (it wraps across two README lines; search for `37 policy`) with the number `bun run --cwd packages/db test` prints (the Task 0 baseline +12).
- Quickstart: `` Then open `http://localhost:3000/t/04BBBBBBBBBBBB` (Ada's tag — her card, inviting you to the gathering she hosts), `/t/04AAAAAAAAAAAA` (the claim flow), or sign in as `ada@demo.withme.local` / `withme-demo-1` to see her gathering and her pending request. `` Tests line: `(Playwright smoke: resolve → claim → connect, the signed-in shell, and tap → join a gathering)`.

**Step 3:** `docs/the-slice.md`:
- Step 5: `(e.g. `_app.gatherings_.$id.tsx`)` → `(`_app.gatherings_.$id.tsx` is the real one)`. Append to the paragraph: `The web app owns no data access, even for single-row owner CRUD: re-pointing your own tag goes through `app.tags.update`, never a browser Supabase query — the My tags precedent.`
- Step 6: `(`claim/[uid].tsx`, `scan.tsx`)` → `(`gathering/[id].tsx`, `claim/[uid].tsx`, `scan.tsx`)`; append `A detail screen returns to the tabs with `router.dismissTo`, never by pushing a second `(tabs)` shell.`
- Step 7: add `` `gatherings.spec.ts` — tap the host's tag, join, both see the member list `` to the Playwright list.
- "No enumeration" bullet: append `Membership is a capability too: a gathering is reachable only by its members or through a tag whose owner is a member (`private.is_gathering_member`), and `gatherings` has no policy that could power a browse.`

**Step 4:** `add-destination-type/SKILL.md`: §1 code block's union lists `ProfileDestinationSchema, GatheringDestinationSchema, LinkDestinationSchema`; §3's parenthetical becomes `(the core `gathering` type is the worked example — see the `resolve_tag` section of `supabase/migrations/20261008120000_add_gatherings.sql`)`; §5 becomes `The claim handler already casts to the contract's `Destination` union — nothing to do unless you changed `resolve_tag`'s shape.`; §6's example type gains the `gathering` member before `link`.

**Step 5:** `make-it-yours/SKILL.md` §3 page-titles bullet: add `` `_app.gatherings.tsx`, `_app.gatherings_.$id.tsx` `` after `_app.connections.tsx`.

**Commit**

```bash
git add docs README.md .agents/skills/add-destination-type/SKILL.md .agents/skills/make-it-yours/SKILL.md
git commit -m "Docs: the gathering in core — roadmap revision, README, slice touch-ups

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: `customize-gathering` replaces `build-gathering`

**Files:** `git mv .agents/skills/build-gathering .agents/skills/customize-gathering`, then rewrite `SKILL.md`:

```markdown
---
name: customize-gathering
description: Use when a withme-starter fork wants its gathering to speak the vertical's language — rename the user-facing nouns (round, tailgate, table, meetup), add fields (course, venue, capacity), or adjust the create form — without touching the safety semantics that ship in core.
---

# customize-gathering — make the core gathering yours

The gathering ships in the starter: a host creates one, points a tag at it,
and a tap on that tag is the invitation. It was the one feature every
derivation built by hand (golf-with-me "rounds", tailgate-with-me
"tailgates" — the same entity each time), so it is core code now and this
skill customizes it instead of building it.

Two kinds of change are yours: **nouns** (what users read, and the URLs they
see) and **fields** (what a gathering records). Internal identifiers — table
names, contract keys, types, policy names, the `gathering` destination type —
stay `gathering`, the same rule make-it-yours applies to `@withme/*`
packages. Safety semantics are NOT yours to redesign; §3 lists what must not
move.

**REQUIRED BACKGROUND:** `docs/the-slice.md`. Fields follow the slice in
order (contract → migration → tests → API → web → mobile → e2e).

## What is in core (the map)

| Layer | Files |
| --- | --- |
| Contract | `packages/contract/src/schemas/gathering.ts`; `schemas/destination.ts` (`GatheringDestinationSchema`); `contract/app.ts` (`gatherings.*`, `tags.*`); `contract/public.ts` (`gathering` summary on resolve) |
| Migration | `supabase/migrations/20261008120000_add_gatherings.sql` |
| RLS tests | `packages/db/test/gatherings.test.ts` (12) |
| Queries / API | `packages/db/src/queries/gatherings.ts`, `queries/tags.ts`; `apps/api/src/routers/app.ts` |
| SDK mirror | `packages/nfc-sdk/src/client.ts` (`Destination`, `GatheringSummary`) |
| Web | `apps/web/src/routes/_app.gatherings.tsx`, `_app.gatherings_.$id.tsx`, the branch in `t.$uid.tsx`, `lib/format-time.ts`, `components/AppShell.tsx` (`navItems[0]`) |
| Mobile | `apps/mobile/app/(tabs)/gatherings.tsx`, `app/gathering/[id].tsx`, the branch in `app/t/[uid].tsx`, `lib/format-time.ts`, `(tabs)/_layout.tsx` |
| E2E | `apps/api/e2e/handshake.e2e.ts` §12–16; `apps/web/e2e/gatherings.spec.ts` |
| Seed | `supabase/seed/index.ts` (Ada hosts one; her live tag points at it) |

## 1. Nouns

Decide the singular/plural ("round"/"rounds"), the tab label (the starter
says "Events"), and the URL segment (`/rounds`).

**Copy.** The user-facing word is "gathering" everywhere except the tab
label. Sweep with
`grep -rn -i 'gathering' apps/web/src/routes apps/web/src/components apps/mobile/app apps/mobile/components apps/web/e2e --include='*.tsx' --include='*.ts'`
and replace only inside string literals and JSX text — never identifiers
(`api.app.gatherings`, `GatheringSchema`, the `'/gathering/[id]'` pathname
are code). The tab label lives in `AppShell.tsx` (`label: 'Events'`) and
`(tabs)/_layout.tsx` (`title: 'Events'`); page titles are each route's
`head()`. The Playwright specs select by copy — update their strings in the
same sweep.

**URLs (optional).** To make `/rounds` the path:
- Web: `git mv` `_app.gatherings.tsx` → `_app.rounds.tsx` and
  `_app.gatherings_.$id.tsx` → `_app.rounds_.$id.tsx`; change the
  `createFileRoute('/_app/gatherings…')` ids, every `to="/gatherings…"`
  (`AppShell.tsx`, `index.tsx`, `login.tsx`, `auth.callback.tsx`,
  `t.$uid.tsx`, the detail's leave/delete navigations), the `NavItem.to`
  union, and the URL assertions in `shell.spec.ts` / `gatherings.spec.ts`;
  then `cd apps/web && bunx vite build` regenerates `routeTree.gen.ts`.
- Mobile: rename `(tabs)/gatherings.tsx` → `(tabs)/rounds.tsx` and
  `gathering/[id].tsx` → `round/[id].tsx`; update the `Tabs.Screen` name,
  the root `Stack.Screen` name, and every `pathname` / `href` /
  `dismissTo('/gatherings')` / `redirect` string (`index.tsx`, `login.tsx`,
  `(tabs)/merch.tsx`, `t/[uid].tsx`, the detail).

The `/t/<uid>` resolver URL and the `gathering` destination type do not
change: tags already in the field keep working.

**Checkpoint:** `bun run lint && bun run typecheck`, then
`cd apps/web && bunx playwright test`.

## 2. Fields

Worked example: a required `course_name` (the golf fork) — the host fills it
in, rows and the detail header show it, and the resolver summary carries it.
In slice order:

1. **Contract.** `schemas/gathering.ts`: add it to `GatheringSchema`,
   `CreateGatheringInputSchema`, `UpdateGatheringInputSchema`, and — only if
   a tapper should see it before joining — to `GatheringSummarySchema`'s
   `pick`. Add a negative case to `packages/contract/test/schemas.test.ts`.
   The summary crosses the anonymous resolve boundary: never put private
   data in it.
2. **Migration (additive).** New file:
   `alter table public.gatherings add column course_name text not null default '' check (char_length(course_name) <= 120);`
   (the default lets existing rows pass; drop it afterwards if creates must
   supply it). Then `create or replace` BOTH `public.create_gathering` (new
   parameter — the signature changes, so `drop function` the old signature
   and re-issue `revoke … from public` / `grant … to authenticated` for the
   new one) and `public.resolve_tag` (add the column to `v_gathering_json`
   if it is in the summary). Re-issue the whole host column grant:
   `grant update (title, starts_at, location, course_name) on public.gatherings to authenticated;`.
   Then `bun run db:reset && bun run db:seed && bun run db:types` and commit
   `packages/db/src/types/supabase.ts`.
3. **Tests.** `gatherings.test.ts`: `createGathering()` passes the new
   argument; a field with a CHECK gets a rejected-at-the-boundary case. The
   twelve existing tests pass untouched — if one does not, you moved a
   safety mechanism.
4. **Queries / API.** `queries/gatherings.ts` (`GatheringPatch`);
   `routers/app.ts` (`gatheringsCreate` passes the new `p_` argument).
5. **SDK.** If the summary changed, mirror it in
   `packages/nfc-sdk/src/client.ts` `GatheringSummary`.
   `bun run --cwd packages/nfc-sdk typecheck` fails until you do; the vitest
   run would not catch it (type-level assertions).
6. **Screens.** Web: a `field` in the create form and `EditForm`, the row
   `sub` line, the detail header; the resolver line comes from
   `gatheringLine()` in `lib/format-time.ts`. Mobile mirrors in
   `(tabs)/gatherings.tsx`, `gathering/[id].tsx`, `lib/format-time.ts`.
7. **E2E + seed.** `apps/api/e2e/handshake.e2e.ts` §12 creates with the
   field; `apps/web/e2e/gatherings.spec.ts` fills it; `supabase/seed/index.ts`
   seeds it.

Then the verification gate from `docs/the-slice.md`.

## 3. What must not move

The migration's four mechanisms, each re-stated by `gatherings.test.ts`:

a. `private.is_gathering_member` (definer) is how policies read membership.
   Never inline a `gathering_members` subquery into a `gathering_members`
   policy — Postgres recurses forever.
b. The `shares_gathering` disjunct in `profiles_select` is the only bridge;
   every other clause of that policy is byte-identical to the initial schema.
c. `private.on_block_created` evicts the pair-hosted membership in both
   directions.
d. `join_gathering` raises `'gathering not found'` (P0003) for a missing id
   AND a blocked viewer; the two messages stay byte-identical. No insert
   policies: creation and joining are RPCs.

Also: `resolve_tag` degrades a dangling destination, or one whose tag owner
is no longer a member, to the profile card; the `tags_destination_shape`
CHECK keeps its `coalesce(…, false)`; `listMine` stays a bare RLS-scoped
select — no browse, search, or "nearby" surface, ever. A new field that
changes who may see what needs its own RLS test before it ships.

Known edge, kept as inherited: `gathering_members_delete_own` lets a host
leave their own gathering. Their tag then degrades to the profile card while
they still see the gathering as host. Forbid it with `profile_id <> host_id`
in that policy if your fork needs hosts to stay members.

## Scope notes

- Membership is flat: no roles beyond host, no invites, no capacity caps.
  Add those in your fork with the same discipline (every new read path asks:
  what does the blocked party see?).
- Date entry on mobile is two plain fields (`Date`, `Time`) by design — no
  picker dependency. Swap in `@react-native-community/datetimepicker` if the
  vertical wants one; `parseLocalDateTime` in `lib/format-time.ts` is the
  one seam.
```

**Verify:** `ls .agents/skills` shows `customize-gathering`, no `build-gathering`; `grep -rn build-gathering docs README.md .agents` returns only historical mentions, which stay: `skills-roadmap.md` (the original section and the revision), `docs/superpowers/specs/2026-09-22-app-shell-and-tabs-design.md`, `docs/superpowers/program.md`, and this plan.

**Commit**

```bash
git add -A .agents/skills
git commit -m "customize-gathering replaces build-gathering

The gathering is core; the skill now renames nouns and adds fields, and
lists the four mechanisms a fork must not loosen.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: The gate, then the PR

**Step 1:** Full gate from the repo root, stack up:

```bash
bun run db:reset && bun run db:seed
bun run db:types && git diff --exit-code packages/db/src/types/supabase.ts   # no drift since Task 3
bun run lint && bun run typecheck && bun run test
cd apps/web && CI=1 bunx playwright test; cd ../..
cd apps/api && bun run e2e; cd ../..   # needs `bun run dev` for the API in another shell
```

Expected: all green — db at the Task 0 baseline +12, contract 22, Playwright 10, API e2e ending `handshake e2e: all checks passed`. Paste the summary lines into the PR body.

**Step 2:** Push and open the PR against `main`. Title: `Add the gathering to core: Events tab, tap-to-join, the ten RLS tests`.

Body must include: the spec link; the four mechanisms by name with the migration path; the `resolve_tag` payload change (`gathering` key always present) and the member guard as a tightening beyond golf; the M2-minimal `app.tags.{listMine,update}` and how M3 extends them; `app.gatherings.update/remove` added for host edit/delete; the seed change (Ada's demo tag now points at her gathering); the Events-first default (`/gatherings`); the gate output; the simulator screenshots from Task 13. End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

**Step 3:** Request review with `superpowers:requesting-code-review`, then address findings with `superpowers:receiving-code-review`.
