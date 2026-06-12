---
name: build-gathering
description: Use when a withme-starter fork needs a joinable gathering — an event, round, tailgate, table, or meetup that people enter by tapping the host's tag. The flagship extension pattern.
---

# build-gathering — tap a tag, join the gathering

The gathering is the starter's flagship extension: an entity with a host,
members, and a tag destination, so the physical tap becomes the invitation.
This skill was distilled from a real build (a golf fork's "rounds": create
a tee time, point your tag at it, tap to join) that shipped with 10 RLS
tests and a full e2e pass. Substitute your own nouns throughout — this
text uses `gathering`/`member`; the fork used `round`.

**REQUIRED BACKGROUND:** `docs/the-slice.md` (the build order and safety
discipline), and execute `.agents/skills/add-destination-type` thinking
first — the gathering's destination member follows that skill exactly;
this one only adds what's gathering-specific.

Decide before starting: the entity's fields (the fork used `course_name`
+ `tee_time`; yours might be `title` + `location` + `starts_at`), and the
nouns for routes and copy. Safety semantics are NOT yours to redesign:
no enumeration (membership or tag capability are the only ways in),
blocks absolute and invisible, multi-step writes as definer RPCs.

## 1. Migration — the four safety mechanisms

One migration with tables, helpers, policies, RPCs, the destination
branch, and the resolve_tag replacement. The four mechanisms that make it
safe (each was load-bearing in the verified build):

**a. Definer helper against RLS self-recursion.** A members-table policy
cannot reference the members table — Postgres errors with infinite
recursion. Read membership through a `security definer` helper:

```sql
create function private.is_gathering_member(p_gathering uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gathering_members
    where gathering_id = p_gathering and profile_id = p_user
  )
$$;
```

Policies: gathering select = host or `is_gathering_member(id, auth.uid())`;
members select = `is_gathering_member(gathering_id, auth.uid())`; members
delete own row (leaving); host-only update/delete on the gathering. NO
insert policies — creation and joining are RPCs. Every table carries the
tenant seam.

**b. The visibility bridge.** Co-members must see each other's cards (the
gathering IS the introduction context), but profiles are non-enumerable.
Add a `private.shares_gathering(a, b)` definer helper and a new disjunct
inside `profiles_select`'s NOT-blocked branch (drop and recreate the
policy; keep every existing clause byte-identical).

**c. Block eviction.** Extend `private.on_block_created` (create or
replace, restating all attributes): delete memberships where one party
hosts and the other is the blocked member — in BOTH directions. Leave
co-membership in third-party gatherings alone; the profiles block guard
already hides those cards.

**d. Blocked-join = not-found.** `create_gathering(...)` inserts the
entity and the host's membership in one transaction (returns the entity
as jsonb). `join_gathering(p_id)` requires auth + profile, looks up the
gathering, takes `private.lock_pair(user, host)`, and raises `'gathering
not found'` with errcode P0003 for BOTH a missing id and a blocked
viewer — the messages must be byte-identical. Idempotent re-join via
`on conflict do nothing`. Explicit revoke/grant to `authenticated`.

**The destination branch** follows add-destination-type exactly
(`{ type: 'gathering', gathering_id }`, uuid regex, no-extra-keys
subtraction, the NULL-trap `coalesce(…, false)`). Then replace
`resolve_tag`: for a gathering destination, look the entity up; if found,
include a summary; if dangling (deleted after the tag pointed at it),
degrade the destination to `{"type": "profile"}` — the resolver never
breaks. The claimed payload now ALWAYS carries the summary key:

```sql
'gathering', v_gathering_json,   -- a summary object, or null for every other type
```

Anonymous taps get the summary on purpose: holding the tag is the
invitation (capability), same trust model as the profile card.

## 2. Contract

- `schemas/gathering.ts`: the entity schema (id, fields, `host_id`,
  `created_at`), a `…SummarySchema` pick (what an anonymous tap may
  learn), a member schema (`joined_at` + `PublicProfileSchema`), and the
  create-input schema.
