---
name: make-it-yours
description: Use when rebranding a withme-starter fork or pointing it at a new vertical — new name, colors, fonts, app identity, or store/EAS ownership. Configuration only; no feature changes.
---

# make-it-yours — rebrand the fork through its dormant seams

The starter was built so a rebrand is a token swap, not a redesign. Every
brand-bearing value sits behind a seam this skill walks: design tokens
(web + mobile in lockstep), self-hosted fonts, the wordmark and copy, app
identity, and deploy names. Nothing here scaffolds features — if you came
to add functionality, see `docs/the-slice.md` and the other skills.

**REQUIRED BACKGROUND:** the safety discipline in `docs/the-slice.md`. A rebrand moves no boundary: if a copy or config change seems to need a policy, an RPC, or a new card field, stop, because that is another skill's work.

Execution rules for the whole skill:

- **Never rename the `@withme/*` workspace packages** or their imports
  (`@withme/contract`, `@withme/db`, `@withme/nfc`, …). They are internal
  infrastructure, invisible to users; renaming them breaks every import
  for zero brand value.
- Steps 1–7 are independent of each other. Skip any seam you're keeping.
- Run the final checkpoint (step 8) once at the end regardless.

## Inputs to collect before you start

- Brand name in two forms: the lowercase **wordmark** (e.g. `acme`) —
  used wherever the brand renders as a mark (headings, page titles,
  slugs, user-agent strings) — and the **display name** (e.g. `Acme`) —
  used in prose sentences (the app's display name, permission strings,
  README prose).
- Accent color for light and dark mode, each with an on-accent ink color.
  Required contrast (WCAG AA): accent vs. accent-ink ≥ 4.5:1 in both
  modes — verify with any WCAG contrast checker before editing. If the
  user has only one accent, derive the dark variant by lightening until
  contrast holds against dark surfaces.
- Optional: background/surface/ink neutrals, display + body fonts (must
  be self-hostable — OFL or similarly licensed), reverse-domain id
  (e.g. `com.acme.app`), URL scheme (e.g. `acme`).
- Optional: a store URL for the Merch tab and the landing page's "Get
  tags" link — step 7.
- Optional: your fork's repository URL, for the root README's CI badge —
  step 3.

Also do this now (a fresh clone ships only `.example` files, and the
final boot check needs the real ones):

```sh
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

## 1. Design tokens — web and mobile move in lockstep

The same palette lives twice and the two files MUST stay value-identical:

- `apps/web/src/styles/tokens.css` — CSS variables, `:root` (light) +
  `@media (prefers-color-scheme: dark)` blocks.
- `apps/mobile/lib/tokens.ts` — the `light` and `dark` `Tokens` objects.

Edit both in one sitting. Every *color* key is strictly 1:1
(`--color-bg` ↔ `bg`, `--color-ink-muted` ↔ `inkMuted`, …) — copy the
same literal values into both. The non-color tokens (type scale, radii,
spacing, fonts) also exist in both files but in platform-shaped form
(`radius`/`space`/`fonts` consts on mobile); keep them in agreement if
you change them. The shell's heights are layout, not brand, but a new
display font or a taller wordmark can outgrow them. `--shell-nav-height`
(the header, 56px) is mirrored on mobile as `SHELL.headerHeight` in
`lib/tokens.ts`: the two move together. `--shell-tab-height` (the web
bottom bar, 60px) is web-only; the mobile tab bar keeps React
Navigation's default height. `--shell-max-width` is the content column.
The 720px nav breakpoint is the literal `@media (max-width: 719.98px)` in
`apps/web/src/styles/app.css`, documented in the `tokens.css` comment
(CSS variables cannot drive media queries): change both or neither.

Two more places echo `--color-bg` and must be updated to the new light
and dark background values or the native splash will flash the old brand:

- `apps/mobile/app.json` → `expo.android.adaptiveIcon.backgroundColor`
  (light bg) and the `expo-splash-screen` plugin entry's
  `backgroundColor` (light bg) + `dark.backgroundColor` (dark bg).

**The one-accent rule.** The palette is near-monochrome with exactly one
vivid accent, and the accent appears only on the primary action of a
screen: Connect, Accept, Claim tag, and Join (the resolver's "Join this
gathering" and the gathering's own Join), plus mobile's "Read NFC tag".
That is the `btn--connect` class on web and `kind="connect"` on mobile.
Do not introduce a second accent and do not
spread the accent to borders, links, or chrome — restraint is the design
system. Keep the WCAG notes in `tokens.css` honest: accent/accent-ink
≥ 4.5:1, `--color-border-input` ≥ 3:1 against `--color-surface` (WCAG
1.4.11), in both light and dark — recompute the ratios cited in the
comments with a contrast checker; don't leave stale numbers.

**Checkpoint:**

```sh
grep -rn --exclude-dir={node_modules,dist,.expo,.wrangler,.turbo} \
  '#c2410c\|#ff6a3d' apps/
