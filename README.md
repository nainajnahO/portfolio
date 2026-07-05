# Portfolio

A single-page portfolio: a big-type, colour-wash list of works with a quick-look
panel. Hovering (or focusing / tapping) a project tints the card to that
project's colour and updates the panel on the right.

Reproduced from a Claude Design exploration — "big-type color-wash list with
quick-look panel".

## Stack

Deliberately dependency-free — **no build step, no npm, no framework**:

- `index.html` — markup and all project content
- `styles.css` — styling, self-hosted `@font-face`, responsive + reduced-motion
- `main.js` — vanilla JS for the selection behaviour
- `images/` — per-project screenshots / social cards
- `fonts/` — self-hosted [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif)
  and [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (latin `woff2`,
  [OFL](https://openfontlicense.org/))

## Run it

Open `index.html` in a browser. That's it. For a local server:

```sh
python3 -m http.server
```

then visit <http://localhost:8000>.

## Edit the content

Each project is a `<button class="row">` in `index.html`. The visible name and
type are the button's text; the panel detail lives in `data-*` attributes:

```html
<button class="row js-row" type="button"
  data-name="PureLenz" data-type="iOS app" data-color="#7c6ff0"
  data-tech="Swift · SwiftUI · Core ML"
  data-desc="A minimalist iOS camera with tactile manual control…"
  data-img="images/purelenz.jpg"
  data-cta="View repo" data-url="https://github.com/nainajnahO/PureLenz">
  <span class="row__name">PureLenz</span>
  <span class="row__type">iOS app</span>
  <span class="row__arrow" aria-hidden="true">↗</span>
</button>
```

- `data-img` — a screenshot in `images/`, shown cover-fit in the quick-look
  panel. Omit it to fall back to the striped placeholder.
- `data-url` — the project's link (repo, site, App Store…).
- `data-color` — the type accent. In use: iOS app `#7c6ff0`, AI `#3a9669`,
  Data `#ab7d43`, Library `#8b93ab`, Game `#4f8ef7`. These were tuned from the
  source design so the active-name text clears WCAG AA contrast (muted label
  colour is `#797569`).

To add a project, copy a `<li>` block and drop a matching image into `images/`.

When you edit `styles.css` or `main.js`, bump the `?v=` in their `index.html`
tags (e.g. `styles.css?v=3`) so browsers fetch the new file instead of a cached
copy.
