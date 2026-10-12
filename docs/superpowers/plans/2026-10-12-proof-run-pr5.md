# Proof run (PR 5 of the tabs buildout): Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take a fresh clone of `main` (after Milestone 4) through every derivation skill and then go-live, as a fake derivation, and time each skill. The result is "runclub-with-me", a run club fork. Every place where a skill and reality disagree gets fixed in the skill and re-run. The acceptance report is the program's acceptance test: spec "Delivery" item 5, "Fresh clone → make-it-yours → customize-gathering → extend-profile → go-live, as a fake derivation, timed. This is the acceptance test for 'derivations are no longer barebones.'" The merged PR contains only skill fixes (`.agents/skills/**`), the report and this plan (`docs/**`), and, only if a fix requires it, `README.md`. Linear: ENG-748 (project P-ENG-39, decisions in ENG-749).

**Architecture:** The binding spec is `docs/superpowers/specs/2026-09-22-app-shell-and-tabs-design.md` ("Delivery" item 5). The program is `docs/superpowers/program.md` milestone 5. The method is a copy of Milestone 4's fresh-clone re-runs (`plans/2026-10-11-derivation-skills-pr4.md` Tasks 7b–7d): clone, follow literally, time, log deviations, fix the skill, repeat. Two things are new here. First, the skills run **in sequence on one clone**, so their order-dependence shows up. Second, go-live comes last, behind an explicit stop for Alex.

**Tech Stack:** As in the starter: Supabase local (CLI, Docker), Bun, turbo, oxlint, bun test, Playwright, wrangler, Expo (Expo Go in the iOS simulator, driven by agent-device and simctl). Phase B option 1 adds hosted Supabase, Cloudflare Workers, and EAS Update.

**Scope guard:**
- No app code in the PR. `git diff --name-only origin/main...HEAD` lists only `.agents/skills/**` and `docs/**` (plus `README.md` if a fix needs it, with the reason in the PR body).
- An **app** defect found by the run (as opposed to a skill-text defect) becomes a Linear issue under P-ENG-39, like ENG-750/751/752. It is not fixed here unless Alex says so.
- Derivation code lives only in clones under `/Users/alexeisele/dev/withme-scratch/`, with `origin` removed. Those clones are never pushed and are deleted at the end.
- Nothing billable, outward-facing, or credentialed happens without Alex's go-ahead at Task 9 (Phase B).

---

## Decisions made in this plan (Alex can change any of them)

1. **The vertical: a run club.** "runclub-with-me": wordmark `runclub`, display name `Run Club`. The program manager chose it; Alex can swap in any vertical before Task 1. Only the Inputs blocks change.
2. **Gathering nouns:** run / runs, tab label `Runs`, URL `/runs`. The web routes are `_app.runs.tsx` and `_app.runs_.$id.tsx`. The mobile routes are `(tabs)/runs.tsx` and `run/[id].tsx`. customize-gathering's optional URL rename is exercised on purpose: it touches the most files and has never been run from a fresh clone.
3. **The gathering field is `route_name`, not `distance_km`.**
   - `route_name` is text, required, at most 120 characters, labelled "Route", and carried on the resolve summary (e.g. "River loop, 8 km"). It is customize-gathering's worked example (`course_name`) with a new name: the same `not null default ''` column with a `char_length` CHECK, the same `create_gathering` rebuild with the new parameter before `p_location`, the same `resolve_tag` `v_gathering_json` edit, the same summary `pick` and SDK mirror. Every minute the run measures is the skill, and every deviation is a skill defect, not an improvisation.
   - The skill does not cover a numeric `distance_km`. That field would need a zod number while the forms post strings, parsing on both clients, a decision on what Postgres `numeric` looks like in the generated types and in jsonb, and unit formatting in `gatheringLine()`. The follower would have to make all of that up, and the timing would measure invention. extend-profile has a "typed fields" scope note; customize-gathering has none.
   - The report still lists what a numeric field would need (Task 11, a static read). If Alex wants the numeric field run for real, swap it in. Expect roughly +30–60 min and 3–5 deviations, and a "Typed fields" paragraph for customize-gathering as the fix.
4. **Profile fields (extend-profile):**
   - Card tier: `pace`, label "Pace", **required** for completion (so the completion gate is exercised). The format is `^[0-9]{1,2}:[0-5][0-9]/(km|mi)$`, enforced by a zod `.regex` and a SQL CHECK named `profiles_pace_format` (e.g. `5:30/km`).
   - Connections tier: `strava_handle`, label "Strava", 1–120 characters, optional. It has the same shape as the worked example's `contact_handle`.
   - `pace` departs from the worked example's `CardLineSchema` on purpose: a pattern instead of a length. That tests the skill's "typed fields take the same steps; the CHECK mirrors the zod rule" note at a small, bounded cost.
5. **make-it-yours inputs, all seams except EAS:**
   - Accent: light `#3f6212` on ink `#ffffff` (7.08:1), dark `#a3e635` on ink `#1a2e05` (9.69:1), both computed with the WCAG formula. The follower re-verifies them.
   - Display font **Archivo** (variable, OFL; `@fontsource-variable/archivo` on web, `@expo-google-fonts/archivo` on mobile). Inter stays as the body font. Step 2 (fonts) has never been executed: Milestone 4 skipped it.
   - id `com.runclub.app`, scheme `runclub`.
   - Store `https://shop.example.com/runclub`.
   - Fork repository URL `https://github.com/example/runclub-with-me`, used only for the README badge.
   - The seed identity is rebranded to `*@demo.runclub.local` / `runclub-demo-1`, which exercises the downstream skills' "or your rebranded identity" lines.
   - Step 5 (EAS) creates an Expo project, so it moves to Phase B.
6. **make-it-yours step 6's `project_id` rename runs for real** (`project_id = "runclub"`).
   - Milestone 4 skipped it because the stack was shared, and listed the order bug as a follow-up. Today's text renames first and then runs `db:stop && db:start`, which stops the not-yet-running new project while the old stack keeps ports 553xx.
   - In Milestone 5 nothing else is in flight. The run therefore stops the shared `withme-starter` stack **once, at Task 2**, and runs the clone on its own `runclub` stack until Task 13 restores `withme-starter`.
   - Precondition: the program manager confirms that no other session (including the `determined-bell-b12635` and `exciting-noyce-50c543` worktrees) needs the stack during Phase A. If that cannot be confirmed, skip the rename, record it as skipped, and the whole run uses the shared stack inside a normal stack window.
   - **Answered 2026-10-12: skipped — the shared stack stays up for another session; the rename is recorded as not run (the M4 order bug stays a known follow-up).** The whole run uses the shared `withme-starter` stack, and nothing in the run stops it (`db:stop`).
7. **One clone, many skills.** The line clone is `/Users/alexeisele/dev/withme-scratch/proof-runclub`.
   - Each skill's result is a local commit in the clone, tagged `pre-<next-skill>`.
   - A re-run after a skill fix starts from a fresh clone of the line **at that skill's `pre-` tag**, with the fixed skill texts copied in (the deviation procedure, below). If the re-run is clean, it becomes the line.
8. **Literal following is done by a fresh subagent per skill run.** It gets only the Follower brief of its task (inputs, environment notes, logging rules) and never this plan, the Milestone 4 plan, or earlier logs. The program manager reviews its log against the task's Watch list afterwards. The Watch list holds predicted deviations and must not leak into the brief.
9. **The order of skills:** make-it-yours → customize-gathering → extend-profile → provision-tags (local) → the full gate → the simulator pass → **stop** → go-live.
   - provision-tags runs after extend-profile, so its claim check also shows the new card tier.
   - add-destination-type is not run: a run club needs no new destination type, and the spec's sequence does not name it. The report says so.
10. **Go-live is Alex's call** (Task 9): option 1, a real throwaway production run approved step by step and torn down after; or option 2, a dry run with the production leg recorded as not run. There is no default. Phase A does not depend on the answer, so ask at the start of the milestone and collect the answer by Task 9.
11. **The report** is committed as `docs/superpowers/reports/<completion-date>-proof-run.md`, a new folder. It is summarized in the PR body and the Linear updates.

---

## Ground rules for every task

- **Branch and worktree.**
  - Work in `/Users/alexeisele/dev/withme-starter/.claude/worktrees/proof-run` on branch `claude/proof-run`, created from `origin/main` after PR #10 merges (Task 0). The shell variable is `WT`.
  - Never work in, or write to, any other worktree: `with-me-derivation-starter-1f2c69` (the program manager), `derivation-skills` (M4, merged), `determined-bell-b12635`, `exciting-noyce-50c543`.
  - Local `main` is stale: always base on `origin/main` after `git fetch origin`.
- **Variables used below:**

  ```bash
  WT=/Users/alexeisele/dev/withme-starter/.claude/worktrees/proof-run
  S=/Users/alexeisele/dev/withme-scratch
  LINE="$S/proof-runclub"          # reassigned when a clean re-run becomes the line; log every reassignment
  NOTES="$S/notes/m5"
  ```

- **The stack (Decision 6).**
  - Answered 2026-10-12: skipped — the shared stack stays up for another session; the rename is recorded as not run (the M4 order bug stays a known follow-up). The whole run uses the shared `withme-starter` stack in stack windows: check the ports below are free before each use, `bun run db:reset && bun run db:seed` when done, and never `db:stop`. The bullets below that assume a `runclub` stack (Task 2 stopping the shared stack, Task 13 restoring it) read accordingly.
  - Phase A is one window, granted by the program manager before Task 1. During it, nothing else touches Docker's Supabase or ports 55320–55324, 8786, 3000, 8796, 9456, 3010, or 8081.
  - Before opening it: `lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(8786|3000|8796|9456|3010|8081) '` prints nothing, and `docker system df` shows room.
  - If `supabase start` fails for lack of disk, stop and ask Alex to prune: the classifier blocks `docker rmi`, per the memory note.
  - Only Task 13 restores the `withme-starter` stack.
