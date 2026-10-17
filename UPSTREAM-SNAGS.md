# Upstream snags

Places where the starter's README, docs, or skills were missing a step, had
steps out of order, or were unclear, found while building Golf With Me by
following them literally. Each entry says what the docs said, what happened,
and what this fork did instead. This list goes upstream to withme-starter;
nothing here was fixed in the starter from inside this fork.

## Step 0: fork and run the demo

1. **A fork inherits `project_id = "withme-starter"`, so it reuses another
   checkout's database.** `supabase/config.toml` names the local stack after
   the starter. On a machine that has run the starter before, the fork's
   `bun run db:start` printed "Starting database from backup..." and came up
   on the old checkout's Docker volume, seven migrations behind
   (`supabase migration list --local`). Nothing in the quickstart says to
   rename `project_id` or to run `db:reset` first, and `db:seed` would have
   seeded the stale schema without complaint. Two checkouts with the same
   `project_id` also can't run side by side even on different ports (the
   container names collide). *Did instead:* `bun run db:reset` before
   `db:seed`. Suggest: quickstart says `bun run db:reset` on a fresh clone
   when the CLI says "from backup", and `make-it-yours` renames `project_id`.

2. **Step 0's "the verification gate is green" fails without the
   service-role key.** `docs/run-with-me.md` step 0 and the README say the
   gate is green on a fresh clone, but `bun run test` fails 93 of 107 RLS
   tests until `SUPABASE_SERVICE_ROLE_KEY` is exported. The error message
   names the fix, and `docs/local-development.md#the-service-role-key` has
   the `eval` line, but neither the README quickstart nor step 0 mentions
   it. *Did instead:* ran the `eval` from local-development.md, then the
   gate (all green).

3. **"Fork the repo" has no path for a private app repo.** GitHub won't
   fork a repo into the org that owns it, and a fork of a public repo
   can't be made private. Step 0 and `docs/staying-current.md` cover the
   Fork button and "Use this template" only. *Did instead:* `git clone` the
   starter, `gh repo create <org>/<app> --private`,
   `git remote rename origin upstream`, `git remote add origin <new repo>`,
   `git push -u origin main`. History is shared, so the plain-merge routine
   in staying-current.md works unchanged. Suggest: a three-line "private
   repo" variant in step 0.

## Step 1: `design-direction`

4. **The artwork commands in §3 don't match what `make-it-yours` step 8
   consumes.** design-direction §3 says to draw `icon.svg` and
   `android-icon-foreground.svg`, render PNGs with its own
   `rsvg-convert`/`magick` lines, and keep them outside `apps/`. But
   make-it-yours step 8 renders every icon through the starter's
   `docs/brand/render.sh`, which wants `docs/brand/icon.svg` **and
   `docs/brand/icon-dark.svg`** (for the dark splash), each with an exact
   `viewBox="0 0 1024 1024"` and exactly one background `<rect .../>` alone
   on its line; it makes the Android foreground itself. design-direction
   never mentions `render.sh`, `icon-dark.svg`, or that `docs/brand/`
   already holds the starter's sources, and the sheet template's "Source
   files live at `docs/brand/`" invites overwriting them a step early (I
   did, then restored them). *Did instead:* drew `icon.svg` and
   `icon-dark.svg` in render.sh's layout, held them outside the repo until
   make-it-yours step 8, and used the skill's commands only to check the
   safe zone and `hasAlpha: no`. Suggest: §3 produces the two render.sh
   sources and points at the script.

5. **The accent rule is worded two ways.** The `tokens.css` header and its
   accent comment say the accent is "reserved for the handshake pair
   (Connect and Accept)"; the skill (and app.css's `.btn--connect`
   placement on Join and Claim) say it goes on a screen's primary action.
   Minor, but the brief tells `/design` to read `tokens.css`. *Did
   instead:* followed the skill (primary action only).

6. **`gh` targets the starter once an `upstream` remote exists.** With the
   remotes step 0 recommends, `gh pr create` resolved the base repository
   to `upstream` (withme-starter) and failed with "No commits between main
   and …". *Did instead:* `gh repo set-default <org>/<app>`. Suggest: add
   that line next to `git remote add upstream` in step 0 and
   staying-current.md.

## Step 2: `make-it-yours`

