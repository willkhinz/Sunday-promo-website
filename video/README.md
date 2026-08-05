# Sunday promo clips

Remotion source for the three `data-clip` slots wired up in `js/main.js`
(`hero`, `answer`, `tune`) — recreations of the app's own UI, animated,
standing in for the still screenshots so the page shows Sunday actually
running rather than a static frame with motion applied to it.

```
npm install
npm run studio        # preview + scrub in the browser
npm run render:all     # render all three to video/out/*.mp4
```

Individual compositions: `npm run render -- hero out/hero.mp4`.

Remotion downloads and manages its own Chromium by default. In a sandbox
without network access for that download, point it at a Chromium/
headless-shell binary already on disk instead:
`REMOTION_BROWSER=/path/to/headless_shell npm run render:all`.

## Fonts

Inter and JetBrains Mono ship as local `.woff2` files under `public/fonts`
and load via the `FontFace` API in `src/fonts.ts` — deliberately not
`@remotion/google-fonts`, which fetches over the network at render time.

## After rendering

`out/*.mp4` need a matching `.webm` (VP9) and both need to land in
`../assets/video/` under the names `main.js` already expects:

| composition | mp4 in `out/` | deploy as |
|---|---|---|
| `hero`   | `hero.mp4`   | `assets/video/hero-answer.{mp4,webm}` |
| `answer` | `answer.mp4` | `assets/video/offline.{mp4,webm}` |
| `tune`   | `tune.mp4`   | `assets/video/tune.{mp4,webm}` |

```
ffmpeg -i out/hero.mp4 -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 -pix_fmt yuv420p -an out/hero.webm
```