- **Playwright:** always `CI=1 bunx playwright test`. With other checkouts on this machine, `reuseExistingServer: !process.env.CI` could attach to their workers. This is an environment rule, not a skill deviation, so log it once.
- **The simulator** follows the memory note `ios-simulator-driving-technique.md`: agent-device + Expo Go + simctl, never `expo start --ios`, never `keyboard dismiss`, and type in chunks that never start with `-`. A skill that says `bunx expo start --ios` gets this substitution, logged once as an environment note.
- **Known local issues that are not skill defects:** log them when they bite, do not "fix" the skill for them, and leave the time they cost in the timing with a note.
  - **ENG-750.** A brand-new sign-up's first API calls can get `PGRST303` ("JWT issued at future"). The completion gate fails open (the account lands on Runs, not Profile). Relaunch, and it lands on Profile.
  - **ENG-751.** On a clone's first `vite dev` session, a server-side load of a claimed card (`/t/<claimed UID>`) can hang with 0 bytes after sign-in and claim. Restart `apps/web`'s `bun run dev`.
  - **Supabase CLI upgrade mid-run (2026-10-12).** Homebrew upgraded the `supabase` CLI 2.116.0 → 2.120.0 at 22:04:13Z, during customize-gathering run 2 (no one in this program ran brew). Resets under 2.120.0 write a newer storage schema (storage migration 72, `drop-bucketid-objname-index`) than the running `storage-api:v1.70.3` container expects, so every Storage upload fails with `42P10` until the stack is restarted under the new CLI. That restart is Alex's (an environment fix; `db:stop` is off-limits to the run). `db:reset` also stopped printing "… on branch main". `db:types` under 2.120.0 reformats `packages/db/src/types/supabase.ts` wholesale.
  - **ENG-752.** The db package's test utils have no remote guard, so a shell with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` exported would run the RLS suite against production. Never source `.env.demo-seed` outside a subshell, and never run `bun run test` / `bun test` in a shell or terminal tab that ever held production keys. Phase B checks `env | grep -c SUPABASE_SERVICE_ROLE_KEY` prints `0` before any local test.
- **No remote services in Phase A.** No `supabase link` / `projects` / `orgs`, no `wrangler deploy` or `login`, no `eas`.
  - Package installs (`bun install`, `bun add`) and the GitHub clone are fine: they are what a forker does.
  - Claude never types a credential into anything except the local stack's test accounts: the seed identity, and sign-ups on `localhost` / `127.0.0.1` with generated `@rls.test` / `@demo.runclub.local` addresses.
- **Logging.** One log per skill run, `$NOTES/<n>-<skill>-r<k>.md`. Commands, outputs (trimmed), deviations, and timestamps.
- **Timing protocol.**
  - `echo "START <skill> r<k> $(date -u +%FT%TZ)" >> "$LOG"` before the skill's first instruction, and `END` after its last checkpoint is green.
  - Waits that are not the skill's go in `PAUSE` / `RESUME` lines: a program-manager answer, a permission prompt, a Docker or disk stall. Report wall time and wall time minus pauses.
  - `bun install` of the clone counts toward setup (Task 1), not the skill.
- **What counts as a deviation.** Anywhere a literal reader had to guess, or the text and reality disagree:
  - a command fails or prints something other than the text's expected output;
  - a file, path, symbol, or count named in the text does not exist or differs;
  - a step is missing, so the next checkpoint goes red;
  - the text is ambiguous enough that two readings lead to different code.

  Not deviations: the environment notes above, and the known local issues.
- **The deviation procedure** (after the run ends, or as soon as the run cannot continue):
  1. Write it down in the log: the step, what the text says, what happened, and the reading taken.
  2. Fix the SKILL.md (or README / slice doc) in `$WT` and commit:
     `git -C "$WT" commit -am "<skill>: fixes from the proof run" -m "<what the run hit, and why the text now says what it says>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
  3. **Re-run, or record why not.**
     - A fix that changes a command, a path, an expected output, or a code block needs a re-run.
     - A wording-only fix in a run that reached the skill's final checkpoint green may skip the re-run. The log and the Done note say why.
     - At most three runs per skill. A third failing run stops the milestone and goes to the program manager and Alex.
  4. The re-run clone:

     ```bash
     R="$S/proof-runclub-<skill>-r<k>"
     rm -rf "$R"
     git clone --branch pre-<skill> "$LINE" "$R"          # the tag: a detached HEAD at the state before the skill
     git -C "$R" remote remove origin
     rsync -a --delete "$WT/.agents/skills/" "$R/.agents/skills/"
     git -C "$R" add -A .agents/skills
     git -C "$R" commit -m "skills: proof-run fixes at claude/proof-run $(git -C "$WT" rev-parse --short HEAD)"
     git -C "$R" tag -f pre-<skill>                        # the re-run starts from here
     for f in apps/api/.dev.vars apps/web/.env apps/mobile/.env; do [ -f "$LINE/$f" ] && cp "$LINE/$f" "$R/$f"; done   # gitignored, so the clone lacks them
     (cd "$R" && bun install)
     ```

     For make-it-yours itself, `pre-make-it-yours` has no env files to copy; the skill creates them.
  5. The re-run follows the same Follower brief, with `$R` as its checkout. If it is clean, set `LINE="$R"`, log it, and continue from there.
- **Commits in the clone** (the fork's own history; never pushed):
  `git -C "$LINE" add -A && git -C "$LINE" commit -m "<skill>: runclub" && git -C "$LINE" tag pre-<next-skill>`.
- **Commit messages on `claude/proof-run`:** imperative subject, the why in the body, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Done notes.** Each task ends with a `**Done YYYY-MM-DD**` paragraph written into this plan, as in M4:
  - the SHA it ran at, the log path, and the runs with their minutes;
  - each deviation with the commit that fixed it;
  - what was skipped and why;
  - anything outside the skill.

  The program manager commits the plan update with the task's fixes.

---

## Phase A — local, no billing

### Task 0: Branch, plan, baseline

**Files:** Create `docs/superpowers/plans/2026-10-12-proof-run-pr5.md` (this plan).

```bash
git -C /Users/alexeisele/dev/withme-starter fetch origin
git -C /Users/alexeisele/dev/withme-starter log --oneline -1 origin/main     # expect the merge of PR #10
git -C /Users/alexeisele/dev/withme-starter worktree add "$WT" -b claude/proof-run origin/main
cd "$WT"
cp /private/tmp/claude-501/-Users-alexeisele-dev-withme-starter--claude-worktrees-with-me-derivation-starter-1f2c69/6460d7d3-0c45-4a17-95f1-8861d7fd65ba/scratchpad/m5-proof-run-plan.md docs/superpowers/plans/2026-10-12-proof-run-pr5.md
git add docs/superpowers/plans/2026-10-12-proof-run-pr5.md
git commit -m "Plan: the proof run (milestone 5)" -m "A fresh clone through every derivation skill and go-live, timed: the program's acceptance test." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bun install
cp -n apps/api/.dev.vars.example apps/api/.dev.vars; cp -n apps/web/.env.example apps/web/.env; cp -n apps/mobile/.env.example apps/mobile/.env
mkdir -p "$NOTES" && chmod 700 "$S"
```

Then, with the stack granted (it is still `withme-starter` here):

```bash
bun run db:reset && bun run db:seed
bun run lint && bun run typecheck && bun run test
```

**Expected:**
- The gate is green.
- Post-M4 `main` carries no app change from M4, so the counts equal M3's: db 72, contract 31, nfc 48. Record the actual numbers; they are the baseline the report's arithmetic starts from.
- The API e2e check count before extend-profile is expected to be 58 (M4 Task 7c counted 66, including extend-profile's 8). Task 6 records the actual number.

Also:
- Read whatever `$S/notes/` holds from M4; leave it alone (the program manager decides whether to delete it).
- Ask the program manager for Decision 6's confirmation: may the shared stack stop for all of Phase A?
- Post the Task 9 question to Alex now (Decision 10), so the answer is ready when Phase A ends.

No other commit.

**Done 2026-10-12.** `origin/main` was 511a26c (the merge of PR #10). The worktree `$WT` was created on `claude/proof-run` from it, and the plan was committed as 806f857 and pushed (`git push -u origin claude/proof-run`). Before that commit the program manager's answers were written in: Decision 6 is answered "skipped" (the shared stack stays up for another session, so the whole run uses `withme-starter` in stack windows and never stops it), and the stack ground rule says so. `bun install` (1529 packages), the three env copies, `mkdir -p "$NOTES"` and `chmod 700 "$S"` done; M4's `$S/notes` had already been deleted by the program manager, so `$S/notes/m5` is new. Baseline gate in a stack window: the six ports were free (553xx held by the running `withme-starter` stack, as expected), `docker system df` showed 12.1 GB of images; `bun run db:reset && bun run db:seed` succeeded first time; `bun run lint && bun run typecheck && bun run test` green (2026-10-12T21:21:22Z–21:21:39Z). **Baseline counts: db 72, contract 31, nfc 48**, equal to M3's as expected. Typecheck was replayed from turbo's shared worktree cache (8/8 cached, same content hash); the tests ran fresh (the one cached task in that run is nfc's build). The stack was reset and seeded again after the tests and is left that way. Not done here, by the program manager's instruction: the Task 9 question to Alex (the program manager asks him), and Decision 6's confirmation (already answered).

---

### Task 1: The fresh clone (the line)

```bash
rm -rf "$LINE"
git clone https://github.com/vibe-with-me/withme-starter.git "$LINE"
git -C "$LINE" remote remove origin                                    # nothing in the fork can be pushed
test "$(git -C "$LINE" rev-parse HEAD)" = "$(git -C /Users/alexeisele/dev/withme-starter rev-parse origin/main)" && echo "line = origin/main"
git -C "$LINE" tag pre-make-it-yours
(cd "$LINE" && time bun install)
```

If the GitHub clone needs credentials the shell does not have, fall back to the local object store at the same commit. Do not enter credentials.

```bash
git clone --no-checkout /Users/alexeisele/dev/withme-starter "$LINE"
git -C "$LINE" fetch /Users/alexeisele/dev/withme-starter refs/remotes/origin/main
git -C "$LINE" checkout -B main FETCH_HEAD
git -C "$LINE" remote remove origin
```

**Expected:**
- `line = origin/main`.
- `git -C "$LINE" status --porcelain` prints nothing.
- No `.env` / `.dev.vars` files exist yet (`ls "$LINE"/apps/web/.env 2>&1` says no such file).
- `$NOTES/1-setup.md` records the SHA, the clone source, and the `bun install` time.

**Done 2026-10-12.** `LINE=/Users/alexeisele/dev/withme-scratch/proof-runclub`, cloned from GitHub over anonymous HTTPS (no credentials; the local fallback was not needed). `origin` removed. HEAD 511a26c on `main`, equal to `origin/main`: `line = origin/main`. Tagged `pre-make-it-yours`. `bun install`: 1529 packages, 6.78 s wall (bun 1.3.10). `git status --porcelain` empty; no `.env` / `.dev.vars` files. Log: `$NOTES/1-setup.md`. No deviations.

---

### Task 2: make-it-yours (literal)

**Follower brief** (the whole prompt for the fresh subagent):

> You are rebranding a fresh fork of withme-starter at `$LINE` (give the literal path). Start at `README.md`'s "Extending a fork", then follow `.agents/skills/make-it-yours/SKILL.md` literally, top to bottom, as if you had never seen this codebase. Do not read anything under `docs/superpowers/` and do not consult other clones.
>
> Inputs:
> - wordmark `runclub`, display name `Run Club`;
> - accent light `#3f6212` / ink `#ffffff`, dark `#a3e635` / ink `#1a2e05`;
> - display font Archivo (keep Inter as the body font);
> - id `com.runclub.app`, scheme `runclub`;
> - store `https://shop.example.com/runclub`;
> - fork repo URL `https://github.com/example/runclub-with-me`;
> - rebrand the seed identity to `*@demo.runclub.local` with password `runclub-demo-1`;
> - wrangler names `runclub-api` / `runclub-web`; `project_id = "runclub"`.
>
> Do every step except step 5 (EAS). It creates a project on Expo's servers, so skip it and say so.
>
> Environment notes, which are not part of the skill: run Playwright as `CI=1 bunx playwright test`. Do not run any command against a remote service (supabase link/projects/orgs, wrangler deploy/login, eas). Do not touch any other directory under `/Users/alexeisele/dev/withme-starter`. The Supabase stack is yours for this task.
>
> Log to `$NOTES/2-make-it-yours-r<k>.md`: START/END/PAUSE/RESUME stamps (`date -u +%FT%TZ`), every command and its trimmed output, and every deviation. A deviation is any place you had to guess, or where the text and reality disagree; for each, give the step, what the text says, what happened, and what you did. Do not fix the skill. Finish with the skill's step 8 checks and a list of the deviations.