- Destination union member in `schemas/destination.ts` + tests (swap the
  unknown-type specimen if you collide with it).
- `ResolveOutputSchema`'s claimed branch gains
  `gathering: GatheringSummarySchema.nullable()` — **non-optional
  nullable**, not `.optional()`: the SDK mirrors this structurally and
  exact type equality is much easier to keep when the key is always
  present.
- App surface: `create`, `get` (entity + members; output note: invisible
  and nonexistent are the same NOT_FOUND), `join`, `leave`, `listMine`.

## 3. Queries, API, SDK

- Queries lean on RLS for scoping: `getRound`-style `maybeSingle()`
  (null = no access = stranger = blocked), member list with card join
  (a member whose profile is hidden from the viewer drops out via
  `flatMap` — absence carries no signal), `listMine` is a bare select
  (RLS already scopes it).
- API handlers stay thin; `get` throws `NOT_FOUND` for a null entity.
  `join`/`create` call the RPCs; `leave` deletes the own-membership row.
- SDK: add the destination member AND the summary type to `client.ts`'s
  structural mirrors (`ApiResolveResult` gains the always-present
  nullable key). The parity test fails `bun run typecheck` if you forget
  — and it must be the typecheck you run; the vitest run erases
  type-level assertions.

## 4. Screens (both platforms, card idiom)

- List + create (`/gatherings`): create form with sensible time pre-fill,
  rows linking to detail. On web, name the detail route with the
  un-nesting underscore (`gatherings_.$id.tsx`) so the list page doesn't
  become a layout route.
- Detail (`/gatherings/$id`): entity header, member rows (Avatar + name +
  card line, "Host" tag on the host), leave for non-host members, and
  "point my tags here" — the owner's column-granted RLS update on their
  own claimed tags, done with the supabase client directly (single-row
  owner CRUD is exactly what table policies are for).
- **Join-on-NOT_FOUND:** a non-member opening the detail gets NOT_FOUND
  from `get` by design. Catch it into a calm "Join this gathering?" card.
  The resolver link carries display-only hints (`?title=…&time=…`) so the
  card isn't blank pre-join — treat them as hints, never as data. After a
  successful join, invalidate into the real detail. A join that itself
  throws NOT_FOUND renders "This gathering isn't available." — calm, no
  drama, no information about why.
- Resolver branch: claimed + gathering destination + non-null summary →
  the host's card with the summary line and a Connect-styled "Join" that
  routes through login when anonymous (mobile mirrors with router params).

## 5. Tests — the negative space is the spec

RLS tests to write (all ten existed in the verified build):

1. Creating makes the host a member.
2. A stranger sees neither the gathering nor its members.
3. Joining admits the user, and co-members can now read each other's
   cards (assert the card was INVISIBLE before the join).
4. Leaving removes gathering visibility and the card bridge.
5. Anon can neither create nor join (`authentication required`).
6. A blocked join is indistinguishable from a missing gathering —
   assert the two error messages are EQUAL, not just both present.
7. Blocking evicts the pair-hosted membership (service-role check) and
   the blocked viewer's select reads empty.
8. A gathering tag resolves to the summary, anonymously.
9. A dangling gathering destination degrades to the profile card
   (destination becomes profile, summary null).
10. Malformed destinations rejected at the DB boundary — include the
    missing-key NULL-trap case.

Contract tests: summary fixture + `gathering: null` added to every
existing claimed-resolve fixture (the key is non-optional). E2E: extend
`apps/api/e2e/handshake.e2e.ts` with create → point tag → anonymous
resolve carries summary → join → member list carries cards → leave →
NOT_FOUND. Then the full verification gate from `docs/the-slice.md`.

## Scope notes

- Membership is flat: no roles beyond host, no invites, no capacity caps.
  Add those in your fork only with the same discipline (every new read
  path asks: what does the blocked party see?).
- Don't add a gatherings *browse* surface. Discovery is the tag — a
  public list would be the enumeration the whole model exists to prevent.
