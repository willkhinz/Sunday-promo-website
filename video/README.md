# Sunday promo clips

Remotion source for the three `data-clip` slots wired up in `js/main.js`
(`hero`, `answer`, `tune`), so the page can show Sunday actually running
instead of a still with motion applied to it.

## How these are built

Nothing here redraws the app. Each clip is the real App Store capture from
`assets/img/`, taken apart and reassembled:

1. `scripts/extract.py` reads a capture, finds the parts that should move
   (the two chat bubbles; the settings sections) from its own pixel bands,
   and writes out
   - a **plate** — the capture with those parts painted out to the page
     background, which is pure black in every one of these screens, and
   - **sprites** — the same parts cropped from the untouched file, each with
     a few pixels of margin so it carries its own anti-aliased outline.
2. It records the geometry in `src/plates.json`: where each sprite belongs,
   the bubble's edges, and every text line's box inside the answer bubble.
3. The compositions animate the sprites back onto the plate at their exact
   coordinates.

So the status bar, nav bar, composer, type, and bubble geometry are the
app's own pixels. Each clip ends on the capture **pixel for pixel** — worth
re-checking after any change:

```
python3 scripts/verify.py
```

## Clips

| slot | composition | capture | what moves |
|---|---|---|---|
| `hero` | `src/Hero.tsx` | `chat-hero.webp` | question lands, then the answer streams a line at a time, each wiped left to right |
| `answer` | `src/Answer.tsx` | `chat.webp` | the same, on the full-height frame |
| `tune` | `src/Tune.tsx` | `settings-model.webp` | the settings sections deal in, staggered |

The answer reveal steps through the capture's own line breaks, so a row of
text is never cut through the middle; the part of the line not yet "typed"
is covered by the bubble's own fill colour, and the bubble's real bottom
padding and rounded corners ride along underneath as it grows.

## Rendering

```
npm install
npm run studio         # preview + scrub in the browser
npm run render:all     # all three to video/out/*.mp4
```

Remotion downloads and manages its own Chromium by default. In a sandbox
without network access for that download, point it at a Chromium or
headless-shell binary already on disk:
`REMOTION_BROWSER=/path/to/headless_shell npm run render:all`.

Regenerate the plates and sprites (only needed if a capture changes, or to
adjust which regions move) with `python3 scripts/extract.py` — it needs
Pillow, and rewrites `public/plates/` and `src/plates.json`.

## After rendering

Each `out/*.mp4` needs a matching `.webm` (VP9), and both go to
`../assets/video/` under the names `main.js` already expects:

| composition | deploy as |
|---|---|
| `hero`   | `assets/video/hero-answer.{mp4,webm}` |
| `answer` | `assets/video/offline.{mp4,webm}` |
| `tune`   | `assets/video/tune.{mp4,webm}` |

```
ffmpeg -i out/hero.mp4 -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 -pix_fmt yuv420p -an out/hero.webm
```