7. **Mobile has no type scale to adjust, though step 1 says it does.**
   Step 1 says the non-color tokens "(type scale, radii, spacing, fonts)
   also exist in both files", but `apps/mobile/lib/tokens.ts` has `fonts`,
   `radius` and `space` only; display sizes are literals in `ui.tsx`,
   `Header.tsx`, `(tabs)/gatherings.tsx` and `gathering/[id].tsx`. A display
   face with a small x-height (Caveat here) needs its sizes raised. On web
   that is a token change (`--text-title` and `--text-lg` are used only by
   display text); on mobile it is a code change in four files. *Did
   instead:* raised `--text-title` 2rem→2.5rem and `--text-lg`
   1.25rem→1.5rem, added `displaySize` to `tokens.ts` mirroring them, and
   pointed the four mobile call sites at it. Suggest: ship `displaySize`
   (or a full type scale) in the starter's `tokens.ts`, and have
   design-direction ask whether the display face needs a size adjustment.

8. **Step 1's checkpoint can't pass until step 8.** The old-accent grep
   over `apps/` matches `apps/web/public/favicon.svg`, which carries the
   old tokens and is only rewritten in step 8. *Did instead:* went on and
   re-ran the grep after step 8 (clean). Suggest: exclude `favicon.svg` in
   step 1's grep, or move the favicon to step 1.

9. **Private vulnerability reporting isn't available on a private repo.**
   Step 8 says to turn it on in Settings → Code security; GitHub offers it
   only on public repositories (`PUT /repos/{repo}/private-vulnerability-reporting`
   returns 404 here). The issue template's advisory link 404s until then.
   *Did instead:* wrote SECURITY.md and the issue template for this repo's
   private reporting, to be switched on when the repo goes public. Suggest:
   say so in step 8, with a security email as the private-repo option.

10. **The final sweep has no story for a fork in the starter's own org.**
    It allows only the README badge line for a same-org fork, but step 8's
    own contact-point rewrites put `github.com/vibe-with-me/<fork>` into
    `.github/ISSUE_TEMPLATE/*`, `PULL_REQUEST_TEMPLATE.md` and
    `CONTRIBUTING.md`, and a fork whose reviewer is the starter's
    maintainer keeps `@alex-eisele` in CODEOWNERS. All of them print.
    *Did instead:* read each remaining line and kept the deliberate ones.
    Suggest: a same-org filter on `github.com/vibe-with-me/<your-repo>/`
    for every file, not only the README.

11. **render.sh rasterizes `<text>` with whatever fonts the machine has.**
    A wordmark or letter mark in the brand's display face renders in a
    fallback unless it is outlined to paths first. Step 8 doesn't say so,
    and `social-preview.svg` ships as `<text>`. *Did instead:* outlined
    the Caveat "g" and the social-preview wordmark to paths (opentype.js on
    the `@fontsource/caveat` woff). Suggest: one line in step 8.

12. **Step 5's `eas init` lands on the wrong account when the login has
    more than one.** Step 5 says to delete `expo.owner` and run `eas init`
    "logged in as the fork owner". An Expo login that owns a personal
    account and an org gets the personal one: `eas init` (non-interactive)
    created `@expovibes/golfwithme` instead of `@vibe-with-me/golfwithme`.
    It also wrote a duplicated `android.permissions: [NFC, NFC]` block into
    `app.json`, and `update:configure` added `channel`s to `eas.json`,
    neither of which the skill mentions. *Did instead:* set `expo.owner` to
    the org, deleted only `extra.eas.projectId` and `updates.url`, re-ran
    `eas init` (it created `@vibe-with-me/golfwithme`), removed the
    duplicated permissions, and kept the channels. The stray
    `@expovibes/golfwithme` project is left for the owner to delete.
    Suggest: step 5 sets `owner` to the fork's Expo account instead of
    deleting it.

13. **The RLS suite leaves its fixtures in the dev database.** After
    `bun run test`, the demo's Events feed lists "Tee time", "Open house"
    and a stack of "Rooftop listening session" rows hosted by test users
    (Alice, Host). Running the gate means the next visual check runs on a
    noisy feed. *Did instead:* `bun run db:reset && bun run db:seed` before
    each visual check. Suggest: say so where the skills end with "gate,
    then the visual check".

## Step 3: `customize-gathering`

