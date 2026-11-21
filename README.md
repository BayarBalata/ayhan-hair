# Ayhan — Hair

One-page site for Ayhan, barber & hair artist. Dark, monochrome, one drop of red.

## Run locally

ES modules need a server (opening `index.html` as a file won't work):

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Live site

https://bayarbalata.github.io/ayhan-hair/ is published with GitHub Pages from the `main` branch. Push to `main` and the site updates in about a minute.

## What's inside

- `index.html` — all sections and the SVG tattoo artwork
- `assets/css/style.css` — design tokens, layout, mobile-first breakpoints (900px / 480px / 360px)
- `assets/js/main.js` — preloader, smooth scroll (Lenis), GSAP ScrollTrigger scenes, cursor
- `assets/js/stage.js` — fixed WebGL layer: chrome shears (the hero "cut"), steel comb, straight razor
- `assets/js/dice.js` — the RISK → RICH dice tattoo in WebGL
- `assets/vendor/` — GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13, three.js r160 (local copies, no CDN needed)
- `assets/img/` — black & white photos from Unsplash (see `CREDITS.md`)

## To fill in before launch

- **Real photos of Ayhan's work** — the Lookbook and Services images are stock references. Replace files in `assets/img/` (keep names) or edit the `src`/`data-img` attributes.
- **Address, hours, phone** — there's a commented block in the `#book` section of `index.html`.
- **Prices** — services currently show durations only.
