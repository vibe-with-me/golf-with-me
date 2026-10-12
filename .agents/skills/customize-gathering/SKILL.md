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
| RLS tests | `packages/db/test/gatherings.test.ts` (17); `account.test.ts` also creates gatherings |
| Queries / API | `packages/db/src/queries/gatherings.ts`, `queries/tags.ts`; `apps/api/src/routers/app.ts` |
| SDK mirror | `packages/nfc-sdk/src/client.ts` (`Destination`, `GatheringSummary`) |
| Web | `apps/web/src/routes/_app.gatherings.tsx`, `_app.gatherings_.$id.tsx`, the branch in `t.$uid.tsx`, `lib/format-time.ts`, `lib/my-tags.ts`, `components/AppShell.tsx` (`navItems[0]`) |
| Mobile | `apps/mobile/app/(tabs)/gatherings.tsx`, `app/gathering/[id].tsx`, the branch in `app/t/[uid].tsx`, `lib/format-time.ts`, `lib/my-tags.ts`, `lib/gathering-link.ts`, `(tabs)/_layout.tsx` |
| E2E | `apps/api/e2e/handshake.e2e.ts` §12–17; `apps/web/e2e/gatherings.spec.ts`; `profile.spec.ts` and `helpers.ts` also visit or create one |
| Seed | `supabase/seed/index.ts` (Ada hosts one; her live tag points at it) |

Every caller of the create RPC, whichever layer it sits in (a new
argument must reach all of them):

```sh
grep -rn --exclude-dir={node_modules,dist,.turbo,.expo,.wrangler} \
  'create_gathering\|gatherings\.create' packages apps supabase/seed
```

In core that prints the two db test files, the API handler, both create
screens, the API e2e (§12 and §17), the seed, and the generated
`packages/db/src/types/supabase.ts` (rewritten by `db:types`).

## 1. Nouns

Decide the singular/plural ("round"/"rounds"), the tab label (the starter
says "Events"), and the URL segment (`/rounds`).

