# timmora.github.io

My personal portfolio. Hand-built static site — no framework, no build step, no
dependencies to install.

Live at **[timmora.github.io](https://timmora.github.io)**.

## Stack

Plain HTML, CSS, and JavaScript. The only external dependency is
[Lenis](https://lenis.darkroom.engineering/) for smooth scrolling, loaded from a
CDN and used only where a fine pointer is present — touch devices keep native
scrolling and native momentum.

Type is Instrument Serif and DM Sans, loaded from Google Fonts.

## Running it

There's nothing to build. Open `index.html` directly, or serve the folder if you
want the clean URLs (`/about` rather than `/about.html`) to resolve the way they
do in production:

```
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Structure

```
index.html          Home — hero, folder stack, toolkit overlay
about.html          About
blog.html           Blog — envelopes that open into articles
ordo.html           Case study — AI study planner
holoorbits.html     Case study — multiplayer classroom simulation
jennyfigment.html   Case study — client site for a children's book author
brandle.html        Case study — daily brand-guessing game
aporia.html         Case study — values-based portfolio generator
styles.css          All styles (~3.5k lines)
app.js              All behavior (~1k lines)
images/             Screenshots, captures, OG images
```

Every page shares `styles.css` and `app.js`. There is no per-page CSS or JS.

## Conventions

A few things that aren't obvious from skimming the source:

- **Breakpoints are ad-hoc, not a system.** Media queries sit next to the rules
  they modify rather than being collected in one place, and the widths are
  chosen per component where that component actually breaks. When adding
  responsive rules, fill in an existing block rather than introducing a new
  breakpoint.
- **Comments explain why, not what.** Most of the longer comments in `app.js`
  and `styles.css` exist because the obvious approach failed for a specific
  reason — iOS `:active` needing a touch listener to fire, Lenis needing to stop
  for overlays because it drives `window.scrollTo`, deep bottom padding on the
  hero tabs so their squared edges stay below the clip. They're worth reading
  before changing the thing they sit above.
- **Progressive enhancement where it's cheap.** Case-study deep dives are real
  `<details>` elements that work without JS; the folder cards are real anchors,
  so middle-click and keyboard activation are the browser's job.
- **Motion respects `prefers-reduced-motion`**, and the palette has explicit
  light and dark definitions.

## Deployment

GitHub Pages builds from `main`. Pushing to `main` deploys.

## License

The code is MIT licensed — see [LICENSE](LICENSE). Take the CSS, the scroll
handling, the animation code, whatever's useful.

The content is not. Written copy, images, screenshots, case studies, the résumé,
and the design itself are © Tim Mora, all rights reserved. Please don't
republish the site as your own portfolio.