```

returns nothing (old accent fully evicted from both files; the
exclusions matter — stale build output under `dist/` still contains the
old values and would false-fail this). Repeat for each old neutral you
replaced. Then `bun run lint && bun run typecheck` — both green.
If you changed the header height,
`grep -n 'shell-nav-height:' apps/web/src/styles/tokens.css` and
`grep -n 'headerHeight' apps/mobile/lib/tokens.ts` show the same number.

## 2. Fonts — self-hosted, no CDNs

Skip if keeping Space Grotesk + Inter. Both platforms load fonts from
local files; keep it that way (no `<link>` to font CDNs).

Web (`apps/web`):
1. Obtain latin variable woff2 files for your fonts. Easiest source:
   `cd apps/web && bun add -d @fontsource-variable/<font>` then copy
   `node_modules/@fontsource-variable/<font>/files/<font>-latin-wght-normal.woff2`
   into `apps/web/src/fonts/` (then `bun remove` the package — only the
   file ships). Delete the old `space-grotesk-var-latin.woff2` /
   `inter-var-latin.woff2` once unreferenced.
2. Update the two `@font-face` blocks at the top of
   `apps/web/src/styles/app.css`: family name, `src` filename, and the
   `font-weight` range your variable file actually covers (read it from
   the `@font-face` in `node_modules/@fontsource-variable/<font>/index.css`
   before removing the package).
3. Update `--font-display` and `--font-body` stacks in
   `apps/web/src/styles/tokens.css` to the new family names (keep
   system-font fallbacks).

Mobile (`apps/mobile`):
1. `cd apps/mobile && bun add @expo-google-fonts/<font>` (exists for
   every Google Font; for non-Google fonts use `expo-font`'s
   `useFonts({ Name: require(...) })` with bundled files instead) and
   `bun remove` the old `@expo-google-fonts/*` packages.
2. Update the imports and the `useFonts({ … })` map in
   `apps/mobile/app/_layout.tsx`.
3. Update the `fonts` map in `apps/mobile/lib/tokens.ts` to the exact
   exported style names (e.g. `Manrope_600SemiBold`).

**Checkpoint:** `bun run typecheck` — green (a wrong import name in
`_layout.tsx` fails mobile tsc; the `fonts` map in `lib/tokens.ts` is
plain strings tsc can NOT validate — compare its values against the
`useFonts` keys by eye, a typo there silently falls back at runtime).
`ls apps/web/src/fonts/` lists exactly the files referenced by
`app.css`.

## 3. Wordmark and copy

The brand renders in these places. Use the **wordmark** in the first
eight (they render it as a mark) and the **display name** inside prose
sentences (the `nfcPermission` string, README prose):

- `apps/web/src/routes/index.tsx` — the `<h1 className="wordmark">`.
- `apps/web/src/components/AppShell.tsx` — the header wordmark link.
- `apps/web/src/components/CalmStates.tsx` — the "withme home" link on
  the not-found and error cards (two places).
- `apps/web/src/routes/login.tsx` — the `<p className="hint">withme</p>`
  above the sign-in heading (besides its page title).
- `apps/web/src/routes/t.$uid.tsx` — `WordmarkFooter`, the only brand
  mark a stranger who tapped a tag sees.
- Page titles: `apps/web/src/routes/__root.tsx`, `login.tsx`,
  `claim.$uid.tsx`, `_app.connections.tsx`, `_app.gatherings.tsx`,
  `_app.gatherings_.$id.tsx`, `_app.profile.tsx`, `_app.merch.tsx` (each
  route's `head()`).
- `apps/mobile/components/Header.tsx` — the wordmark `<Text>`.
- `apps/mobile/app/t/[uid].tsx` — the `user_agent` prefix
  (`withme-mobile/…`).
- `apps/mobile/app.json` — the `react-native-nfc-manager` plugin's
  `nfcPermission` string ("Read withme tags…" → "Read Acme tags…").
- `apps/mobile/app.json` — the `expo-image-picker` plugin's
  `photosPermission` string ("Choose a photo for your profile."), the
  iOS prompt before the photo library opens. It carries no brand;
  rewrite it only for voice.
- The demo seed identity: `supabase/seed/index.ts` hardcodes the demo
  emails (`*@demo.withme.local`) and password (`withme-demo-1`), which
  surface in the seed's console output, the README, and the
  `VITE_DEMO_CREDENTIALS` landing-page hint. Rebrand them or keep them —
  but whatever the seed creates is what the README and
  `VITE_DEMO_CREDENTIALS` must say (that hint has an example line in
  `apps/web/.env.example` too — the step 8 sweep greps it).
- `README.md` and `apps/mobile/README.md`, if you keep them — but not by
  blind substitution: the root README's `withme` occurrences include the
  title, the upstream repo URL in the CI badge (needs your **fork's
  URL**), `@withme/*` package names which stay, and the demo-credentials
  line which must match the seed (previous bullet).
  `apps/mobile/README.md`'s occurrences are all `@withme/*` names — no
  change there.

**Caution:** if you also rewrite *action* copy (button labels like
"Connect", "Claim tag", "Accept", the "Name" field label), the Playwright
specs select by those strings — update every match of
`grep -rn "getByRole\|getByLabel\|getByText" apps/web/e2e`, the shared
steps in `apps/web/e2e/helpers.ts` included, or e2e will fail.

**Checkpoint:**

```sh
grep -rni withme apps/web/src apps/mobile/app apps/mobile/components \
  supabase/seed README.md apps/mobile/README.md | grep -v '@withme/'
```

returns nothing (if you deliberately kept the seed identity or an
upstream attribution link, those are the only acceptable matches), and
`grep -n nfcPermission apps/mobile/app.json` shows your new copy.
If your new brand itself contains the string `withme` (e.g.
`golfwithme`), this and every later brand sweep needs an extra filter
for your own strings — `| grep -viE 'golfwithme|golf with me'` — the
checkpoints are about OLD-brand residue, not the substring.
`app.json` is deliberately NOT in the bulk grep here — its remaining
`withme` values (name/slug/scheme/bundle ids) are step 4's job; the
final sweep in step 8 catches everything.

## 4. App identity (mobile)

In `apps/mobile/app.json`, set: `expo.name` (display name), `expo.slug`,
`expo.scheme` (deep-link scheme — physical tags deep-link via
`<scheme>://t/<uid>`), `expo.ios.bundleIdentifier` and
`expo.android.package` (reverse-domain, immutable after store
submission — choose carefully).

**Checkpoint:** `cd apps/mobile && bunx expo config --type public`
prints the new name/slug/scheme without schema errors.

## 5. EAS re-ownership (requires the fork owner's Expo account)

The starter's EAS project belongs to the upstream org; a fork must claim
its own:

1. In `apps/mobile/app.json`, delete `expo.owner`,
   `expo.extra.eas.projectId`, and `expo.updates.url` — and remove the
   `extra.eas` / `updates` objects they leave empty.
2. `cd apps/mobile && bunx eas init` (logged in as the fork owner) —
   creates a fresh project and writes the new `projectId` + `owner`.
3. `bunx eas update:configure` — restores `updates.url` pointing at the
   new project.

**Checkpoint:** `app.json` carries the fork owner's `owner` and a
`projectId` ≠ `cf56d2f1-eaec-406b-be9c-972519a6be84`, and `updates.url`
ends with that new projectId.

## 6. Deploy names and environment

- `apps/api/wrangler.jsonc` → `name` (e.g. `acme-api`).
- `apps/web/wrangler.jsonc` → `name`, AND `services[0].service` must
  equal the new api worker name — the web worker reaches the API through
  this binding; a mismatch deploys a web app that cannot resolve tags
  server-side.
- `supabase/config.toml` → `project_id` (optional; names the local
  Docker stack — if changed, `bun run db:stop && bun run db:start`).
- The `.env` files you created up front are *stack* config, not brand:
  local values stay as the `.example` files ship them. Production
  URLs/keys are deploy-time secrets. `VITE_DEMO_CREDENTIALS` (web)
  renders the landing-page demo hint — unset it or keep it in sync with
  your seed identity (step 3).

**Checkpoint:** `grep -n 'withme' apps/api/wrangler.jsonc apps/web/wrangler.jsonc`
returns nothing, and the web `services` entry matches the api `name`.

## 7. Merch store pointer (optional)

The Merch tab and the landing page's "Get tags" link exist only when a
store URL is set: a pointer to where your tags are sold, never commerce.
Skip this step if you have no store yet; the tab stays absent.

- Local: uncomment and set `VITE_STORE_URL=https://…` in `apps/web/.env`
  and `EXPO_PUBLIC_STORE_URL=https://…` in `apps/mobile/.env`, the same URL
  in both. Restart the dev servers (Vite and Metro read env at start;
  start Metro with `--clear`, then relaunch the app — a running Expo Go
  keeps its old bundle until it is reopened).
- Production: the same lines in `apps/web/.env.production` and
  `apps/mobile/.env.production` (go-live §3 and §4). Both bundlers inline
  the value at build time: changing it means a rebuild and redeploy on
  web and an `eas update` on mobile.
- The value is public — it is baked into both bundles. Use the plain
  storefront URL, https only, with no tokens or tracking parameters you
  would not print on a flyer.
- Copy: the card reads "Tags and gear from the store." in
  `apps/web/src/routes/_app.merch.tsx` and `apps/mobile/app/(tabs)/merch.tsx`;
  the tab label is `Merch` in `AppShell.tsx` and `(tabs)/_layout.tsx`.
  Rewrite it in your voice; keep one card and one "Open store" action.
- Leave `VITE_STORE_URL: ''` in `apps/web/playwright.config.ts` alone: the
  smoke pins the tab absent on purpose (`shell.spec.ts`).

**Checkpoint:** `grep -n '^VITE_STORE_URL=https://' apps/web/.env` and
`grep -n '^EXPO_PUBLIC_STORE_URL=https://' apps/mobile/.env` each print one
line, with the same URL. With both dev servers up, `/merch` shows the card,
"Open store" opens the store in a new tab, and the landing page shows
"Get tags".

## 8. Icons + final gate

Replace the artwork in `apps/mobile/assets/`. `app.json` wires two
files: `icon.png` (1024×1024, `expo.icon`) and
`android-icon-foreground.png` (`expo.android.adaptiveIcon.foregroundImage`).
The other four (`splash-icon.png`, `favicon.png`,
`android-icon-background.png`, `android-icon-monochrome.png`) are
template files nothing references: replacing them changes nothing until
`app.json` points at them (the `expo-splash-screen` entry's `image`,
`expo.web.favicon`, `adaptiveIcon.backgroundImage` / `monochromeImage`).
The web app ships no favicon — and no `public/`
directory; `mkdir -p apps/web/public` and drop a `favicon.ico` there if
you want one.

Then run the full verification gate from `docs/the-slice.md`:

```sh
bun run lint && bun run typecheck && bun run test
```

all green, plus the final brand sweep — with the identity steps done,
this now covers everything step 3's checkpoint deferred:

```sh
grep -rni --exclude-dir={node_modules,dist,.expo,.wrangler,.turbo} \
  withme apps/ supabase/seed README.md | grep -v '@withme/'
```

returns nothing (same acceptable-matches caveat as step 3).

Finally the visual check, which needs BOTH dev servers: in one shell
`cd apps/api && bun run dev` (the web loaders call the API Worker on
port 8786 — without it the resolver page errors), in another
`cd apps/web && bun run dev`. The landing page shows your wordmark in
your fonts, and the resolver card (`/t/04BBBBBBBBBBBB` after
`bun run db:seed`: Ada's card, inviting you to her gathering) settles
with your accent on its one primary action, "Join this gathering", and
nowhere else. That tag shows no Connect button; Connect and Accept carry
the same accent (step 1).
