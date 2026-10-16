# Brand direction — golfwithme (Golf With Me)

Direction: Pencilled in (D), chosen 2026-10-16 by Alex Eisele from a canvas of four directions (Dew line, Tee sheet, Golf pencil, Pencilled in), each drawn as the resolver card, the Rounds shell and the landing page in light and dark (private link, owner only).
Vertical: a golf app for playing partners and club regulars; people tap a tag on a bag or ball marker to see who you are and join your round. Mood: dew, pencil, first tee.

A scorecard after the round. Names are written in by hand, in graphite, the way you pencil in your group on the first tee. The one accent is birdie red, the circle you draw around a score under par. It steers away from the country-club look (hunter green, gold serif, crests, tartan) on purpose.

## Names

| wordmark | display name | reverse-domain id | scheme |
| --- | --- | --- | --- |
| golfwithme | Golf With Me | co.golfwithme.app | golfwithme |

Wordmark treatment: lowercase, Caveat 700, no tracking (`letter-spacing: 0`), one setting for the whole word.

## Colors (make-it-yours step 1: tokens.css `:root` / `tokens.ts` `light`, and the dark block / `dark`)

| token | light | dark |
| --- | --- | --- |
| bg | #eeebe1 | #131314 |
| surface | #fdfcf7 | #222224 |
| border | rgba(38, 38, 42, 0.1) | rgba(236, 234, 226, 0.1) |
| border-input | rgba(38, 38, 42, 0.5) | rgba(236, 234, 226, 0.5) |
| ink | #26262a | #eceae2 |
| ink-muted | #63625d | #a3a199 |
| accent | #c42a1f | #ff6b5b |
| accent-ink | #ffffff | #2b0703 |

Splash and adaptive-icon backgrounds (`apps/mobile/app.json`): light `#eeebe1`, dark `#131314`, as above.

Contrast, as `contrast.ts` reported it on 2026-10-16:

```text
ok   accent-ink on accent (light): #ffffff on #c42a1f = 5.68:1 (min 4.5:1)
ok   ink on surface (light): #26262a on #fdfcf7 = 14.68:1 (min 4.5:1)
ok   ink on bg (light): #26262a on #eeebe1 = 12.64:1 (min 4.5:1)
ok   ink-muted on surface (light): #63625d on #fdfcf7 = 5.95:1 (min 4.5:1)
ok   ink-muted on bg (light): #63625d on #eeebe1 = 5.12:1 (min 4.5:1)
ok   border-input on surface (light): rgba(38, 38, 42, 0.5) on #fdfcf7 = 3.06:1 (min 3:1)
ok   accent-ink on accent (dark): #2b0703 on #ff6b5b = 6.62:1 (min 4.5:1)
ok   ink on surface (dark): #eceae2 on #222224 = 13.18:1 (min 4.5:1)
ok   ink on bg (dark): #eceae2 on #131314 = 15.42:1 (min 4.5:1)
ok   ink-muted on surface (dark): #a3a199 on #222224 = 6.14:1 (min 4.5:1)
ok   ink-muted on bg (dark): #a3a199 on #131314 = 7.18:1 (min 4.5:1)
ok   border-input on surface (dark): rgba(236, 234, 226, 0.5) on #222224 = 4.36:1 (min 3:1)
```

## Fonts (make-it-yours step 2)

| role | family | web package | mobile package |
| --- | --- | --- | --- |
| display | Caveat | @fontsource-variable/caveat (5.3.0) | @expo-google-fonts/caveat (0.4.2) |
| body | IBM Plex Sans | @fontsource-variable/ibm-plex-sans (5.3.0) | @expo-google-fonts/ibm-plex-sans (0.4.1) |

A fresh starter ships Space Grotesk for display and Inter for body. Both rows change.

Caveat is a handwriting face with a small x-height: at the same font size it reads about a quarter smaller than a grotesk. The boards set display text and the wordmark 1.3–1.4× larger than the starter's sizes. Weight 700 throughout for display (names, titles, the wordmark); body text stays Plex Sans so the app still reads as a tool.

## Copy (make-it-yours step 3 and 7)

| screen | file | line |
| --- | --- | --- |
| landing promise | apps/web/src/routes/index.tsx | Tap a tag. Meet your four. Pencil them in. |
| Merch card | apps/web/src/routes/_app.merch.tsx, apps/mobile/app/(tabs)/merch.tsx | Ball markers, bag tags and divot tools. |
| NFC permission | apps/mobile/app.json nfcPermission | Read Golf With Me tags to connect with golfers. |
| photo permission | apps/mobile/app.json photosPermission | Choose a photo for your profile. |

No store yet: the Merch tab and the landing page's "Get tags" button stay hidden until a store URL is set; the Merch line above is ready for when one is.

## Artwork (make-it-yours step 8)

- The mark: a pencilled lowercase "g" (Caveat 700, outlined to a path) inside a loose, hand-drawn birdie circle that overlaps itself where the pencil started, on scorecard stock.
- `docs/brand/icon.svg` (light: `#eeebe1` ground, `#c42a1f` circle, `#26262a` letter) and `docs/brand/icon-dark.svg` (dark: `#131314` ground, `#ff6b5b` circle, `#eceae2` letter), in the layout `docs/brand/render.sh` requires. make-it-yours step 8 copies them in and runs the script.
- `apps/mobile/assets/icon.png` 1024×1024, no alpha: the light source, full bleed.
- `apps/mobile/assets/android-icon-foreground.png`: the mark alone on transparent; render.sh scales it into the central 66% (the circle's outer edge sits about 245px from center, inside the 338px safe radius). It reads on the light bg.
- `apps/web/public/favicon.ico` and `favicon.svg`: from the light source; `favicon.svg` is hand-written and gets the same colors by hand.

## Not this

- No green anywhere: hunter green with gold serif type, crests and tartan are what every golf app looks like.
- No second accent: a pencil-yellow highlight for "hosting" and a fairway green for "going" were both tempting, and both break the one-accent rule. Birdie red is on the primary button only.
- No handwriting in body text, buttons or form labels: Caveat is for names, titles and the wordmark. A handwritten "Join this round" would be harder to read and look like a toy.
- Handicap and home course on the card were drawn dashed as a proposal; they arrive with `extend-profile`, not with the rebrand.
