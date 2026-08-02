# Sunday — promo website

Mobile-first landing page for [Sunday](https://apps.apple.com/us/app/sundayai/id6777877980),
a private AI assistant that runs Google's Gemma 4 entirely on-device via MLX.

Static HTML/CSS/JS. No build step, no dependencies — open `index.html` or serve
the directory and it runs.

```
python3 -m http.server 8000
```

## Structure

```
index.html            markup + copy
css/style.css         mobile-first styles, single black theme
js/main.js            scroll reveals, sticky CTA, carousel dots
assets/img/           web-optimised WebP used by the page (~455 KB total)
assets/screenshots/   original 1206×2622 captures, kept as source of truth
assets/favicon.svg
```

## Sections

Hero · capability grid (the eleven verbs from the App Store listing) ·
swipeable screenshot carousel · privacy · under-the-hood specs · closing CTA.

Single conversion goal throughout: the App Store link. On mobile a sticky
download bar appears once the hero scrolls away; on desktop the header CTA
takes over.

## Images

`assets/img/*.webp` is generated from `assets/screenshots/*.PNG` — resized to
640px wide at quality 82, which takes the set from ~2.6 MB to ~455 KB.

The hero capture (`chat-hero.webp`) is a special case: the source had an 807px
band of empty black between the nav bar and the first message, so that band is
collapsed to 180px before resizing. It therefore carries a different aspect
ratio (`640/1059`) from the uniform carousel frames (`640/1391`), set via the
`.phone-hero` class.

To regenerate after adding screenshots, re-run the resize with the same
parameters and keep the canonical aspect so carousel frames stay uniform.

## Known gaps

- No screenshot yet for **Look it up** (live web search) or a clean
  **Calculate** result — both are described in the feature grid but not shown
  in the carousel.
- The Read and Thinking Mode captures show unrendered Markdown and LaTeX
  (`###`, `**bold**`, `$\frac{1}{2}gt^2$`) coming from the app itself.
- Status bar times and battery levels differ across captures.
