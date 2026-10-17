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
