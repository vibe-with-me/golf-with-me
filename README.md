# Golf With Me

[![CI](https://github.com/vibe-with-me/golf-with-me/actions/workflows/ci.yml/badge.svg)](https://github.com/vibe-with-me/golf-with-me/actions/workflows/ci.yml)

**Meet your playing partners, and keep them.**

You meet good people on the course and lose them by the eighteenth green.
With Golf With Me, you tap someone's bag tag or scan their code, no app
needed, and you see their card: name, handicap, home course, and the round
they're hosting. Ask to connect, and once they accept you stay connected:
their links unlock, and you can join each other's rounds.

It's the first remix of
[withme-starter](https://github.com/vibe-with-me/withme-starter), the
open-source starter for apps where people meet in person. Most of what's
here is the starter's, so its README and docs cover the shared building
blocks; this page covers what's golf.

**See it:** [Ada's card on the staging demo](https://staging.golfwithme.co/t/04BBBBBBBBBBBB),
which is what a tap or scan of her tag opens.

## What it does

- **A card for your bag.** Put a tag on your bag or ball marker; a tap
  or scan opens your card. A stranger sees your name, photo, handicap and
  home course, and which platforms you're on, not the links themselves.
- **Connect.** Ask, they accept, and your links (a phone number among
  them) unlock for each other only. Either side can end it quietly.
- **Rounds.** Host a round with a course and a tee time. A round is a
  foursome at most. The Rounds tab has a tee sheet of upcoming rounds and
  a list of yours, and who's playing shows you only the people you know.
- **Web and mobile.** A web app and an Expo app over one API, with the
  starter's blocks, reports and account deletion.

## Relationship to the starter

Golf With Me was built by running the starter's skills in order, the way
any fork would: `design-direction`, `make-it-yours`,
`customize-gathering`, `extend-profile`.
[Building on the starter](docs/building-on-the-starter.md) records every
place the starter's docs fell short on the way; each one was fixed
upstream.

**What golf changes:**

- **A gathering is a round.** Every round names its course, and holds two
  to four players (four if the host doesn't say). The database enforces
  both, not just the form.
- **The card has a handicap and a home course.** Both show to anyone who
  taps or scans; a phone number is a Link, so only connections see it.
- **The name and look.** The "Pencilled in" direction in
  [docs/brand-direction.md](docs/brand-direction.md), with the mark in
  [docs/brand/](docs/brand/), and golf's own app identity and local
  database name.
- **A few follow-up migrations** (`*_golf_after_*.sql` in
  [supabase/migrations/](supabase/migrations/)) that put golf's fields
  back on starter functions a sync redefined.

**What stays identical:** the privacy model and the policy tests that
prove it, in [packages/db/test/](packages/db/test/). Golf adds tests for
its own fields and the foursome limit; it changes no starter boundary.
Internal names stay the starter's (`gathering` in code, `@withme/*`
packages) so starter fixes merge cleanly.

**Pulling starter updates:** the starter is a git remote, and each update
is an ordinary merge on a branch, merged with a merge commit (never a
squash). `bun run sync:check` lists incoming starter migrations that would
override one of golf's. [Staying current](docs/staying-current.md) is the
whole routine.

**The name:** the code is MIT, but Golf With Me and golfwithme are Vibe
With Me LLC's marks. A fork of this repo needs its own name and look;
[TRADEMARKS.md](TRADEMARKS.md) says what that means.

## Try it locally

Needs [Bun](https://bun.sh), [Docker](https://www.docker.com/products/docker-desktop/)
(running), and the [Supabase CLI](https://supabase.com/docs/guides/cli)
2.118 or newer.

```sh
git clone https://github.com/vibe-with-me/golf-with-me.git
cd golf-with-me
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env
bun run db:start        # Supabase on ports 553xx, so it can run beside the starter
bun run db:reset
bun run db:seed
bun run dev             # api on :8786, web on :3000
```

Then:

- `http://localhost:3000/t/04BBBBBBBBBBBB` is Ada's tag: her card, with
  her handicap and home course, and her links locked behind Connect.
- `http://localhost:3000/t/04AAAAAAAAAAAA` is an unclaimed tag. Sign up
  and claim it.
- Sign in as `ada@demo.golfwithme.local` / `golfwithme-demo-1` to see the
  round she's hosting, Lin's request to connect, and her tags.

Mobile, the test suites (the RLS tests need `SUPABASE_SERVICE_ROLE_KEY`
exported) and fixes for a first run that goes wrong are in the starter's
[Local development](https://github.com/vibe-with-me/withme-starter/blob/main/docs/local-development.md);
everything there applies here, with golf's ports and demo accounts above.

## Go further

The shared building blocks are documented once, in the starter:

- [Building blocks](https://github.com/vibe-with-me/withme-starter/blob/main/docs/building-blocks.md)
  and [the glossary](https://github.com/vibe-with-me/withme-starter/blob/main/docs/glossary.md): a tour of the code, and the words.
- [The safety model](https://github.com/vibe-with-me/withme-starter/blob/main/docs/safety-model.md): each privacy promise and the test that proves it.
- [The stack, and why](https://github.com/vibe-with-me/withme-starter/blob/main/docs/stack.md).
- [The skills](https://github.com/vibe-with-me/withme-starter/tree/main/.agents/skills),
  and [`feature-dev`](https://github.com/vibe-with-me/withme-starter/blob/main/.agents/skills/feature-dev/SKILL.md) for a feature no skill covers.
- [NFC tags](https://github.com/vibe-with-me/withme-starter/blob/main/docs/nfc-tags.md): the chip, encoding, and why the domain you encode is forever.

## What this is not

No matching, no recommendations, no feeds of people. The tee sheet lists
rounds in time order, and that's all. Software that decides who you
should play with is a different product, and the privacy promises depend
on not building one.

## Contributing

Issues and PRs are welcome, on a best-effort basis. A fix that isn't
specific to golf (a policy gap, a broken skill step) belongs in the
[starter](https://github.com/vibe-with-me/withme-starter), and comes back
here with the next sync. Start with [CONTRIBUTING.md](CONTRIBUTING.md),
and report vulnerabilities privately as [SECURITY.md](SECURITY.md)
describes.

## License

MIT for the code ([LICENSE](LICENSE)). The Golf With Me and Vibe With Me
names and marks are not covered: see [TRADEMARKS.md](TRADEMARKS.md).