14. **Relabelled form fields slip past §1's sweeps.** §1 lists the vertical
    labels to rewrite ("Location (optional)", "Starts", "Time") but its
    Playwright guidance only greps for "gathering", "Events" and
    `getByLabel(` ambiguity. `gatherings.spec.ts` fills
    `getByLabel('Location (optional)')`, so a relabel times the spec out
    after 90s. *Did instead:* updated the selector. Suggest: "for every
    label you change, `grep -rn \"getByLabel('<old label>')\" apps/web/e2e`".

15. **The Playwright smoke needs the service-role key too**, the same as
    snag 2: `bunx playwright test` finds no tests until
    `SUPABASE_SERVICE_ROLE_KEY` is exported. §1's checkpoint doesn't say so.

16. **§2 never says which `create_gathering` body to copy, and the old one
    drops the abuse limits.** For `resolve_tag` the skill says to copy the
    *newest* definition and gives the grep. For `create_gathering` it only
    says "restating every attribute of the original". The newest body is
    in `20261016120000_abuse_limits_and_erasure.sql` (per-host ledger, 5 an
    hour, 20 upcoming), so copying the one in the gatherings migration
    silently removes both limits. The `gathering limits` tests would catch
    it, but only because they now pass `p_course_name`. *Did instead:*
    copied the newest body. Suggest: the same `grep -lE … | sort | tail -1`
    line for `create_gathering`.

17. **The worked example skips the plain-text rule.** Since
    `20261015140100_link_and_text_validation.sql`, every gathering text
    column has a `private.is_plain_text` CHECK and the contract has a
    matching `.refine(plain, PLAIN_TEXT_MESSAGE)`. §2's example column and
    schema have neither, so a forker's new field takes bidi and invisible
    characters that `title` refuses. *Did instead:* added
    `gatherings_course_name_plain` and the refine, plus the spoof cases in
    `plain-text.test.ts` and `schemas.test.ts`.

18. **§2's caller map and anon-test note are stale.** It says core's
    callers are "the two db test files". There are five
    (`plain-text`, `blocks`, `links`, `gatherings` ×5, `account` ×2), and
    every one fails with PGRST202 until it passes the new argument. It also
    says the anon assertion `toContain('authentication required')` must
    become `code 42501`; core already asserts
    `'permission denied for function create_gathering'`. *Did instead:* ran
    the skill's own caller grep and followed it, not the prose.

19. **Required on create still allows a blank course over PostgREST.** The
    example keeps `default ''` and relies on the contract's `min(1)`, but
    the RPC is callable directly with the publishable key, the way the
    abuse-limit tests call it. *Did instead:* `create_gathering` raises
    22023 on a blank course, with a test (blank → 22023, 81 chars → 23514,
    80 → ok). Suggest: the worked example does the same.

20. **`db:types` rewrites the whole generated file.** CLI 2.120.0 emits
    `packages/db/src/types/supabase.ts` unformatted (one line per object),
    so a one-column change is an 826-line diff, and every later starter
    change to that file will conflict in a fork. The skill calls it
    harmless, which is true for the build but not for staying current.
    Suggest: commit the file in the generator's own format upstream, or
    add a formatter step to `db:types`.

21. **The URL rename has no story for a fork with live users.** §1 moves
    `/gatherings/$id` to `/rounds/$id` (and mobile's `gathering/[id]` to
    `round/[id]`) with no redirect, so links already shared break. Fine for
    this fork (never deployed; tags encode `/t/{UID}`), but CodeRabbit
    flagged it twice. Suggest: one line saying a fork with users adds a
    compatibility route or a redirect.

22. **Starter bug: `gatheringHref` can throw on an emoji.** In
    `apps/mobile/lib/gathering-link.ts` the title hint is cut with
    `.slice(0, 60)` (UTF-16 units); an emoji across the cut leaves a lone
    surrogate and `encodeURIComponent` throws `URIError`, so Join/Connect
    navigation fails for that title. Found by CodeRabbit on this fork.
    *Did instead:* `Array.from(cleaned).slice(0, 60).join('')`.

## Step 4: `extend-profile`

23. **The golf example's "phone, connections only" is already Links.** The
    README's idea table and run-with-me's Variations list golf's
    connections-tier field as `phone`, and the brief for this run came from
    that. But extend-profile says "Check Links first", and Profile → Links
    already ships a `phone` platform, connections-only. *Did instead:* no
    `profile_details` table; the card-only path, with Ada's seed carrying a
    phone Link. Suggest: change golf's connections column in both tables to
    "phone (a Link)" or pick a non-link example.

