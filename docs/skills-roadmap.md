# Skills roadmap — extension recipes, not features

Decided 2026-06-11 (Alex + Claude session). Status: agreed, not started.

## The strategy

The starter's code stays pure handshake (the V1 invariant: nothing that ranks,
recommends, aggregates, or monetizes). Growth beyond the handshake ships as
**agent-executable skills** in `.agents/skills/` — recipes a forker (or their
AI agent) runs in their own fork. The starter provides functionality aligned
with the foundation without being accountable for feature outcomes. Skills are
also how the safety culture (RLS-first, no enumeration, block-respect, tenant
seam) survives extension: each skill bakes the discipline into what it scaffolds.

Rejected on the way here: a merch/Shopify tab — it violates the invariant, is
explicitly out of scope in the V1 spec, and open-sources the commercially
reserved layer (tag fulfillment IS the business; the starter is demand-gen).
Approved alternatives: a configurable "Get tags" fulfillment pointer defaulting
to withme's store (≈20 lines, dormant-seam pattern), and the provision-tags
operator skill below.

## Hard constraints on every skill

1. **Generic primitives, never VWM transplants** — the rewrite-don't-copy rule
   extends to skills. "Gathering," not VWM shows; "posts," not pulse.
2. **Build once, distill, discard** — implement the feature for real in a
   scratch fork, run the full review treatment (CodeRabbit + agents), THEN
   extract the skill from the working implementation. Never write a skill from
   imagination.
3. **Shared slice doc** — all skills reference one `the-slice.md` describing
   the canonical extension slice: contract → migration + RLS → RLS tests →
   API handlers → web route → mobile screen (card idiom) → e2e. Skills stay
   short; the discipline lives in one place.
4. **Skill rot mitigation** — skills target a settled substrate; periodically
   re-run each against a fresh clone (candidate for a scheduled monthly agent).

## The set, in build order

### Tier 1 — seam exercisers (cheap; can land before the public flip)
1. **make-it-yours** — rebrand/vertical: design tokens (web `tokens.css` +
   mobile `lib/tokens.ts` in lockstep), the one accent, fonts, wordmark, app
   name/scheme/bundle IDs, copy. Configuration only; no scratch fork needed.
   Proves "theming is a token swap."
2. **add-destination-type** — the spine. Full ripple of growing the destination
   union: contract member → CHECK-constraint migration → `resolve_tag` branch →
   web/mobile resolver rendering → SDK type-parity test. Worked example in the
   skill text is `{ type: 'link' }` (tag → URL redirect); the example does NOT
   get added to the starter itself. build-gathering depends on this pattern.

### Tier 2 — feature builders (build-once-distill method; wait for substrate to settle)
3. **onboarding** — profile extension + completion gating: vertical-specific
   profile fields, post-signup step flow, and **two-tier field visibility**
   (public card fields vs connections-only fields — touches the RLS visibility
   model; the part forkers get wrong alone). Likely the most-run skill.
4. **build-gathering** — entity + membership + consent + RLS; integrates via
   `{ type: 'gathering', gathering_id }` destination (tap the tag at the door,
   join the gathering). The flagship.
5. **build-feed** — posts scoped to a gathering or to connections. Constraints
   as NON-NEGOTIABLES encoded in the skill: chronological only, scoped
   visibility, block-respecting RLS, no ranking, no recommendation.

### Tier 3 — operator runbooks (independent; slot anywhere)
6. **go-live** — agent-executable deploy runbook (supabase link/push, Worker
   secrets not vars, deploy ordering via the service binding, hosted JWKS,
   tag encoding). Every pothole here was hit live in the 2026-06-11 demo deploy.
7. **provision-tags** — batch-provision UIDs, emit encode list
   (`https://<domain>/t/{UID}` per tag), printable sheet. Pairs with the
   fulfillment pointer.

### Deferred / skipped
- **add-notifications** (push for request-received/accepted): real handshake
  need but infra-heavy; if built, transactional only, never engagement. Revisit
  after the first five.
- **analytics skill**: skipped permanently — PostHog ships its own instrument-*
  skills; the starter's no-telemetry stance is part of its identity.

## Sequencing vs. the rest of the roadmap

Currently ahead of skills work, per earlier session decisions:
1. Physical tag tap (encode NTAG213 → provision UID in demo DB → tap) — the
   last unverified claim of the thesis.
2. First npm release of @withme/nfc (`nfc-v0.1.0` tag; needs NPM_TOKEN secret,
   @withme scope, LICENSE placeholder filled).
3. Open-sourcing checklist as one deliberate session: license decision
   (MIT vs Apache-2.0) + trademark review, CONTRIBUTING + templates, public
   flip, demo links into README. Note: local-dev `sb_secret_` strings in test
   files will trip secret scanners — move to env-only first or expect noise.
4. V1.1 product gaps (post-demo-feedback): account-deletion UI in /me,
   universal links/AASA so taps open the mobile app, avatar uploads
   (Supabase storage currently disabled), request-expiry cron, dev build with
   real NFC hardware.

Tier 1 skills may land before the public flip (stronger launch story);
Tier 2 waits for items 1–3.
