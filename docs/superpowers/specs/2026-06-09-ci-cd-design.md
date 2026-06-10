# CI/CD for withme-starter — Design

Date: 2026-06-09
Status: Approved

## Goal

Add GitHub Actions CI/CD to the withme-starter monorepo: linting, typechecking,
building, testing on every push/PR, and npm publishing of `@withme/nfc` as the
"deploy" step (there is no deployable app yet; `apps/` is empty).

## Decisions

- **Linter: oxlint.** Adopted repo-wide as a new root devDependency with a
  minimal `.oxlintrc.json`. Chosen over Biome/ESLint for consistency with the
  user's other project (`../vibe-with-me`) and CI speed. No formatter for now;
  `oxfmt`/Prettier can be added later if format checks are wanted.
- **Deploy = npm publish.** App deployment is out of scope until `apps/starter`
  exists.
- **Release trigger: git tag push** matching `nfc-v*` (e.g. `nfc-v0.1.0`).
  No changesets; version bumps stay manual while the package is v0.x.

## Workflows

Two workflows, one job each. A single job installs once and runs the whole
suite in seconds; parallel jobs and reusable workflows are not worth it at this
repo size.

### ci.yml

- Triggers: push to `main`, all pull requests.
- Concurrency group per ref with cancel-in-progress.
- Steps: `oven-sh/setup-bun` → `bun install --frozen-lockfile` → `bun run lint`
  → `bun run typecheck` → `bun run build` → `bun run test`.
- Root `package.json` gains real `lint` / `typecheck` / `build` / `test`
  scripts (replacing the `"no tests yet"` placeholder) so CI and humans run
  the same commands across workspace packages.

### release.yml

- Trigger: push of a tag matching `nfc-v*`.
- Permissions: `contents: write` (GitHub Release), `id-token: write`
  (npm provenance).
- Steps:
  1. Full CI gate (same lint/typecheck/build/test as ci.yml).
  2. Version guard: fail if tag version ≠ `packages/nfc-sdk/package.json`
     version.
  3. `npm publish --provenance --access public` from `packages/nfc-sdk`
     (Node + `NPM_TOKEN` secret via `NODE_AUTH_TOKEN`).
  4. Create a GitHub Release from the tag with generated notes.

## Extras

- `.github/dependabot.yml`: weekly version bumps for GitHub Actions only
  (not npm deps, to keep noise down).
- CI badge in the root README.

## Prerequisites (user-side, before CI/CD is live)

1. Push the repo to GitHub (local `main` is ahead of `origin/main`).
2. Add an `NPM_TOKEN` repo secret (granular token with publish rights to the
   `@withme` scope; the scope must exist on npm).
3. Fill in the LICENSE placeholder (`[REPLACE: your name or org]`) before the
   first real publish.
4. After the first publish exists, consider switching to npm Trusted
   Publishing (OIDC) and dropping the token.

## Out of scope

CONTRIBUTING, issue templates, code of conduct, app deployment (arrives with
`apps/starter`), npm dependency update automation, format checking.
