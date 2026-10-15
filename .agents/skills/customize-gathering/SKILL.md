---
name: customize-gathering
description: Use when a withme-starter fork wants its gathering to speak the vertical's language — rename the user-facing nouns (round, tailgate, table, meetup), add fields (course, venue, capacity), or adjust the create form — without touching the safety semantics that ship in core.
---

# customize-gathering — make the core gathering yours

The gathering ships in the starter: a host creates one, everyone signed in
to the domain sees it in the Events tab ("Happening": title, time, place, a
headcount), and a tap on a member's tag is still the invitation. Who's
going is connections-only: a member list carries the viewer's own row and
their accepted connections' rows, never a stranger's card. It was the one
feature every derivation built by hand (golf-with-me "rounds" first; every
vertical since wants the same entity), so it is core code now and this
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
| Migration | `supabase/migrations/20261008120000_add_gatherings.sql`, then `20261014220000_gatherings_domain_wide.sql` (the listing, the connections-only member policy, the headcount) |
| RLS tests | `packages/db/test/gatherings.test.ts` (20) |
| Queries / API | `packages/db/src/queries/gatherings.ts`, `queries/tags.ts`; `apps/api/src/routers/app.ts` |
| SDK mirror | `packages/nfc-sdk/src/client.ts` (`Destination`, `GatheringSummary`) |
| Web | `apps/web/src/routes/_app.gatherings.tsx`, `_app.gatherings_.$id.tsx`, the branch in `t.$uid.tsx`, `lib/format-time.ts`, `lib/going.ts` ("N going", "With …"), `components/AppShell.tsx` (`navItems[0]`) |
| Mobile | `apps/mobile/app/(tabs)/gatherings.tsx`, `app/gathering/[id].tsx`, the branch in `app/t/[uid].tsx`, `lib/format-time.ts`, `lib/going.ts`, `lib/gathering-link.ts`, `(tabs)/_layout.tsx` |
| E2E | `apps/api/e2e/handshake.e2e.ts` §12–17; `apps/web/e2e/gatherings.spec.ts` |
| Seed | `supabase/seed/index.ts` (Ada hosts one, her live tag points at it; Lin hosts one Ada has not joined, so the feed shows) |

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
`head()` (the list's is `'Events — withme'`). The Playwright specs select by
copy, including the tab label (`'Events'` in `shell.spec.ts` and
`gatherings.spec.ts`), so update their strings in the same sweep.

**URLs (optional).** To make `/rounds` the path:
- Web: `git mv` `_app.gatherings.tsx` → `_app.rounds.tsx` and
  `_app.gatherings_.$id.tsx` → `_app.rounds_.$id.tsx`; change the
  `createFileRoute('/_app/gatherings…')` ids, every `to="/gatherings…"`
  (`AppShell.tsx`, `index.tsx`, `login.tsx`, `auth.callback.tsx`,
  `t.$uid.tsx`, the list's row link, the detail's leave/delete
  navigations), the `startsWith('/gatherings/')` check behind the login
  page's invitation line, the `NavItem.to` union, and the URL assertions in
  `shell.spec.ts` / `gatherings.spec.ts`;
  then `cd apps/web && bunx vite build` regenerates `routeTree.gen.ts`.
- Mobile: rename `(tabs)/gatherings.tsx` → `(tabs)/rounds.tsx` and
  `gathering/[id].tsx` → `round/[id].tsx`; update the `Tabs.Screen` name,
  the root `Stack.Screen` name, and every `pathname` / `href` /
  `dismissTo('/gatherings')` / `redirect` string (`index.tsx`, `login.tsx`,
  `(tabs)/merch.tsx`, `t/[uid].tsx`, the detail), the
  `startsWith('/gathering/')` check behind the login screen's invitation
  line, and the `/gathering/` prefix that `gatheringHref` in
  `lib/gathering-link.ts` builds for redirects.

The API's REST paths (`/gatherings…` in `packages/contract/src/contract/app.ts`)
are internal identifiers: leave them.

The `/t/<uid>` resolver URL and the `gathering` destination type do not
change: tags already in the field keep working.

**Checkpoint:** `bun run lint && bun run typecheck`, then
`cd apps/web && bunx playwright test`.

## 2. Fields

Worked example: a required `course_name` (the golf fork) — the host fills it
in, rows and the detail header show it, and the resolver summary carries it.
In slice order:

1. **Contract.** `schemas/gathering.ts`: add it to `GatheringSchema`,
   `CreateGatheringInputSchema`, `UpdateGatheringInputSchema` (and its
   `.refine`, which requires at least one field to update), and — only if a
   tapper should see it before joining — to `GatheringSummarySchema`'s
   `pick`. Add a negative case to `packages/contract/test/schemas.test.ts`.
   The summary crosses the anonymous resolve boundary: never put private
   data in it.
2. **Migration (additive).** New file:
   `alter table public.gatherings add column course_name text not null default '' check (char_length(course_name) <= 120);`
   (the default lets existing rows pass; drop it afterwards if creates must
   supply it). Then rebuild `public.create_gathering`. The signature
   changes, and `create or replace function` cannot change one: run
   `drop function public.create_gathering(text, timestamptz, text);`
   then
   `create function public.create_gathering(p_title text, p_starts_at timestamptz, p_course_name text, p_location text default null)`
   with `p_course_name` BEFORE `p_location` (Postgres refuses a required
   parameter after a defaulted one), restating every attribute of the
   original: `returns jsonb language plpgsql volatile security definer set search_path = ''`.
   Insert the column, add it to the `jsonb_build_object` the function
   returns (the API validates that object against `GatheringSchema`), and
   re-issue the grants for the new signature:
   `revoke execute on function public.create_gathering(text, timestamptz, text, text) from public, anon;`
   `grant execute on function public.create_gathering(text, timestamptz, text, text) to authenticated;`.
   If the summary carries the field, also
   `create or replace function public.resolve_tag(p_uid text) returns jsonb`
   (copy the whole body of its **newest** definition,
   `grep -lE 'create (or replace )?function public\.resolve_tag' supabase/migrations/*.sql | sort | tail -1`,
   not the gatherings migration's: the older bodies emit `avatar_url`, a
   column the avatars migration dropped, and miss any card field a later
   migration added, such as extend-profile's. Add the field to
   `v_gathering_json`, and restate every attribute:
   `language plpgsql stable security definer set search_path = ''`; the
   same signature keeps its existing grants). Re-issue the whole host column grant:
   `grant update (title, starts_at, location, course_name) on public.gatherings to authenticated;`.
   Then `bun run db:reset && bun run db:seed && bun run db:types` and commit
   `packages/db/src/types/supabase.ts`.
3. **Tests.** `gatherings.test.ts`: `createGathering()` passes the new
   argument; a field with a CHECK gets a rejected-at-the-boundary case. The
   twenty existing tests pass untouched — if one does not, you moved a
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

The four mechanisms of `20261014220000_gatherings_domain_wide.sql`, each
re-stated by `gatherings.test.ts`:

a. `gatherings_select` admits every signed-in user of the tenant, minus a
   block **either way** with the host. A viewer the host blocked, and a
   viewer who blocked the host, read the gathering as nonexistent. Never
   add a clause that reads `gathering_members` here: `gathering_members`'s
   own policy reads `gatherings`, and Postgres would recurse forever.
b. `gathering_members_select` admits the viewer's own row and their
   accepted connections' rows, on a gathering the viewer can see — the
   host included. Co-membership never reveals a card: `profiles_select` is
   byte-identical to the initial schema, and there is no `shares_gathering`.
   Hosting must not become a way to collect strangers' cards.
c. `public.gathering_member_counts` is the headcount: a definer read whose
   `where` re-states (a), so a hidden gathering has no count. Any new
   definer read over `gathering_members` restates (a) the same way.
d. `join_gathering` raises `'gathering not found'` (P0003) for a missing id
   AND a blocked viewer; the two messages stay byte-identical. No insert
   policies: creation and joining are RPCs. `private.on_block_created`
   evicts the pair-hosted membership in both directions.

Also: `resolve_tag` degrades a dangling destination, or one whose tag owner
is no longer a member, to the profile card, and so does a tap by a viewer
the host has blocked, whoever owns the tag (`private.is_gathering_member`
serves the resolver; keep it); the `tags_destination_shape` CHECK keeps
its `coalesce(…, false)`; `list` and `listMine` stay bare RLS-scoped
selects in start-time order — no search, ranking, "nearby", or any list
of people, ever; a host cannot leave their own gathering
(`gathering_members_delete_own` excludes the host's row; deleting the
gathering is how a host leaves). A new field that changes who may see what
needs its own RLS test before it ships.

A listed gathering exposes its `host_id` to the tenant. That is not a
card; what it allows is one consent-gated `send_connect_request`. If your
vertical wants private gatherings, add a `visibility` column
(`'listed' | 'invite_only'`, default `'listed'`), one `or visibility =
'listed'` clause beside the host test in (a) and (c), and an RLS test that
a stranger does not read an invite-only one.

One known edge, kept on purpose:

`join_gathering` refuses a joiner the host has blocked, not a joiner who
has blocked the host: a block protects the blocker, who may still attend.
The host never sees that member's card (the profiles block guard hides it,
and the member list drops hidden cards). To refuse both directions, test
`private.is_blocked(v_gathering.host_id, v_user)` as well, with the same
`'gathering not found'` message, and add an RLS test for it.

## Scope notes

- Membership is flat: no roles beyond host, no invites, no capacity caps.
  Add those in your fork with the same discipline (every new read path asks:
  what does the blocked party see?).
- "Happening" is the domain in start-time order. Nearby sorting would need
  a location model the starter does not have (location is free text); a
  fork that adds one keeps the list a bare select — nothing ranks.
- Date entry on mobile is two plain fields (`Date`, `Time`) by design — no
  picker dependency. Swap in `@react-native-community/datetimepicker` if the
  vertical wants one; `parseLocalDateTime` in `lib/format-time.ts` is the
  one seam.
