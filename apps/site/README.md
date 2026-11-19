# golfwithme.co placeholder

A single static page served at the apex until the production web app takes
it over. It is a static-assets Worker (`golfwithme-site`) with no code and no
`package.json`, so it stays out of the bun workspace and `turbo run deploy`.

Deploy from the repo root:

```bash
apps/web/node_modules/.bin/wrangler deploy -c apps/site/wrangler.jsonc --domain golfwithme.co --domain www.golfwithme.co
```

This is a stopgap. The real marketing site (home, privacy and support pages,
built on the web app's tokens) comes from the `add-marketing-site` skill in
`.agents/skills/`, which replaces this folder.

When production web is ready, detach these domains from `golfwithme-site`
(dashboard → Workers → golfwithme-site → Domains) and attach them to the web
worker.
