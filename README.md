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
- `main.js` — ~40 lines of vanilla JS for the selection behaviour
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
  data-name="weather-vis" data-type="Website" data-color="#4f8ef7"
  data-tech="D3.js · Node · WebSockets"
  data-desc="Real-time weather dashboards…"
  data-cta="Visit site" data-url="https://example.com">
  <span class="row__name">weather-vis</span>
  <span class="row__type">Website</span>
  <span class="row__arrow" aria-hidden="true">↗</span>
</button>
```

Set `data-url` to the project's real link (it defaults to `#`). Colours are
grouped by type: Website `#4f8ef7`, Data report `#ab7d43`, iOS app `#7c6ff0`,
ML `#3a9669`, Tooling `#8b93ab`. Data report and ML were darkened slightly from
the source design (and the muted label colour deepened to `#797569`) so the
active-name and label text clear WCAG AA contrast.

> The projects and the "Your Name" heading are placeholder sample data from the
> design — swap in your own.