**Copy.** The user-facing word is "gathering" everywhere except the tab
label. Sweep with
`grep -rn -i 'gathering' apps/web/src apps/web/e2e apps/mobile/app apps/mobile/components apps/mobile/lib --include='*.tsx' --include='*.ts' | grep -v routeTree.gen.ts`
and replace only inside string literals and JSX text — never identifiers
(`api.app.gatherings`, `GatheringSchema`, the `'/gathering/[id]'` pathname
are code). Most hits are identifiers and comments; the copy is in the
routes, the components, and both apps' `lib/my-tags.ts` (the Profile
tab's My tags lines, e.g. "A tap invites people to a gathering.").
The tab label lives in `AppShell.tsx` (`label: 'Events'`) and
`(tabs)/_layout.tsx` (`title: 'Events'`); page titles are each route's
`head()` (the list's is `'Events — <wordmark>'`, `'Events — withme'`
before make-it-yours; the detail's `'Gathering — <wordmark>'`). The
Playwright files select by copy, including the tab label, so update their
strings in the same sweep: every file under `apps/web/e2e`, the shared
`helpers.ts` included, not only `shell.spec.ts` and `gatherings.spec.ts`
(`profile.spec.ts` clicks "Create gathering").
`grep -rn 'Events' apps/web/src apps/web/e2e apps/mobile/app` lists every
use of the tab label.

**URLs (optional).** To make `/rounds` the path:
- Web: `git mv` `_app.gatherings.tsx` → `_app.rounds.tsx` and
  `_app.gatherings_.$id.tsx` → `_app.rounds_.$id.tsx`; change the
  `createFileRoute('/_app/gatherings…')` ids, every `to="/gatherings…"`
  (`AppShell.tsx`, `index.tsx`, `login.tsx`, `auth.callback.tsx`,
  `t.$uid.tsx`, the list's row link, the detail's leave/delete
  navigations), the `startsWith('/gatherings/')` check behind the login
  page's invitation line, the `NavItem.to` union, and every URL in the
  Playwright files — `grep -rn '/gatherings' apps/web/e2e` (the
  `shell.spec.ts` and `gatherings.spec.ts` assertions, `profile.spec.ts`'s
  `goto`, and the `waitForURL` in `helpers.ts`'s `signUpWithProfile`,
  which other specs share);
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
   `CreateGatheringInputSchema`, `UpdateGatheringInputSchema` (optional
   there, and in its `.refine`, which requires at least one field to
   update), and — only if a tapper should see it before joining — to
   `GatheringSummarySchema`'s `pick`. "Required" binds the inputs, not
   the outputs: the inputs take `z.string().trim().min(1).max(120)`
   (`.optional()` on the update), while `GatheringSchema` takes
   `z.string().max(120)` with no `min`, because the migration's
   `default ''` (step 2) gives every row that predates the column `''`,
   and the API validates what it returns against `GatheringSchema`.
   Screens show nothing for `''`.
   In `packages/contract/test/schemas.test.ts`, add a negative case
   (missing, blank, oversized), and add the field to the existing
   fixtures and expectations that build a whole gathering, a summary, or a
   create input — a required key breaks them. `grep -n starts_at
   packages/contract/test/schemas.test.ts` finds them (in core: the
   resolve output's `gathering`, the `gathering` fixture, the summary-keys
   list, and the create-trim `toEqual`).
   The summary crosses the anonymous resolve boundary: never put private
   data in it.
2. **Migration (additive).** New file:
   `alter table public.gatherings add column course_name text not null default '' check (char_length(course_name) <= 120);`
   Keep the default: it lets existing rows pass, `create_gathering`
   always supplies the value, and the contract requires it on every
   create and edit (step 1). Then rebuild `public.create_gathering`. The signature
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
   Revoke from `anon` by name: Supabase's default privileges grant `anon`
   execute on every new function directly, so a revoke from `public`
   alone leaves it callable by anon (core's own older RPCs have the same
   gap, tracked as ENG-754; the body's `'authentication required'` still
   refuses, but the grant should say so too).
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
   Before seeding, give the seed the new argument:
   `supabase/seed/index.ts` calls `create_gathering` by named arguments,
   so add `p_course_name: '…'` there now (without it the seed fails with
   `PGRST202 Could not find the function public.create_gathering(…)`).
   Then `bun run db:reset && bun run db:seed && bun run db:types` and commit
   `packages/db/src/types/supabase.ts`.
3. **Tests.** Every db test that calls the RPC passes the new argument —
   the caller grep under the map lists them. In core:
   `gatherings.test.ts`'s `createGathering()` helper; the anon call in
   its 'anon can neither create nor join' (PostgREST resolves a function
   by its named arguments, so without the new one it answers PGRST202
   instead of reaching the body's `'authentication required'`); and
   `account.test.ts`'s two calls. A field with a CHECK gets a
   rejected-at-the-boundary case (create and host edit, with a positive
   control). Adding an assertion for the new field to an existing test
   (e.g. the anonymous resolve summary) is fine. Beyond the new argument,
   the seventeen existing tests pass untouched — if one does not, you
   moved a safety mechanism.
4. **Queries / API.** `queries/gatherings.ts` (`GatheringPatch`);
   `routers/app.ts` (`gatheringsCreate` passes the new `p_` argument).
5. **SDK.** If the summary changed, mirror it in
   `packages/nfc-sdk/src/client.ts` `GatheringSummary`.
   `bun run --cwd packages/nfc-sdk typecheck` fails until you do; the vitest
   run would not catch it (type-level assertions). Then run the root
   `bun run typecheck`, not only the package's: the API e2e imports the
   built `@withme/nfc/client`, and the root task's `^build` rebuilds it
   (until then the e2e sees the old `GatheringSummary`).
6. **Screens.** Web: a `field` in the create form and `EditForm`, the row
   `sub` line, the detail header; the resolver line comes from
   `gatheringLine()` in `lib/format-time.ts`. Mobile mirrors in
   `(tabs)/gatherings.tsx`, `gathering/[id].tsx` (or the files you renamed
   in §1), `lib/format-time.ts`.
7. **E2E.** `apps/api/e2e/handshake.e2e.ts`: every
   `gatherings.create` the caller grep lists (§12 and §17 in core) passes
   the field, and §12 asserts it on the created gathering and on the
   anonymous summary. In `apps/web/e2e`, a required field needs a fill in
   every Playwright step that creates a gathering, or the create fails:
   `grep -rn "getByLabel('Title')" apps/web/e2e` finds them
   (`gatherings.spec.ts` and `profile.spec.ts` in core). The seed was
   done in step 2.

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
is no longer a member, to the profile card, and so does a tap by a viewer
the host has blocked, whoever owns the tag; the `tags_destination_shape`
CHECK keeps its `coalesce(…, false)`; `listMine` stays a bare RLS-scoped
select — no browse, search, or "nearby" surface, ever; a host cannot leave
their own gathering (`gathering_members_delete_own` excludes the host's row;
deleting the gathering is how a host leaves). A new field that changes who
may see what needs its own RLS test before it ships.

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
- Date entry on mobile is two plain fields (`Date`, `Time`) by design — no
  picker dependency. Swap in `@react-native-community/datetimepicker` if the
  vertical wants one; `parseLocalDateTime` in `lib/format-time.ts` is the
  one seam.
