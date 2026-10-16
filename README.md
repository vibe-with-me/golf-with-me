# golfwithme

[![CI](https://github.com/vibe-with-me/golf-with-me/actions/workflows/ci.yml/badge.svg)](https://github.com/vibe-with-me/golf-with-me/actions/workflows/ci.yml)

**Tap a tag. Meet your four. Pencil them in.**

Golf With Me is an app for playing partners and club regulars. Put a tag
on your bag or your ball marker; someone taps it with their phone and sees
your card: your name, your handicap, your home course, and the round you
are hosting. One more tap and you are connected, or they have joined your
round.

It is built on [withme-starter](https://github.com/vibe-with-me/withme-starter),
the open-source starter for apps where people meet in person, and it keeps
the starter's privacy promises: nobody can browse golfers they have not
met, blocks are absolute and invisible, connections are mutual, and a tap
records nothing but a user agent and a time.

The stack is the starter's: TanStack Start and a Hono + oRPC API on
Cloudflare Workers, Supabase (Postgres, Auth, Storage), Expo for mobile,
Bun workspaces. The internal package names stay `@withme/*` so starter
fixes merge cleanly ([Staying current](docs/staying-current.md)).

## Run it locally

Prerequisites: [Bun](https://bun.sh), [Docker](https://www.docker.com/products/docker-desktop/)
(running), and the [Supabase CLI](https://supabase.com/docs/guides/cli)
2.118 or newer.

```sh
git clone https://github.com/vibe-with-me/golf-with-me.git
cd golf-with-me
bun install
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env
bun run db:start        # Supabase local on ports 553xx
bun run db:reset        # a clean database from the migrations
bun run db:seed         # demo golfers + tags
bun run dev             # api on :8786, web on :3000
```

Then:

- `http://localhost:3000/t/04BBBBBBBBBBBB` is Ada's tag. Her card invites
  you to the round she hosts.
- `http://localhost:3000/t/04AAAAAAAAAAAA` is an unclaimed tag. Sign up
  and claim it.
- Sign in as `ada@demo.golfwithme.local` / `golfwithme-demo-1` to see her
  round, her pending request from Lin, and her tags.

Mobile, the test suites, ports and troubleshooting are in
[Local development](docs/local-development.md). The verification gate is
`bun run lint && bun run typecheck && bun run test`, with
`SUPABASE_SERVICE_ROLE_KEY` exported as that page describes.

## How it was built

Each step was one of the starter's skills in [`.agents/skills/`](.agents/skills/),
in the order [docs/run-with-me.md](docs/run-with-me.md) uses:

1. `design-direction`: the look, recorded in [docs/brand-direction.md](docs/brand-direction.md).
2. `make-it-yours`: the rebrand.
3. `customize-gathering`: a gathering is a round.
4. `extend-profile`: handicap and home course on the card; phone for
   connections only.

[UPSTREAM-SNAGS.md](UPSTREAM-SNAGS.md) lists every place the starter's docs
fell short on the way, for fixing upstream.

## License

MIT for the code ([LICENSE](LICENSE)). The Vibe With Me name and marks are
not covered by the license: see [TRADEMARKS.md](TRADEMARKS.md).