**Watch list** (the program manager's; not in the brief):
- **Step 6, the `project_id` rename (Decision 6).** Literally, the follower renames, then `bun run db:stop && bun run db:start`. Expect the stop to act on the not-running `runclub` project and the start to fail on ports held by `withme-starter`.
  - That is the deviation PR4 listed as a follow-up.
  - Fix: stop first (`bun run db:stop` with the old `project_id`), then rename, then `bun run db:start`. Note the new, empty volumes and that `db:seed` is needed again. A command changed, so re-run.
  - If the follower stalls at the port conflict, let it stop `withme-starter` from `$LINE` before the rename. The stack is granted.
- **Step 2, fonts, executed for the first time.**
  - `@fontsource-variable/archivo`'s file is named `archivo-latin-wght-normal.woff2`; Archivo also has a `wdth` axis, and the skill names only `wght`.
  - On mobile, `@expo-google-fonts/archivo` exports names like `Archivo_600SemiBold`.
  - The skill says to compare the `fonts` map in `lib/tokens.ts` against `useFonts` by eye.
- **Step 3's file list** against the post-M4 tree. The sweep must print nothing beyond the seed-identity choices.
- **Step 7 and step 8:**
  - `/merch` shows the card;
  - "Open store" has `target="_blank"`;
  - the landing page shows "Get tags";
  - the accent appears only on "Join this gathering" for `/t/04BBBBBBBBBBBB`.
- **Reviewer checks after the run:**
  - `git -C "$LINE" diff pre-make-it-yours --stat` touches no `supabase/migrations/`, no `packages/db/test/`, and no `packages/contract/src/`.
  - `grep -rn --exclude-dir={node_modules,dist,.expo,.wrangler,.turbo} '#c2410c\|#ff6a3d' "$LINE/apps"` prints nothing.

**Expected:**
- The step 1, 3, 4, 6, 7, and 8 checkpoints as the skill states them.
- `bunx expo config --type public` shows `Run Club` / `runclub` / `com.runclub.app`.
- The gate is green at the baseline counts (db 72, contract 31, nfc 48).
- `docker ps --format '{{.Names}}' | grep -c supabase_db_runclub` prints `1` once the rename is done.

**Then:** the reviewer checks above, the deviation procedure, and a commit in the clone tagged `pre-customize-gathering`.

**Run 1 (2026-10-12).** On `$LINE` at `pre-make-it-yours` (511a26c). START 21:23:36Z, END 21:31:49Z: about 8 min wall, no pauses. Log: `$NOTES/2-make-it-yours-r1.md`. Step 5 skipped per the brief; `project_id` rename and `db:stop`/`db:start` also skipped (the shared stack, Decision 6), so the Watch list's step 6 item was not exercised. Every checkpoint run was green: lint, typecheck, test at the baseline counts (db 72, contract 31, nfc 48), Playwright 14/14, API e2e all passed, the visual check showed the accent only on "Join this gathering" in both modes. The result is uncommitted in `$LINE`'s working tree. Deviations:
- D1, step 1: the shipped light `--color-border-input` measures 2.97:1, below the 3:1 the skill requires. The follower raised the opacity from 0.46 to 0.47 (3.06:1). App defect, filed as ENG-753; the skill now says to raise it until the fix lands upstream (b160d58).
- D2, step 1: the token comments say the accent is for Connect and Accept only; the skill's rule lists five actions. App defect, part of ENG-753; no skill change.
- D3, step 2: the copied font file's name was unspecified. Now it is `<font>-var-latin.woff2`, with `format('woff2')` and the `wght` file only (Archivo also ships `wdth`) (b160d58).
- D4, step 3: the README title's target was unspecified. It is now the wordmark (b160d58).
- D5, steps 3/6/8: `apps/web/.env` is copied before step 3 edits the example demo-credentials line, and step 8's sweep reads `.env`. Step 3 now says to edit the line in both files, and its checkpoint greps both (b160d58).
- D6, step 4: no slug rule, and the upstream `owner`/`projectId` stay until step 5. Now the rule is the wordmark, lowercase, with hyphens, plus a warning against `eas` commands before step 5 (b160d58).
- D7, step 3: the landing card's "This is the starter app" hint was not on the surface list. It is now (b160d58).
- D8, step 8: the sweep missed `vibe-with-me` (app.json `owner`, the nfc-sdk `repository.url`) and never looked in `packages/` or `supabase/` beyond the seed. It now covers both, filters migrations and `packages/nfc-sdk/` with reasons, lists the conditional acceptable matches, and fails on the upstream `owner` (b160d58). On r1's tree it prints exactly the two expected lines: `owner` (step 5 skipped) and `project_id` (kept).
- D9, step 8: no icon artwork was supplied, so the input had a gap. Not a skill defect, and no change.

The step 8 sweep command changed, so a re-run is required (run 2, from a fresh `pre-make-it-yours` clone with b160d58's skills).

**Run 2 — Done 2026-10-12.** On `/Users/alexeisele/dev/withme-scratch/proof-runclub-make-it-yours-r2` (a fresh `pre-make-it-yours` clone with b160d58's skills). START 21:36:15Z, END 21:44:09Z: about 8 min wall. Log: `$NOTES/2-make-it-yours-r2.md`. Green: every checkpoint, lint, typecheck, test at the baseline counts, Playwright 14/14, API e2e all passed. The step 8 sweep prints exactly the two lines of the skipped sub-steps (`app.json` `owner`, step 5; `config.toml` `project_id`, Decision 6). The remaining notes were wording-only and are fixed in 77ec5f1: which ratios the token comments cite (the accent pair and the input border, each theme), and that the starter README's prose names no brand, so only the title and badge change. The other notes were input gaps (no copy or artwork supplied) or already known (ENG-753). Run 2 reached the final checkpoint green and the fixes are wording only, so no re-run is needed. Reviewer checks passed. The line is now `LINE=/Users/alexeisele/dev/withme-scratch/proof-runclub-make-it-yours-r2`, committed as 9a58a9a ("make-it-yours: runclub") and tagged `pre-customize-gathering`.

---

### Task 3: customize-gathering (nouns, URLs, one field) (literal)

**Follower brief:**

> You are customizing the gathering in the Run Club fork at `$LINE`. Follow `.agents/skills/customize-gathering/SKILL.md` literally, §1 then §2, as if new to the codebase. Do not read `docs/superpowers/`.
>
> Inputs:
> - nouns: singular "run", plural "runs";
> - tab label `Runs`;
> - URL segment `/runs`: web `_app.runs.tsx` and `_app.runs_.$id.tsx`, mobile `(tabs)/runs.tsx` and `run/[id].tsx`;
> - one new field `route_name`: text, required, at most 120 characters, form label "Route", shown on rows, on the detail header, and on the resolve summary (a tapper sees it before joining);
> - seed value for Ada's run: "River loop, 8 km".
>
> Environment notes: Playwright as `CI=1 bunx playwright test`. No remote services. The Supabase stack is yours. The fork's seed identity is `*@demo.runclub.local` / `runclub-demo-1`.
>
> Log to `$NOTES/3-customize-gathering-r<k>.md` with the same stamps and deviation format as before. Finish with the skill's closing gate: the verification gate from `docs/the-slice.md`, including the API e2e and Playwright.

**Watch list:**
- **Callers of `create_gathering` that the skill does not name.** §2.3 names only `gatherings.test.ts`'s `createGathering()`. On post-M3 `main`, `packages/db/test/account.test.ts` calls `create_gathering` twice (lines 102 and 109). `apps/api/e2e/handshake.e2e.ts` also creates a gathering in §17 (`doomed`, line 224), besides §12. With a required `p_route_name`, all three fail, and the e2e also fails `tsc -p e2e`.
  - Expected deviation: the map and §2.3/§2.7 need "every caller: `grep -rn "create_gathering\|gatherings.create" packages apps supabase/seed`".
- **`resolve_tag`'s newest body is still `20261011120000_avatars.sql` here.** The skill's `grep … | sort | tail -1` must print it.
- **Copy.**
  - §1 says the list's title is `'Events — withme'`. After make-it-yours it is `'Events — runclub'`. This is order-dependence, and the text should say "(`'Events — <wordmark>'` after make-it-yours)".
  - The copy sweep must catch "Join this gathering?", "Create gathering", "Point my tags at this gathering", and the Playwright strings in `gatherings.spec.ts` and `shell.spec.ts`.
- **URLs.**
  - `routeTree.gen.ts` is regenerated by `bunx vite build`.
  - The mobile `gatheringHref` `/gathering/` prefix.
  - The login pages' `startsWith('/gatherings/')` / `('/gathering/')`.
  - make-it-yours step 3's page-title list now names files that no longer exist (`_app.gatherings.tsx`). This is order-dependence; record it for the report.
- **Signature.** `drop function public.create_gathering(text, timestamptz, text);` matches, and the new `(text, timestamptz, text, text)` grants are issued.
- **Safety reviewer checks:**
  - `git -C "$LINE" diff pre-customize-gathering -- supabase/migrations | grep -n 'profiles_select\|gathering_members_\|is_gathering_member\|on_block_created'` prints nothing (§3 a–c untouched).
  - `gatherings.test.ts`'s 17 original tests are unedited apart from `createGathering()`'s argument.
  - The summary carries `route_name` and nothing private.

**Expected:**
- After §1: lint, typecheck, and `CI=1 bunx playwright test` green, with 14 passed and URL assertions on `/runs`.
- After §2:
  - db 73 (72 + the CHECK case);
  - contract 32 (31 + the negative case);
  - nfc 48;
  - `bun run --cwd packages/nfc-sdk typecheck` clean;
  - `packages/db/src/types/supabase.ts` shows `route_name`;
  - API e2e ends `handshake e2e: all checks passed`;
  - Playwright 14.
- Record the actual counts.

**Then:** the reviewer checks, the deviation procedure, and a commit tagged `pre-extend-profile`.

**Run 1 (2026-10-12).** On `$LINE` at `pre-customize-gathering` (9a58a9a). START 21:44:53Z, END 21:54:41Z: about 10 min wall. Log: `$NOTES/3-customize-gathering-r1.md`. The gate was green after the deviations below: db 73, contract 33 (31 + the negative case + "a route alone is an update"), nfc 48, API e2e 59 `ok` lines ending "all checks passed", Playwright 14. The result is uncommitted in `$LINE`'s working tree, with the new migration untracked. Every deviation is fixed in 77ec5f1:
- D1, §1: the copy sweep missed both apps' `lib/my-tags.ts` (My tags: "A tap invites people to a gathering."). The sweep now covers `apps/web/src` and `apps/mobile/lib`.
- D2, §1: the list's title is `'Events — runclub'` after make-it-yours, not `'Events — withme'`. The text now says `'Events — <wordmark>'`.
- D3, §1: `profile.spec.ts` and `helpers.ts` carry copy and URLs too. The copy and URL lists now say every file under `apps/web/e2e`, with a `/gatherings` grep.
- D4, §2.1: a required field broke four existing contract fixtures and expectations. The text now says to update them, and how to find them (`grep -n starts_at`).
- D5, §2.1/§2.2: the rule for rows that predate the column. Inputs require `min(1)`; `GatheringSchema` accepts `''` (max only); the `default ''` stays. This is the fork's choice.
- D6, §2.2: `db:seed` ran before §2.7 edited the seed (PGRST202). The seed edit now comes before the first `db:seed`.
- D7, §2.2: `revoke … from public` left anon able to execute the new `create_gathering`, through Supabase's default privileges. The text now revokes `from public, anon`, and `docs/the-slice.md`'s grant rule says the same. Core's older RPCs have the same gap: ENG-754.
- D8, §2.3: the anon call in 'anon can neither create nor join' needs the new argument. The text now names the argument-only changes and keeps the safety sentence for everything else.
- D9, map/§2.3: `account.test.ts` calls `create_gathering`. The map now carries a caller grep, and §2.3 and §2.7 use it.
- D10, §2.7: `handshake.e2e.ts` creates in §17 too, and the e2e reads the built SDK. The caller grep covers §17, and §2.5 now says to run the root `bun run typecheck`.
- D11, §2.7: `profile.spec.ts` creates a run. Covered by the grep, and the text says every Playwright create step needs a fill.
- D12: environment (`CI=1`; `supabase.ts` not committed per the run rules). No change.

Safety reviewer checks passed: no §3 mechanism touched, the original 17 tests changed only by the new argument (plus one added `route_name` assertion), and the summary carries `route_name` only. Commands and steps changed, so a re-run is required (run 2, from a fresh `pre-customize-gathering` clone with 77ec5f1's skills).

**Run 2 (2026-10-12).** On `/Users/alexeisele/dev/withme-scratch/proof-runclub-customize-gathering-r2` (a fresh `pre-customize-gathering` clone with 77ec5f1's skills; HEAD 9b9ec75). START 21:59:52Z, END 22:12:03Z: about 12 min wall. Log: `$NOTES/3-customize-gathering-r2.md`. The result is uncommitted in that clone's working tree, with `supabase/migrations/20261012220349_add_gathering_route_name.sql` untracked.
- Green, for everything the run touched: the §1 checkpoint (lint, typecheck, Playwright 14/14 after a reset and seed); contract 34; db 73/73 at step 3, before the CLI upgrade; API e2e §1–§17, including the new route checks (`gathering carries its route`, `… summary, route included`); typecheck 8/8; Playwright's `gatherings.spec.ts` (route on the detail header and on the anonymous resolver) and `profile.spec.ts`'s create-a-run.
- Red, environment, not skill: Homebrew upgraded the Supabase CLI 2.116.0 → 2.120.0 at 22:04:13Z, mid-run (see the known local issues). The gate's reset under 2.120.0 left the running storage container on an older schema, so every upload failed with Storage `42P10`: 7 db tests (6 in the avatars bucket suite, plus `delete_my_account`'s avatar upload; db 66/73 at the gate), API e2e from §18 on (the first `uploadAvatar`), and Playwright's `a photo replaces the initial` (13/14). Nothing gathering- or route-related failed.
- Deviations, fixed in 94361f8 except where noted:
  - D1, §2.2/§2.3: with `revoke … from public, anon`, anon's create gets `42501 permission denied for function create_gathering` before the body's `'authentication required'`, so the "untouched" anon test failed. §2.3 now changes that one create assertion to `expect(createError?.code).toBe('42501')` and calls it an argument-and-expectation change, not a safety change. The join assertion and the "everything else untouched" rule stay.
  - D2, §1: the mobile URL list left out the list screen, which `router.push`es `/gathering/[id]` for its rows. It is named now.
  - D3, §1: the checkpoint had no reset before Playwright. It now runs `bun run db:reset && bun run db:seed` first.
  - D4, §2.2: `db:types` under a different CLI rewrote `supabase.ts` (275+/415-). The text now says to check the new field semantically (grep for it), not the diff size. Environment cause: the CLI upgrade.
  - D5: the CLI upgrade itself. Environment; recorded under the known local issues (this commit), not in the skill.
  - D6, §1: vertical copy without the word "gathering": the create form's title placeholder (web and mobile), and the seed's title and console text. §1 now lists them with their files, and points at §2.2's seed edit for the title.
  - D7, §1: test titles counted as string literals. That reading matches the text. No change.
  - D8, §2.6: how the field joins the display lines. §2.6 now says the lines are composed in both apps' `lib/format-time.ts` and gives the run's pattern (a `…WhenAndWhere()` helper, "Route · when · where", used by rows and the detail header; `gatheringLine()` uses it, "Title · Route · when · where").
  - Also logged, no change: §2.5 was accurate (nfc-sdk typecheck failed before the mirror, clean after); two perl one-liners failed on brace delimiters (tooling).

Safety reviewer checks: no §3 mechanism touched; of the original 17 tests only the anon test changed (the argument, plus the create expectation now written into §2.3). Fixes D1 and D3 change an expectation and a command, so a third run (the last allowed) is required, from a fresh `pre-customize-gathering` clone with 94361f8's skills, once Alex has restarted the stack under the new CLI.

**Run 3 — Done 2026-10-12.** Before it, Alex restarted the shared stack under CLI 2.120.0 (PostgREST 16.4, storage-api v1.79.36, gotrue v2.197.0) and cleaned up stale images (Docker disk 99% → 77%). On `/Users/alexeisele/dev/withme-scratch/proof-runclub-customize-gathering-r3` (a fresh `pre-customize-gathering` clone with 40b8e70's skills; HEAD d8307db). START 22:24:35Z, END 22:34:12Z: about 10 min wall. Log: `$NOTES/3-customize-gathering-r3.md`. Every checkpoint and the gate were fully green: the §1 checkpoint (lint, typecheck 8/8, reset and seed, Playwright 14/14); contract 32, db 73, nfc 48; API e2e 59 `ok` lines ending "all checks passed" (including `gathering carries its route`); Playwright 14; typecheck 8/8. Deviations D1–D5 are fixed in b5772ed, all wording or paths:
- D1, §1: the seed's `p_location` ('The roof, 14 Loom St') is vertical copy the sweep cannot catch; now listed next to `p_title` and the console text.
- D2, §2.2: `db:types` prints "Generated TypeScript is unformatted" and CLI 2.120.0 adds `ComputedFields: never` to each of the 8 tables. Both are now named as expected (no formatter in the repo).
- D3, §1 mobile URLs: `git mv … round/[id].tsx` needs `mkdir -p` first and leaves an empty `app/gathering/`; both commands are in the text now.
- D4, §2.4: the web and mobile detail screens each declare a local `interface GatheringPatch`; now named next to `queries/gatherings.ts`.
- D5, §2.5: the root `bun run typecheck` cannot be green until steps 6–7 (mobile create screen, then `handshake.e2e.ts`). It now runs after step 7; the nfc-sdk package typecheck stays at step 5.

The run reached the gate green and the fixes are wording and paths only, so no re-run (and none is allowed: this was run 3). Observations for the report, no skill change:
- O1: the `char_length(route_name) <= 120` CHECK admits `''`. "Required" lives in the contract's `min(1)` (API only) and in `create_gathering` always supplying it, so a host's direct PostgREST update could blank the field (the host's own row; no safety boundary crossed).
- O2: the web "Join this run?" preview and mobile `gatheringHref` hints carry title and time only (from search params), so the route is not on that pre-join screen; the resolver card the tapper sees first does show it. The skill does not list these surfaces.
- O3: comments still say "Events tab" / "Open gathering", left per "replace only inside string literals and JSX text". Environment: Playwright run as `CI=1 bunx playwright test`.

Safety reviewer checks passed: the migration diff adds only the column, the column grant, the rebuilt `create_gathering`, and `resolve_tag` (its body differs from the avatars migration's only by the `'route_name'` key), so no §3 mechanism is touched; the new `create_gathering` carries `revoke execute … from public, anon` and `grant … to authenticated`; of the original 17 RLS tests only the anon test changed (the argument and the `42501` expectation §2.3 prescribes). The result is committed in that clone as 226c7ad ("customize-gathering: runclub") and tagged `pre-extend-profile`. The line is now `LINE=/Users/alexeisele/dev/withme-scratch/proof-runclub-customize-gathering-r3` at 226c7ad.

Meanwhile PR #11 (5bdd81d) merged into `main`: ENG-750 is fixed by requiring PostgREST 16.3+. The forks are based on 511a26c and do not carry it.

---

### Task 4: extend-profile (both tiers, completion gate) (literal)

**Follower brief:**

> You are adding vertical profile fields to the Run Club fork at `$LINE`. Follow `.agents/skills/extend-profile/SKILL.md` literally, §1 to §9, as if new to the codebase. Do not read `docs/superpowers/`.
>
> Inputs:
> - Card tier: `pace`, label "Pace", required for completion. Format: one or two digits, a colon, two digits 00–59, then `/km` or `/mi` (e.g. `5:30/km`). The zod rule and the SQL CHECK must mirror each other; name the CHECK `profiles_pace_format`.
> - Connections tier: `strava_handle`, label "Strava", 1–120 characters, optional.
> - Seed values: Ada `5:30/km` and `@ada.runs`; Lin `6:15/km` and `@lin.runs`.
> - Test values: wherever the worked example uses `'E2E Club'` use `'5:00/km'`, and wherever it uses `'Smoke Club'` use `'5:45/km'`.
>
> This fork has already run customize-gathering: gatherings are "runs" at `/runs`, mobile `run/[id].tsx`, and `create_gathering` takes a required `p_route_name`.
>
> Environment notes:
> - Playwright as `CI=1 bunx playwright test`.
> - §7's simulator pass: drive Expo Go with agent-device and simctl per `/Users/alexeisele/.claude/projects/-Users-alexeisele-dev-withme-starter/memory/ios-simulator-driving-technique.md`, not `expo start --ios`. Start Metro with `cd apps/mobile && bunx expo start --port 8081 --clear` (no `CI=1`).
> - Known local issues, not skill defects: a brand-new sign-up may land on Runs because of `PGRST303` (relaunch the app). A claimed card's SSR may hang in `vite dev` (restart `apps/web`'s dev server).
> - No remote services. The stack is yours. Sign in only with the fork's seed identity or fresh `@rls.test` addresses on the local stack.
>
> Log to `$NOTES/4-extend-profile-r<k>.md` as before.

**Watch list:**
- **O1.** The new RLS test "a gathering co-member sees the card…" calls `create_gathering` without `p_route_name`. The skill's comment ("If customize-gathering changed create_gathering's arguments, pass them here too.") should catch it. If it fails at §3's green step instead, it is a deviation in visibility: the comment needs to be in §2's prose, not only inside the code.
- **O2.** §3's "newest" greps:
  - `resolve_tag`'s newest is now customize-gathering's migration;
  - `accept_connect_request`'s is still `avatars`;
  - the text says "In the starter both print `…avatars.sql`" and "the newest in the starter being `…delete_my_account.sql`".

  Correct behavior: copy two bodies from two files, keeping `route_name` in `v_gathering_json`. Reviewer check:

  ```bash
  grep -n "route_name" "$LINE"/supabase/migrations/*_extend_profile.sql   # at least one hit, in resolve_tag
  ```

  A stale `resolve_tag` copy silently drops `route_name` from the summary, which the API e2e and the zod parse of the resolve output would catch. Record which check caught it.
- **O3.** Stale paths in the text after the URL rename:
  - the map and "Outside the tabs" name `gathering/[id].tsx` and web `_app.gatherings_.$id.tsx`;
  - §7's Join path names `gathering/[id].tsx` and "Join this gathering?";
  - §8 names `gatherings.spec.ts`.

  Expected: no code change, but a "(renamed if you ran customize-gathering's URL step)" note.
- **O4.** §8's "the grep finds twelve" profile-creating fills: record the count after customize-gathering.
- **The pattern field.** The length test (`profiles_affiliation_length`, 81 characters) becomes a format test (`profiles_pace_format`, e.g. `'fast'`). Record whether the text made that adaptation obvious. Also check that `isProfileComplete` and the two claim forms' `disabled` condition handle `pace`.
- **ENG-750 and ENG-751:** note it if either appears.
- **Safety reviewer checks:**

  ```bash
  git -C "$LINE" diff pre-extend-profile -- supabase/migrations | grep -n 'profiles_select'                  # nothing
  grep -n "strava_handle" "$LINE"/packages/db/src/queries/handshake.ts | grep -i card_columns             # nothing
  grep -rn "strava_handle" "$LINE"/packages/nfc-sdk/src                                                    # nothing
  ```

  Also: `profile_details_select` is the skill's policy with the column renamed, and nothing else.

**Expected:**
- Red at §2: 17 failures (the 14 new, the cascade test, the first `account.test.ts` test, the enumeration anon sweep), on `PGRST205` / `PGRST204`.
- Green at §3: db 87 (73 + 14).
- contract 37 (32 + 5); nfc 48.
- Lint and typecheck green after §7.
- API e2e: the baseline plus 8, ending `handshake e2e: all checks passed`.
- `CI=1 bunx playwright test`: 14 passed.
- §7's simulator checks pass.
- Record the actual numbers.

**Then:** the reviewer checks, the deviation procedure, and a commit tagged `pre-provision-tags`.

**Run 1 (2026-10-12).** On `$LINE` at `pre-extend-profile` (226c7ad). START 22:35:06Z, END 22:58:18Z: about 23 min wall, including the simulator pass. Log: `$NOTES/4-extend-profile-r1.md`. The result is uncommitted in `$LINE`'s working tree, with `packages/db/test/profile-fields.test.ts` and `supabase/migrations/20261012223915_extend_profile.sql` untracked. Every checkpoint came out as predicted:
- contract 32 → 28 pass / 4 red (the four fixtures the text names) → 37;
- db 73 → 70 pass / 17 red at §2 (the 14 new, cascade, the first `account.test.ts` test, the enumeration anon sweep; `PGRST205` / `PGRST204`) → 87 at §3;
- typecheck after §3 red only in `@withme/api` and `@withme/nfc`; after §4 only nfc; `nfc-sdk` typecheck clean after §5; lint and typecheck 8/8 after §6 and §7;
- API e2e 67 `ok` lines ending "all checks passed", including the 8 new; Playwright 14 passed on the first try; the Name grep found 12;
- the simulator pass 5/5, including the cold Connect returning to the tag and Join returning to "Join this run?".

§3's greps found two different newest files and the follower copied each: `resolve_tag` from customize-gathering's migration (`route_name` kept) and `accept_connect_request` from `avatars`. Watch list O1 (the `create_gathering` comment) worked: the follower passed `p_route_name`. No `PGRST303` seen (PostgREST 16.4).

Safety reviewer checks passed: `profiles_select` appears in the new migration only in comments; `strava_handle` is not in `CARD_COLUMNS` or the SDK; `route_name` is in the `resolve_tag` copy; `profile_details_select` is the skill's policy with the column renamed.

Deviations, fixed in f319943 except where noted:
- D16, §7/§8 (order): the simulator pass ran before §8 seeded the new fields, so seeded Lin was sent to "Finish your profile" and Ada's card showed no pace. The seed edit, with a reset and seed, now comes in §7 before the simulator checkpoint; §8 keeps the e2e. The simulator text now says Lin lands in the tabs and both cards show the card tier.
- D1/D3/D4/D9, §1/§2/§3/§6 (a field with a format rule): new note after the worked example. Use a dedicated zod schema whose regex matches the SQL CHECK class for class (`[0-9]`, not `\d`). The length tests become format tests, with malformed values and valid controls. Inputs get a format `placeholder`. A malformed value gets the generic save error. §1, §2, §3 and §6 point to the note.
- D2, §1: "it goes first" was specific to `affiliation`; now "your field in its alphabetical place".
- D5, §3: `db:reset` prints `Finished supabase db reset` with or without `on branch …` depending on the CLI version.
- D6, §2: at the red checkpoint `@withme/api` and `@withme/nfc` may already be red too.
- D8, §4: the connections-tier block goes right after `upsertOwnProfile`.
- D11/D15, map/§7/§8: "renamed if you ran customize-gathering's URL step" notes for `gathering/[id].tsx`, `gatherings.spec.ts`, and "Join this gathering?".
- D12, §7: mobile `setCurrent(saved.profile)` goes right after the update, before the `redirect` branch's `dismissTo`.
- D10/D13/D18 (labels, ids, the `Muted` line, the seed comment): one "in your vertical's words" note in §6, §7 and the seed. D7 (do not commit `supabase.ts`, the run rules), D14, D17, D19: environment, no change.

D16 changes the order of the steps, so a re-run is required: run 2 of at most 3, from a fresh `pre-extend-profile` clone with f319943's skills.

**Run 2 — Done 2026-10-12.** On `/Users/alexeisele/dev/withme-scratch/proof-runclub-extend-profile-r2` (a fresh `pre-extend-profile` clone with f319943's skills; HEAD 4e532e5). START 23:02:22Z, END 23:27:44Z: about 25 min wall, including the simulator pass. Log: `$NOTES/4-extend-profile-r2.md`. Every predicted count matched:
- contract 32 → 4 red → 37;
- db 73 → 17 red at §2 (14 × `PGRST205`, 2 × `PGRST204`, and the format test) → 87 at §3;
- typecheck after §3 red only in `@withme/api` and `@withme/nfc`; after §4 only nfc; `nfc-sdk` typecheck clean after §5;
- the gate: lint 0, typecheck 8/8, contract 37, db 87, nfc 48; API e2e 67 `ok` lines including the 8 new; Playwright 14 on the first try;
- the simulator pass 5/5 with the reordered seed (D16): Lin lands complete in the tabs and both cards show pace; the cold Connect returns to the tag and the cold Join returns to "Join this run?".

No `PGRST303` seen. Safety reviewer checks passed: `profiles_select` appears in the new migration only in comments; `CARD_COLUMNS` is `id, display_name, avatar_path, bio, pace`; `strava_handle` is not in the SDK.

Deviations 1–8: the wording ones are fixed in 6ea5df3. That covers 2 (the SQL pattern matches the zod regex's classes and anchors; JavaScript-only escapes like `\/` drop out), 3 (`resolve_tag`'s newest can be customize-gathering's migration, so the grep decides, and the new timestamp must sort after every existing one), and 5 (`autoCapitalize="none"` on a mobile format field that needs exact case). The same commit says that showing the card tier on Requests, Blocked, and a gathering's member list is optional (6, 8: the fork showed pace on Requests and Blocked, not on the member list). The rest were fork choices or environment: 1 (`pace` sorts last, not first), 4 (no commit in the fork, the run rules), 7 (Metro + agent-device in place of `expo start --ios`).

Incident (the simulator driver, not the app or the skill): a mis-tap on the Profile tab hit "Delete account". It was dismissed with "Keep my account" and nothing was deleted.

The fixes are wording only and the run was green end to end, so no re-run is needed. The line is now `LINE=/Users/alexeisele/dev/withme-scratch/proof-runclub-extend-profile-r2`, committed as 8929ce9 ("extend-profile: runclub") and tagged `pre-provision-tags`.

---

### Task 5: provision-tags, local only (literal)

**Follower brief:**

> You are provisioning tags for the Run Club fork at `$LINE`, locally. Follow `.agents/skills/provision-tags/SKILL.md` literally: §1 with `--count 3` and base URL `http://localhost:3000`, and §5 locally with the chip UID `04D00D00D00D03`. Skip §2–§4 (production and physical tags) and say so.
>
> The fork's seed identity is `lin@demo.runclub.local` / `runclub-demo-1`.
>
> Environment notes: the claimed-card SSR hang in `vite dev` is known (restart `apps/web`'s dev server). No remote services. Keep every UID out of anything except the log file.
>
> Log to `$NOTES/5-provision-tags-r<k>.md` as before.

**Watch list:**
- `DB=supabase_db_runclub`, read from the renamed `config.toml`. The `docker exec` must hit the fork's stack.
- The output directory is `$HOME/withme-tags/…`: the skill's path carries the upstream brand. Record it as a cosmetic finding; it is a deviation only if it confuses the follower.
- The claim as Lin turns the page into Lin's card **with her pace and without her Strava handle**. That is the cross-skill check, and the reviewer verifies it in the log or a screenshot.
- A signed-out viewer sees "Connect".
- A second account's stale claim gets "This tag has already been claimed."

**Expected:**
- §1's stdout lines (`Provisioned 3 unclaimed tags on http://127.0.0.1:55321` … `Wrote provisioned-tags.csv and provisioned-tags.html (printable).`).
- `-rw-------` modes.
- `git status --porcelain` empty, and no `provisioned-tags.*` in `$LINE`.
- Three `|unclaimed` rows.
- §5's UID comes back under `returning` and lands on "Claim this tag".

**Then:** the deviation procedure. There is no clone commit: provisioning changes no files in the fork. Tag `pre-gate` anyway.

**Run 1 (2026-10-12).** On `$LINE` at `pre-provision-tags` (8929ce9). START 23:28:38Z, END 23:35:15Z: about 7 min wall. Log: `$NOTES/5-provision-tags-r1.md`. The follower reset and seeded the stack first for a clean start, piped every UID-printing command through `tee` to the log and a redacting `sed`, and wrote the dev-server logs into the batch directory. Every expected result came out:
- §1's stdout word for word; exactly the two files, both `-rw-------`, CSV header `uid,encode_url`; `git status --porcelain` empty and no `provisioned-tags.*` at the fork root; three `|unclaimed` rows.
- End to end: signed out, the encode URL went to `/login?returnTo=%2Fclaim%2F…`; Lin signed in and claimed, and the page became Lin's card with `6:15/km` and without `@lin.runs` (the cross-skill check passed). A signed-out viewer, and a signed-in non-owner, saw Lin's card with "Connect" and no claim offer. A stale claim got "This tag has already been claimed."
- §5: the insert returned the UID (`INSERT 0 1`); a re-run returned `(0 rows)` / `INSERT 0 0`; the row is `unclaimed`; `/t/<chip>` gave `307` to `/claim/<chip>`.
- §4's retirement: the batch directory (CSV, HTML, dev-server logs) deleted, and its empty parent. Then a reset and seed; the fork's tree clean.

One ENG-751 hang: the signed-out SSR of the newly claimed card never returned under `vite dev`; a restart of `apps/web`'s dev server fixed it (1.7 s after). Because of it the stale-claim race was repeated on the second batch UID.

App observation for the report (not the skill): vite logged a React hydration mismatch on `/login?returnTo=/claim/…`. The server rendered the loading `div` (`aria-busy`), the client the form.

Deviations, fixed in d81acb5 except where noted:
- D8, §5: `$DB` "from §1" was set only inside a checkpoint snippet. §1 now names it as a normal step, and §5 derives it again for a fresh shell.
- D10, §5: the `307` to `/claim` proves nothing, since unknown UIDs redirect the same way. §5 now checks a count of the `unclaimed` row (`1`).
- D2/D3, §1: the local command prints the UIDs, and so do the `psql` checkpoint, the pages and the dev-server logs. An agent now sends stdout to `provision.log`, reads a redacted view, and puts the dev-server logs in `$OUT` so the retirement deletes them.
- D6, §1: a brand-new account meets "First, your card" (with the required profile fields) before "Claim this tag". Now said; the seeded identity is complete.
- D4, §1: the ENG-751 hang and its restart are now named in the end-to-end check.
- D11, §4: removing the batch directory's empty parent is now allowed in one phrase.
- D1 (the reset before seeding), D5 (the race repeated on another UID), D7 (the fork's identity, covered by "or your rebranded identity"), D9 (the chip UID came from the brief): follower choices or environment, no change.

§5's `$DB` is a command change, so a re-run is required: run 2 of at most 3, on `$LINE` with d81acb5's skill.

**Run 2 — Done 2026-10-12.** START 23:38:13Z, END 23:44:57Z: about 7 min wall. Log: `$NOTES/5-provision-tags-r2.md`. All checkpoints passed:
- §1's output word for word; the files `-rw-------` (`provision.log` included); `git status --porcelain` empty and no stray `provisioned-tags.*`; three `|unclaimed` rows; `/t/<UID>` gave `307` to `/claim/<UID>`, then `/login?returnTo=%2Fclaim%2F…`.
- The claim as Lin turned the page into her card with `6:15/km` and without `@lin.runs`. A signed-out viewer saw "Connect" and no claim offer. A stale claim got "This tag has already been claimed." A brand-new account got "First, your card" (Name, Pace) before "Claim this tag".
- §5: the insert returned one row, the count check printed `1`, and a re-insert returned 0 rows.
- §4: the batch directory (dev-server logs included) deleted. The follower's own search found no batch UID left in wrangler state, the vite cache, `supabase/.temp`, the notes, or its scratchpad.

One ENG-751 hang, cleared by a restart of `apps/web`'s dev server.

Deviations 1–9. D2 (§1 hard-coded `$HOME/withme-tags`), D3 (how to restart the web dev server under the agent's log redirect) and D4 (stop the dev servers before §4 deletes `$OUT`) are fixed by wording in d220c5c. The rest are follower choices or observations: D1 the required background read late, D5–D6 how the second and the brand-new accounts were exercised, D7 a signed-out "Connect" is a link (the skill's text does not imply a button, so no change), D8 the `/login` hydration mismatch (an app observation for the report, as in run 1), D9 screenshot names. Wording only, so no re-run is needed.

Final fork: `/Users/alexeisele/dev/withme-scratch/proof-runclub-provision-tags-r2` at 3d472db, tagged `pre-provision-tags` and `pre-gate` (provisioning changes no files).

---

### Task 6: The full gate on the finished fork (program manager or a verification subagent; not literal-following)

From `$LINE`, with the `runclub` stack up:

```bash
bun run db:reset && bun run db:seed
bun run lint && bun run typecheck && bun run test           # record db / contract / nfc counts
(cd apps/api && bun run dev) &                               # or a second shell; wait for :8786
(cd apps/api && bun run e2e)                                 # ends "handshake e2e: all checks passed"
(cd apps/web && CI=1 bunx playwright test)                   # 14 passed
```

Then stop the API dev server. Cross-skill checks, each logged with its output:

```bash
grep -rni --exclude-dir={node_modules,dist,.expo,.wrangler,.turbo} withme apps/ supabase/seed README.md | grep -v '@withme/'     # make-it-yours step 8 sweep, re-run after the later skills: nothing
grep -rn -i "'[^']*gathering[^']*'\|>[^<]*gathering[^<]*<" apps/web/src/routes apps/web/src/components apps/mobile/app apps/mobile/components --include='*.tsx' | grep -v "api\.app\.gatherings\|Gathering[A-Z]\|/gathering" | head    # user-facing "gathering" residue: review by eye
docker exec supabase_db_runclub psql -U postgres -tAc "select public.resolve_tag('04BBBBBBBBBBBB')::text" | grep -o '"route_name":"[^"]*"\|"pace":"[^"]*"\|strava'   # route_name and pace, never strava
```

**Expected:**
- All green.
- The counts match Tasks 3–4 (db 87, contract 37, nfc 48, unless a run recorded otherwise).
- The sweep prints nothing.
- The residue list holds only identifiers.
- The resolve prints `route_name` and `pace` and no `strava`.

Write `$NOTES/6-gate.md`.

---

### Task 7: The simulator pass on the finished fork

Use the memory-note technique. Boot by UDID if `simctl` reports a phantom boot. Run Metro from `$LINE/apps/mobile` (`bunx expo start --port 8081 --clear`, with `EXPO_PUBLIC_STORE_URL` set by make-it-yours), plus `cd apps/api && bun run dev`. Then `xcrun simctl openurl booted exp://127.0.0.1:8081`. Screenshots go to `$NOTES/7-sim-<n>.png`.

1. **Brand.** The header wordmark reads `runclub` in Archivo. The tabs are Runs / Connections / Merch / Profile. Merch shows the store card. The accent appears only on primary actions.
2. **Completion gate.** A new local account (`sim-<stamp>@rls.test`) lands on Profile. Save is disabled until Name and Pace are both filled. `fast` is refused and `5:30/km` saves. A relaunch with Pace emptied returns to "Finish your profile". (ENG-750 may land the first try on Runs.)
3. **Runs.** Create a run with Route "Harbor 5k". The row and the detail header show the Route. Point my tags at it, then open the tag (`exp://127.0.0.1:8081/--/t/<uid>`) signed out. The summary shows the title, the time, and "Harbor 5k".
4. **Connections tier.** Two connected accounts each see the other's Strava handle in Connections. A resolve of either card shows Pace and no Strava.
5. **Cold Join.** Signed out, open `04BBBBBBBBBBBB`, choose Join, then sign up. The app lands on "Join this run?" (the renamed copy), and Join opens Profile. Save returns to "Join this run?".
6. **A provisioned tag.** One UID from Task 5 lands on the claim screen.

**Expected:** all six pass. Any failure goes through the deviation procedure for the skill whose step it traces to, or becomes a Linear issue if it is an app defect. Write `$NOTES/7-sim.md`.

---

### Task 8: Phase A close-out

1. Check that every skill fix is committed: `git -C "$WT" status --porcelain` prints nothing.
2. Check that `$WT` still passes `bun run lint`. This changes no app code; it confirms the skill edits left the tree clean.
3. Write the **Phase A Done note** into this plan: a table of runs per skill (minutes, deviations, fix commits), the order-dependences found (O1–O4 plus any new ones), and which known issues bit.
4. Send the program manager a five-line Phase A summary for Alex. It goes with the Task 9 stop message, if Alex has not yet answered it.
5. Leave the `runclub` stack and the line clone in place: Phase B uses them, and Task 13 cleans them up.

---

## Phase B — go-live (billable, outward-facing)

### Task 9: STOP. Alex decides.

Nothing in this task creates anything. The program manager sends Alex the message below, after Phase A is done. The decision is recorded in ENG-749.

**What go-live would create.** These are the skills' own commands, applied to the fork:

| Where | What | From |
| --- | --- | --- |
| Supabase | Possibly a new org (`supabase orgs create "Run Club Proof"`, a free-plan org). One project, `runclub-proof`, in us-east-1, with every migration pushed (`supabase db push`): the public `avatars` bucket, auth users and demo rows from `SEED_ALLOW_REMOTE=1 bun run db:seed`, and optionally one provisioned tag (provision-tags §2, `--count 1`). | go-live §1; provision-tags §2 |
| Cloudflare | Two Workers on Alex's `workers.dev` subdomain: `runclub-api`, with three secrets (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CORS_ORIGIN`), and `runclub-web`. No custom domain, no DNS change. | go-live §2–§3 |
| Expo | A new EAS project, `runclub`, under Alex's account (`eas init`), its updates URL, and one published update on branch `demo`. No `eas build`: go-live builds nothing. | make-it-yours step 5; go-live §4 |
| Local (gitignored, in the clone or `$HOME`) | `$HOME/.config/runclub/supabase-db-password` (0600); `.env.demo-seed` with the service-role key (0600); `apps/web/.env.production`; `apps/mobile/.env.production`; `supabase/.temp/` link state; an encode list under `$HOME/withme-tags/` if provisioning runs. | go-live, provision-tags |
| Domain | None. Tags would be encoded only for a custom domain (provision-tags rule 6), and no physical tags are encoded in this run. | — |

**What it costs.** The figures are go-live's own; Alex confirms them on the dashboards.
- **Supabase.** $0 on a free-plan org, which allows two active free projects. If Alex's existing demo projects already use that allowance, the project needs a paid org. On an existing paid org, go-live puts the extra project's compute at about $10/mo, billed by the hour, so a same-day teardown costs cents. A new paid org adds its plan subscription.
- **Cloudflare Workers.** $0 on the free plan, which includes a daily request allowance.
- **EAS Update.** $0 on the free plan for one update and a handful of devices. No build minutes are used.
- **The domain.** $0: none is bought.

**Credentials Alex enters himself.** Claude never types, pastes, or reads them aloud.
- `supabase login` (browser or token).
- `bunx wrangler login` (browser OAuth).
- `bunx eas-cli login`.
- Any sign-in on the deployed app:
  - go-live §3's "verify the authed path once (sign in as the demo user via supabase-js…)". Claude writes the script to `$NOTES`, and Alex runs it.
  - The throwaway sign-up and `delete_my_account` check, which Alex does in his browser with an address that can confirm. The default SMTP only delivers to org members.
- The service-role key never appears on a command line or in a transcript. go-live's Python writes it straight to `.env.demo-seed`.

**Option 1: a real throwaway production run (Task 10a).**
- Claude runs each step only after Alex's "yes" for that step. Alex does the logins, the authed checks, and the deletes in teardown.
- It proves go-live end to end on a fork for the first time since go-live was distilled, and it is the only way to test go-live's database-push, secrets, service-binding, and JWKS checkpoints.
- Cost: about 60–90 minutes with Alex present for the logins and approvals, and $0 if a free Supabase slot exists.

**Option 2: a go-live dry run (Task 10b).**
- A read-through of every go-live command against the local fork, with everything that can be checked without an account actually checked:
  - `wrangler deploy --dry-run` bundles for both Workers;
  - the service-binding name;
  - production-mode web and mobile builds with placeholder URLs, checked for inlining;
  - the seed's remote refusal;
  - the key-extraction script against a fixture;
  - `zsh -n` on every subshell block.
- The production leg is recorded as **not run**, and the report says plainly that go-live is not proven by this milestone.
- About 30 minutes, unattended, $0.

**The program manager's recommendation**, in prose for Alex: option 1, if a free Supabase project slot is available. The acceptance sentence names go-live, and option 2 cannot test go-live's riskiest steps (`db push` on a fresh project, secrets, the service binding, JWKS, hosted `delete_my_account`). If no free slot exists and Alex does not want a paid project for an afternoon, option 2, and the report carries "go-live unproven" as an open item. **The decision is Alex's.**

No timer runs during this stop.

---

### Task 10a (option 1): A throwaway production run, step by step

Run it in a **dedicated terminal tab**, from `$LINE`, after Task 6's tests: no `bun test` runs in this tab afterwards (ENG-752). Every **[approve]** line means: show Alex exactly what the next command creates and wait for a clear yes. Timing covers Claude's steps only; Alex's logins and approvals are PAUSE.

1. **Alex:** `supabase login`, `bunx wrangler login`, `bunx eas-cli login`. **Claude verifies** (read-only): `supabase orgs list`, `bunx wrangler whoami`, `bunx eas-cli whoami`.
2. **[approve] make-it-yours step 5 (EAS)**, literally, in `apps/mobile`: remove `owner`, `extra.eas.projectId`, and `updates.url`; then `bunx eas init`; then `bunx eas update:configure`.
   - Checkpoint: a new `projectId` ≠ `cf56d2f1-…`, and `updates.url` ends with it.
   - Watch: go-live §4.1 runs `eas-cli init --non-interactive --force` again. That is overlap between the two skills. Record which one a forker should run, and whether running both is harmless.
3. **[approve] go-live §1, the hosted database:**
   - org (new free org, or the org Alex names);
   - the password file in `$HOME/.config/runclub/`;
   - `supabase projects create runclub-proof …`;
   - `link` and `db push` via `SUPABASE_DB_PASSWORD`.

   Checkpoints:
   - `Finished supabase db push`, listing every migration, the fork's two included;
   - Alex confirms in the dashboard that the `avatars` bucket is public, 1 MiB, JPEG/WebP;
   - the key fetch writes `.env.demo-seed` with mode `-rw-------`;
   - `env | grep -c SUPABASE_SERVICE_ROLE_KEY` prints `0` in the tab afterwards.
4. **[approve] go-live §1's production seed**, in the skill's subshell. Watch: whether the seed's demo identity (`*@demo.runclub.local`) can sign in on hosted auth without SMTP. go-live's Auth note says seeded credentials are the path.
5. **[approve] go-live §2, the API Worker:** `bunx wrangler deploy` (retry rule), then the secrets subshell. Checkpoints:
   - `curl https://runclub-api.<sub>.workers.dev/health` returns `{"ok":true}`;
   - an anonymous SDK resolve of `04BBBBBBBBBBBB` (a throwaway `NfcClient` script in `$NOTES`, no credentials) returns Ada's run summary **with `route_name`**.
6. **[approve] go-live §3, the web Worker:** `apps/web/.env.production` with `VITE_STORE_URL` set, then build and deploy. Checkpoints (bodies checked with Python):
   - `/` returns 200 with `runclub`;
   - `/t/04BBBBBBBBBBBB` returns 200 with the seeded card and the route (this proves the service binding);
   - `/merch` returns 200.

   Alex runs the authed-path script and the throwaway sign-up → Profile → Account → Delete account. Record whether the confirmation email's link pointed at the deployed site or at `localhost`.
   - **Watch:** go-live never sets the Supabase Auth **Site URL / redirect URLs**, which README's Deploy step 2 does. A `localhost` link is a go-live deviation. The fix adds that step to §1 or §3 with the dashboard path.
7. **[approve] go-live §4, mobile:** `apps/mobile/.env.production` (the `EXPO_PUBLIC_*` mirrors plus the store), then `eas update --branch demo --environment production … --non-interactive`, then the `--no-bytecode` export check into `$NOTES/verify-export`.
   - Note for the report: no build targets this project, so no device can load the update. go-live's mobile checkpoint is the export check only.
8. **Optional [approve] provision-tags §2** with `--count 1` against production, stdout to the log file, the owner stop as written. Open the encode URL (a `workers.dev` URL, which rule 6 allows only because this is a throwaway). Default: run it if Alex approves; it is provision-tags' only unexercised leg.
9. **Teardown.** Alex runs the deletes, because they are permanent; Claude prints the exact list and verifies afterwards.
   - `bunx wrangler delete --name runclub-web`, then `--name runclub-api`.
   - `supabase projects delete <ref>`. The org, if a new one was made, goes in the dashboard.
   - The EAS project goes in the expo.dev dashboard (project settings).
   - Claude removes the local files: `.env.demo-seed`, both `.env.production`, `$HOME/.config/runclub/`, the encode-list directory, and `supabase/.temp/`.
   - Verify:
     - `curl -s -o /dev/null -w '%{http_code}\n' https://runclub-api.<sub>.workers.dev/health` is not 200;
     - `supabase projects list` has no `runclub-proof`;
     - `env | grep -c SUPABASE_` prints `0`.

Deviations go through the deviation procedure: the fix goes into go-live or make-it-yours. A re-run of production steps needs a new approval; the default is to fix the text and record "not re-run against production".

---

### Task 10b (option 2): A go-live dry run

From `$LINE`, after Task 6. Log to `$NOTES/10b-dry-run.md`. Every go-live command gets one of three labels: **verified locally**, **needs an account (not run)**, or **Alex only**.

```bash
# Workers: bundle without deploying (no login needed)
(cd apps/api && bunx wrangler deploy --dry-run --outdir "$NOTES/dry-api")        # ends "--dry-run: exiting now."
grep -n '"name"' apps/api/wrangler.jsonc; grep -n '"service"' apps/web/wrangler.jsonc   # runclub-api in both
# Web: a production build with placeholders, then check what was inlined
printf '%s\n' 'VITE_API_URL=https://runclub-api.dry-run.invalid' 'VITE_SUPABASE_URL=https://dryrunref.supabase.co' \
  'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dryrun' 'VITE_STORE_URL=https://shop.example.com/runclub' > apps/web/.env.production
(cd apps/web && bun run build && bunx wrangler deploy --dry-run --outdir "$NOTES/dry-web")
grep -rl 'runclub-api.dry-run.invalid' apps/web/dist | head -3        # at least one hit
grep -rl 'localhost:8786\|127.0.0.1:55321' apps/web/dist              # nothing
# Mobile: go-live §4's own verification, with placeholders
printf '%s\n' 'EXPO_PUBLIC_API_URL=https://runclub-api.dry-run.invalid' 'EXPO_PUBLIC_SUPABASE_URL=https://dryrunref.supabase.co' \
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dryrun' 'EXPO_PUBLIC_STORE_URL=https://shop.example.com/runclub' > apps/mobile/.env.production
(cd apps/mobile && NODE_ENV=production bunx expo export --platform ios --no-bytecode --output-dir "$NOTES/dry-export")
grep -rl 'runclub-api.dry-run.invalid' "$NOTES/dry-export" | head -3   # at least one hit
grep -rl 'localhost:8786\|127.0.0.1:55321' "$NOTES/dry-export"         # nothing
rm apps/web/.env.production apps/mobile/.env.production                # placeholders must not outlive the check
# The seed refuses a remote target without the override, before any network call
SUPABASE_URL=https://example.supabase.co SUPABASE_SERVICE_ROLE_KEY=dummy bun run db:seed; echo "exit $?"   # "Refusing to seed non-local Supabase at https://example.supabase.co. …", exit 1
```

Also:
- Run go-live §1's key-extraction Python, unchanged, from an empty scratch directory against a fixture on stdin: `[{"name":"anon","api_key":"sb_publishable_x"},{"name":"service_role","api_key":"fixture"}]`. Expect a 3-line `.env.demo-seed` with mode `-rw-------` and `https://<ref>.supabase.co` left literal. Delete the directory afterwards.
- Copy every subshell block from go-live into `$NOTES/blocks/*.sh` and run `zsh -n` on each: no output.
- The migration chain `db push` would apply was already proven by Task 6's `db:reset` from zero. Record that as the stand-in.
- Do a static read of go-live against `README.md`'s Deploy section and make-it-yours steps 5–7. The expected findings are the Auth Site URL / redirect step (README has it, go-live does not) and the step 5 / §4.1 `eas init` overlap. Each finding is a skill fix only if the text is plainly wrong. Otherwise it goes into the report as "unverified, needs a production run".

The production leg is recorded as **not run**: every "needs an account" line goes into the report's open items.

---

## Phase C — the report

### Task 11: The acceptance report

**File:** Create `$WT/docs/superpowers/reports/<YYYY-MM-DD>-proof-run.md`. Sections:

1. **Verdict.** One paragraph: is a derivation "no longer barebones", with the evidence.
2. **The fork.** The inputs from Decisions 1–5, the SHA of `origin/main` it started from, and the clone source.
3. **Timings.** One table:

   | Skill | Run | Minutes (wall) | Minutes (minus pauses) | Deviations | Fix commit |
   | --- | --- | --- | --- | --- | --- |

   It has a row per run and a total for the clean path: setup, make-it-yours, customize-gathering, extend-profile, provision-tags, gate, simulator, go-live (or the dry run). Compare with M4's single-skill timings: provision-tags 2.5 min, extend-profile 10.5 min, make-it-yours 2 min.
4. **Deviations and fixes.** Per skill: what the text said, what happened, and the fix with its SHA. Mark each one as a text defect, an order-dependence, or an environment issue.
5. **Order-dependence.** O1–O4 and anything new. For each, say whether the skill now handles it, and state the order a forker should run the skills in.
6. **What a derivation gets for free, and what was still hand work.**
   - Free: the safety core and its RLS suite (the counts), the resolver, claim, consent, blocks, runs with membership and tag pointers, Connections, avatars, My tags, account deletion, the Merch pointer, provisioning, e2e and Playwright, CI.
   - Hand work the skills guided: the inventory of edits per skill (`git diff --stat` per tag range).
   - Hand work no skill covers: icon artwork, README prose, the store itself, a domain, SMTP, the Supabase Auth URLs (if found), EAS builds and store submission, physical encoding, a numeric gathering field (the static list from Decision 3).
7. **Known issues.** ENG-750, ENG-751, and ENG-752: did each one bite, and where. Plus any new Linear issues filed during the run.
8. **Go-live.** Which option Alex chose. Option 1: each checkpoint's result, the teardown evidence, and the cost incurred. Option 2: the labeled command list and the open items.
9. **Not covered.** add-destination-type, `readTagUid` on a physical chip, physical encoding, app-store builds, multi-tenant.

Commit: `git commit -m "Docs: the proof-run report (milestone 5)" …`.

### Task 12: Program status and spec pointer

- `docs/superpowers/program.md` Status: "Milestone 4: merged (PR #10, `<sha>`)", and "Milestone 5: PR #<n> (proof run; report: `reports/<date>-proof-run.md`)".
- Spec "Delivery" item 5: append "Done: see `../reports/<date>-proof-run.md`." That is a pointer, not a rewrite.
- After the merge (Task 15), Status gets "Program complete (`<merge sha>`)".

---

## Phase D — the PR

### Task 13: Cleanup and stack restore

```bash
(cd "$LINE" && bunx supabase stop --no-backup)        # stops runclub and drops its throwaway volumes; if the classifier blocks it, ask Alex to run it
for d in "$S"/proof-runclub*; do rm -rf "$d"; done
rm -rf "$HOME/withme-tags/local-"*                    # Task 5's encode lists (local, throwaway)
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(8786|3000|8796|9456|3010|8081) '   # nothing: stop leftover dev servers and Metro
(cd "$WT" && bun run db:start && bun run db:reset && bun run db:seed)        # withme-starter stack back, origin/main + the branch's (doc-only) changes
docker ps --format '{{.Names}}' | grep -c supabase_db_withme-starter          # 1
```

Also:
- Shut the simulator down (`xcrun simctl shutdown all`) and kill the agent-device daemon if it lingers.
- Keep `$NOTES` until the PR body is written (Task 14), then delete it.
- Report the stack restored to the program manager.

### Task 14: Gate, push, PR

```bash
cd "$WT"
bun run lint && bun run typecheck && bun run test        # identical counts to Task 0 (no app code)
git diff --name-only origin/main...HEAD                  # .agents/skills/**, docs/** only (README.md only if a fix needed it)
git push -u origin claude/proof-run
```

PR against `main`, titled `Proof run: a fresh clone through every skill and go-live (milestone 5)`. The body has:
- the spec link, ENG-748, and the report link;
- the fork's inputs;
- the timing table;
- the deviations and their fix commits, per skill;
- the order-dependences;
- Alex's go-live choice and its outcome (option 1's teardown evidence, or option 2's "production leg not run" list);
- the known issues that bit;
- what was skipped and why (add-destination-type, EAS build, physical tags, the numeric field);
- "no app code", with the `git diff --name-only` output;
- the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)` at the end.

### Task 15: Review, merge, report

1. Run `superpowers:requesting-code-review` over the diff (skills and docs), and handle the findings with `superpowers:receiving-code-review`. Resolve CodeRabbit's comments on their merits, pushing back where a suggestion contradicts a documented decision.
2. Merge with a **merge commit** once CI and CodeRabbit are clean.
3. Update Linear:
   - ENG-748 → Done, with the report link;
   - a project status update on P-ENG-39: the timings, the fixes, go-live's outcome, and "program complete";
   - ENG-749 gets the recorded decisions: the vertical, the field choice, the go-live option.
4. Post the milestone report to Alex (by push notification) with the verdict paragraph and the open items.
5. Commit program.md's "Program complete" line (Task 12) on a follow-up branch, or include it before the merge if the merge SHA is not needed. The program manager decides.
6. Update the memory notes: the app-shell direction note's resume point, plus a new technique note if the run taught one.

---

## Not in this milestone

- **add-destination-type**: not in the spec's sequence; a run club needs no new destination type.
- **add-marketing-site**: the spec lists it as a candidate after the proof run.
- **Fixing app defects** the run finds: each becomes a Linear issue under P-ENG-39.
- **A numeric gathering field**: covered as a static gap list in the report, unless Alex swaps it in (Decision 3).
- **EAS builds, store submission, a custom domain, encoding physical tags**: go-live and provision-tags do not cover them, or they need hardware.
- **A second proof run in another vertical.** If this report changes skills substantially, a follow-up run is a later decision.
