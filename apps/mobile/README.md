# @withme/mobile

The Expo / React Native client — a thin client over `apps/api`, consuming the
same typed ORPC contract from `packages/contract` as the web app. No business
logic and no direct data access live here; every loader and mutation goes
through the API.

## Run it

Needs the local stack running (`bun run db:start`, `bun run db:seed`) and the
API worker (`bun run --filter @withme/api dev`).

```sh
cp apps/mobile/.env.example apps/mobile/.env   # local-stack defaults
bun run --filter @withme/mobile dev            # Metro; press i for iOS
```

The iOS simulator reaches the host's API and Supabase via `localhost`
directly. On a physical device, set `EXPO_PUBLIC_API_URL` /
`EXPO_PUBLIC_SUPABASE_URL` to your machine's LAN IP.

## NFC

NFC tag reading uses `react-native-nfc-manager`, a native module that needs a
development build (`npx expo run:ios` / EAS) — it is feature-gated, so in Expo
Go the scan screen falls back to manual UID entry and deep links. Tags encode
`https://<domain>/t/{UID}`; universal-link / app-link association is a
deployment step left to the consumer.

## Notes

- Auth: Supabase, tokens in the device keychain via `expo-secure-store`.
- Styling: plain `StyleSheet` against `lib/tokens.ts`, mirroring the web app's
  `tokens.css` (same palette, fonts, one-accent rule) — convertible to
  NativeWind by a forker who prefers it.
- This is a Bun-workspaces monorepo: Metro relies on Bun's hoisting (no custom
  `metro.config.js`). A single copy of each `expo-*` package is required —
  duplicate copies break native-module autolinking. The root `expo` override
  in the repo's `package.json` keeps it deduped.