24. **§1's red count and §9's counts are stale.** §1 says four contract
    tests fail on the new required-nullable keys; seven do now (the
    gathering list item, the links connection card and the plain-text card
    fixtures were added since). §9 says golf's API e2e adds seven lines; the
    card-only surfaces it lists (update, get, resolve, pending request,
    accept, a connection) are six.

25. **The map misses the blocked-user placeholder card.** `listBlocks` in
    `packages/db/src/queries/handshake.ts` builds a stand-in `ProfileCard`
    (`BLOCKED_USER_NAME`) when the block hides the card, and
    `blocks.test.ts` asserts it. Adding fields to `ProfileCard` makes both
    fail typecheck. *Did instead:* added the fields as null in both.

26. **`CardLineSchema` and the example CHECK skip the plain-text rule**, the
    same gap as snag 17: `display_name` and `bio` refuse bidi and invisible
    characters at both layers, the skill's card line doesn't. *Did
    instead:* `.refine(isPlainText)` in the contract and
    `profiles_home_course_plain` in SQL, with a test.

27. **Two mobile behaviours CodeRabbit flags as Major in every fork.** The
    mobile completion gate checks once per tabs mount (by the skill's
    design, so an incomplete user can tab away from Profile), and the
    starter's mobile Profile screen loads once on mount, so a value changed
    on another client is overwritten by the next save from a screen left
    open. Neither is new in this fork; both were declined on PR #5 with
    that reason. Suggest: decide upstream (re-check the gate on focus;
    reload Profile with `useFocusEffect`) so forks stop re-litigating them.

## Starter sync: #67, #69, #70, #71 into the fork

Followed `docs/staying-current.md` "Taking an update" literally. It worked:
six conflicts, all in the table's predicted places (tokens, the wordmark,
README, a screen the fork extended), git followed the renamed round screens
on its own, no migrations arrived, and the new prettier step in `db:types`
left `supabase.ts` differing from upstream only by the fork's columns.

28. **A new starter test can encode a path the fork renamed, with no
    conflict to warn you.** `apps/mobile/lib/gathering-link.test.ts`
    (#70/#71) asserts `/gathering/g1…`; after customize-gathering's URL step
    the fork builds `/round/…`, so the merge is clean and `bun run test`
    fails. *Did instead:* changed the test's paths to `/round/` and added a
    course-hint case. Suggest: list the test beside `lib/gathering-link.ts`
    in customize-gathering's URL step, and in staying-current's conflict
    table ("route files and nouns") note that tests can carry the old path.

29. **Merging the starter's displaySize means deleting your own.** A fork
    that followed snag 7's workaround has its own `displaySize` export in
    `tokens.ts`; the starter's lands elsewhere in the file without a
    conflict, so the file briefly has two (`tsc` catches it). Minor, and
    only for forks that predate the fix.

30. **A sync PR must not be squash-merged, and the doc doesn't say so.**
    staying-current says "merge it through a PR so CI runs" but not *how*.
    A fork that squash-merges every PR (as this one does, and as the
    starter itself does) loses the merge commit's upstream parent: the
    starter's commits never become ancestors of `main`, so the next sync
    finds the old merge base and re-raises every conflict already resolved.
    *Did instead:* asked the owner to merge the sync PR with a merge commit
    (enable "Allow merge commits" for it, or merge locally and push).
    Suggest: a line in step 6 ("merge, don't squash, the sync PR; check
    with `git merge-base --is-ancestor upstream/main main` afterwards").

31. **extend-profile leaves the card tier off every list of people.** §6–§7
    say the Requests and Blocked rows (and a round's member list) "may"
    show the card-tier field, and the worked example passes only the
    connections tier to the Connections row. A literal run therefore shows
    a card field on the tapped card and nowhere else: Ada sees Lin's request
    without Lin's handicap, the one moment a golfer wants it. The owner
    noticed it in review. *Did instead:* web `PersonRow` prints `golfLine`
    itself; mobile `PersonRow` gains the skill's own `detail` prop, passed
    from Requests, Connections, Blocked and Who's playing; a Playwright
    check on the Connections row. Suggest: make it the default ("the card
    tier rides every card, so every row of people shows it"), not optional.
