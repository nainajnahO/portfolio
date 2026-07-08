// Gen X Soft Club portfolio — 3D project wheel.
// No dependencies, no build step. Ported from the design's React logic
// (PortfolioSite.dc.html on claude.ai/design) to vanilla JS.

// The real portfolio. `meta` is the tech stack (shown on the face + in the
// controls pill); `img`/`cta` are used only by the enlarged preview card.
const projects = [
  { meta: 'Swift · SwiftUI · Core ML', title: 'PureLenz', blurb: 'A minimalist iOS camera with tactile manual control over ISO and shutter speed. On-device Core ML learns your style and adapts as you shoot.', img: 'images/purelenz.jpg', cta: 'View repo', url: 'https://github.com/nainajnahO/PureLenz' },
  { meta: 'React · TypeScript · Supabase · Three.js', title: 'forskapong', blurb: 'The live site and tournament engine for Tentafestivalen Beerpong (Uppsala, 2026) — a 3D landing page and venue map up front, with a Swiss-plus-knockout bracket engine, live scoreboard, and admin tooling on Supabase behind it.', img: 'images/forskapong.jpg', cta: 'Visit site', url: 'https://rollnsolution.com' },
  { meta: 'JavaScript · Chart.js · 98.css', title: 'Bolånekalkyl', blurb: 'A calculator for how a Swedish mortgage plays out over decades — change any value and the debt, monthly cost, and total interest update live; compare scenarios side by side and model rate changes at chosen years. Dressed as Windows 98, on purpose.', img: 'images/bolanekalkyl.png', cta: 'Open calculator', url: 'https://nainajnaho.github.io/Bolanekalkyl/' },
  { meta: 'FastAPI · pgvector · Voyage · Anthropic', title: 'rag-knowledge-base', blurb: 'A retrieval-augmented knowledge base — upload documents, run hybrid search, and chat with answers backed by verifiable citations.', img: 'images/rag-knowledge-base.png', cta: 'View repo', url: 'https://github.com/nainajnahO/rag-knowledge-base' },
  { meta: 'Python · Claude API · Gradio', title: 'Dr. Fungi', blurb: 'A multimodal LLM chatbot built on the Claude API with a Gradio interface — converse over both text and images.', img: 'images/dr-fungi.png', cta: 'View repo', url: 'https://github.com/nainajnahO/Dr.-Fungi' },
  { meta: 'Python · Jupyter · scikit-learn', title: 'trump-tweet-analysis', blurb: "A data study of Trump's tweets — engagement patterns, temporal trends, and clustering, told through a set of visualisations.", img: 'images/trump-tweet-analysis.png', cta: 'View repo', url: 'https://github.com/nainajnahO/trump-tweet-analysis' },
  { meta: 'Python · pandas · NumPy', title: 'Rhoa', blurb: 'A pandas DataFrame extension that adds technical-analysis accessors — indicators and signals, straight on your dataframe.', img: 'images/rhoa.png', cta: 'View repo', url: 'https://github.com/nainajnahO/Rhoa' },
  { meta: 'Haskell', title: 'WordleHaskell', blurb: 'A terminal Wordle clone written in Haskell for a Program Design & Data Structures course.', img: 'images/wordlehaskell.png', cta: 'View repo', url: 'https://github.com/nainajnahO/WordleHaskell' },
];

// The wheel is an 8-sided cylinder: faces every 45°, one project per face, so a
// card is always approaching (8 × 45° covers the full 360°).
const FACES = 8;
const STEP = 45;
// Cylinder depth (px), tightened from the design's 520 to 340 so the 8 faces
// (45° apart) sit as a close fan instead of splaying out to the stage edges. The
// wheel is drawn at a uniform --wheel-scale so it fits shorter laptops. RADIUS is
// the scaled depth used per frame; it MUST stay in lockstep with the CSS ring
// translateZ (`-340px * var(--wheel-scale)` in styles.css) or the front card
// stops registering at z=0 and the golden-eye placement drifts.
const BASE_RADIUS = 340;
let RADIUS = BASE_RADIUS;

const stage = document.querySelector('.js-stage');
const workEl = document.getElementById('work');       // the whole wheel unit (positioning ctx for the preview)
const heroCopy = document.querySelector('.hero__copy');
const ring = document.querySelector('.js-ring');
const faceTemplate = document.querySelector('.js-face-template');
const activeMetaEl = document.querySelector('.js-active-meta');
const counterEl = document.querySelector('.js-counter');

// The enlarged preview above the wheel: a clone of just the .card (no .face
// anchor, so it never becomes a tab stop), refilled from `projects` on settle.
const previewEl = document.querySelector('.js-preview');
const previewCard = faceTemplate.content.querySelector('.card').cloneNode(true);
previewEl.append(previewCard);

// The preview mirrors the settled front project; clicking it opens that project's
// link in a new tab — matching the faces' target="_blank". The big card is the
// obvious target, whereas the real <a> is the smaller face below (kept for
// keyboard/screen-reader users).
previewCard.addEventListener('click', () => {
  const url = projects[frontActiveIdx()].url;
  if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
});

// Warm the browser cache with every screenshot up front. The preview card swaps
// its image on each settle; without this, a card would visibly load in as the
// wheel lands on it (the old placeholders had no images, so nothing ever loaded).
projects.forEach((p) => { new Image().src = p.img; });

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const faces = Array.from({ length: FACES }, (_, i) => {
  const project = projects[i % projects.length];
  const el = faceTemplate.content.firstElementChild.cloneNode(true);
  el.href = project.url;
  el.querySelector('.card__meta').textContent = project.meta;
  el.querySelector('.card__title').textContent = project.title;
  el.querySelector('.card__blurb').textContent = project.blurb;
  el.addEventListener('click', (e) => onFaceClick(e, i));
  ring.append(el);
  return el;
});

let angle = 0;
let raf = null;
let drag = null;
let moved = 0;
let suppressClick = false;
let wheelTimer = null;

// Map an angle to [-180, 180) so faces on the far side stay hidden.
const normalize = (a) => ((a % 360) + 540) % 360 - 180;

// Which project sits at the front of the wheel right now.
function frontActiveIdx() {
  const front = ((Math.round(angle / STEP) % FACES) + FACES) % FACES;
  return front % projects.length;
}

function fillCard(cardEl, p) {
  cardEl.querySelector('.card__meta').textContent = p.meta;
  cardEl.querySelector('.card__title').textContent = p.title;
  cardEl.querySelector('.card__blurb').textContent = p.blurb;
  // Only the enlarged preview card shows the screenshot + CTA (faces hide both).
  const img = cardEl.querySelector('.card__shot-img');
  img.src = p.img;
  img.alt = `${p.title} — screenshot`;
  cardEl.querySelector('.card__cta').textContent = `${p.cta} →`;
}

// Update the enlarged preview to the settled project. The card is a stable panel:
// always visible, only its content changes. Called whenever the wheel settles; the
// screenshots are preloaded, so the swap is instant with no visible load. (It used
// to tuck away — slide + fade out — on every move and rise back on settle, but with
// real screenshots that read as the card "reloading" and left a gap mid-spin.)
function settlePreview() {
  fillCard(previewCard, projects[frontActiveIdx()]);
}

function render() {
  faces.forEach((el, i) => {
    const rel = normalize(i * STEP - angle);
    const c = Math.cos(rel * Math.PI / 180);
    // The spec hid faces past 88°, but everything past ±45° is already
    // fully clipped by the stage mask — treating those as hidden too
    // keeps invisible cards out of the keyboard tab order.
    const hidden = Math.abs(rel) > 45;
    el.style.transform = `translate(-50%, -50%) rotateY(${rel}deg) translateZ(${RADIUS}px)`;
    el.style.opacity = hidden ? 0 : 0.25 + 0.75 * Math.max(c, 0);
    el.style.zIndex = 100 + Math.round(c * 100);
    el.style.pointerEvents = hidden ? 'none' : 'auto';
    // Beyond the design: fully hide back faces so keyboards and screen
    // readers never land on an invisible card.
    el.style.visibility = hidden ? 'hidden' : 'visible';
  });

  const activeIdx = frontActiveIdx();
  activeMetaEl.textContent = projects[activeIdx].meta;
  counterEl.textContent = `0${activeIdx + 1} / 0${projects.length}`;
}

function cancelAnim() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

function animateTo(target) {
  cancelAnim();
  const from = angle;
  const d = target - from;
  if (Math.abs(d) < 0.01) {
    settlePreview();
    return;
  }
  if (reducedMotion) {
    angle = target;
    render();
    settlePreview();
    return;
  }
  const t0 = performance.now();
  const dur = 460;
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    angle = from + d * e;
    render();
    if (p < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
      settlePreview();
    }
  };
  raf = requestAnimationFrame(tick);
}

// Settle on the nearest face; `extra` carries drag momentum into the snap.
function snap(extra = 0) {
  animateTo(Math.round((angle + extra) / STEP) * STEP);
}

function onFaceClick(e, i) {
  if (suppressClick) {
    e.preventDefault();
    suppressClick = false;
    return;
  }
  const rel = normalize(i * STEP - angle);
  if (Math.abs(rel) > 10) {
    // Side card: rotate it to the front instead of following the link.
    e.preventDefault();
    animateTo(Math.round((angle + rel) / STEP) * STEP);
  }
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  cancelAnim();
  stage.classList.add('is-dragging');
  drag = { pointerId: e.pointerId, lastX: e.clientX, v: 0, captured: false };
  moved = 0;
});

stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.lastX;
  drag.lastX = e.clientX;
  moved += Math.abs(dx);
  // Capture only once this is clearly a drag. Capturing on pointerdown
  // would make the browser retarget the eventual click to the stage,
  // dead-clicking every card link.
  if (!drag.captured && moved > 5) {
    stage.setPointerCapture(drag.pointerId);
    drag.captured = true;
  }
  const dAngle = -dx * 0.28;
  drag.v = 0.7 * dAngle + 0.3 * drag.v;
  angle += dAngle;
  render();
});

function endDrag() {
  if (!drag) return;
  const v = drag.v;
  drag = null;
  stage.classList.remove('is-dragging');
  // Pointer capture already retargets the post-drag click away from the
  // card in Chrome/Firefox; this flag covers engines that don't.
  if (moved > 5) suppressClick = true;
  snap(v * 7);
}

stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// Browsers scroll even overflow:hidden boxes to reveal a focused element,
// which would shear the 3D stage sideways. Pin it.
stage.addEventListener('scroll', () => {
  stage.scrollLeft = 0;
  stage.scrollTop = 0;
});

// Horizontal trackpad swipes spin the wheel; preventDefault stops the
// browser treating them as history-swipe gestures. Vertical scrolling
// passes through untouched.
stage.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  cancelAnim();
  angle += e.deltaX * 0.35;
  render();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => snap(), 140);
}, { passive: false });

document.querySelector('.js-prev').addEventListener('click', () => {
  animateTo(Math.round(angle / STEP) * STEP - STEP);
});
document.querySelector('.js-next').addEventListener('click', () => {
  animateTo(Math.round(angle / STEP) * STEP + STEP);
});

// Place the wheel's landscape golden (φ:1) front face on the golden "eye" — the inner
// residual rectangle of the contain-fit golden spiral — at every width, and re-place it
// on resize. The whole #work is fixed-positioned and centred on the eye via
// --wheel-x/--wheel-y (styles.css html[data-wheel-placed]); its size comes from the
// residual width through --wheel-scale, which also drives the CSS geometry (stage/
// perspective/ring/face) and the JS depth (RADIUS) so the 3D registration stays exact.
const PHI = 1.6180339887498949;   // golden ratio (mirrors styles.css --phi)
const WHEEL_FACE_BASE = 250;      // mirrors the .face width base in styles.css (like BASE_RADIUS ↔ 340)
const WHEEL_DEPTH = 4;            // residual depth: R4 (even ⇒ a landscape φ:1 front face)
// Hero copy sits at the MIRROR of the wheel's eye (flipping the spiral H+V reflects
// the eye through the rect centre) and scales in lockstep with the wheel. Its scale
// is the contain-fit width ÷ HERO_REF_W — the width at which the desktop copy's
// authored px sizes read at 1× (≈ a 1512×897 laptop, where contain W ≈ 1451).
const HERO_REF_W = 1451;         // TUNABLE: contain-fit width where the copy is 1×
// Enlarged preview spans a band: from the GEN X copy's top line down to PREVIEW_GAP
// px above the wheel's visible front card (lower than the old stage-box-top glue).
const PREVIEW_GAP = 16;          // TUNABLE: px between the card's bottom and the front face
const html = document.documentElement;

// The nested residual rectangle left after `depth` whirling-square cuts of a φ:1
// rectangle, cutting squares off the LEFT, TOP, RIGHT, then BOTTOM in turn.
// Returns the residual's centre (cx, cy) and width (fw) as fractions of the whole
// rect's W and H. Even depths are landscape φ:1 (matching the face); odd are portrait.
function residualRect(depth) {
  let x = 0, y = 0, w = PHI, h = 1;   // rect is φ wide × 1 tall
  for (let i = 0; i < depth; i++) {
    const s = Math.min(w, h);
    switch (i % 4) {
      case 0: x += s; w -= s; break;   // remove the square off the LEFT
      case 1: y += s; h -= s; break;   // ...the TOP
      case 2:         w -= s; break;   // ...the RIGHT
      case 3:         h -= s; break;   // ...the BOTTOM
    }
  }
  return { cx: (x + w / 2) / PHI, cy: y + h / 2, fw: w / PHI };
}

function placeWheel() {
  // Contain-fit a φ:1 golden rectangle to the viewport (touches top/bottom or the
  // sides, whichever first), centred. The front face fills residual R_depth of it.
  const W = Math.min(window.innerWidth, window.innerHeight * PHI);
  const H = W / PHI;
  const ox = (window.innerWidth - W) / 2, oy = (window.innerHeight - H) / 2;
  const depth = WHEEL_DEPTH;
  const { cx, cy, fw } = residualRect(depth);
  // Face width == residual width. The front face nets to z=0 (ring at -340*scale,
  // face at +340*scale) so perspective magnification is 1 → CSS width == on-screen
  // width. Hence scale = residualWidth / faceBase. Fully dynamic — no floor and no
  // cap — so the whole layout tracks the window without limit in either direction.
  const scale = (fw * W) / WHEEL_FACE_BASE;
  html.style.setProperty('--wheel-scale', scale.toFixed(4));
  html.style.setProperty('--wheel-x', (ox + cx * W).toFixed(2) + 'px');
  html.style.setProperty('--wheel-y', (oy + cy * H).toFixed(2) + 'px');
  html.setAttribute('data-wheel-placed', '');   // flip CSS to the fixed-eye layout
  RADIUS = BASE_RADIUS * scale;

  // Hero copy → the diagonally-opposite (mirror) eye, scaled with the viewport (no floor/cap).
  const heroScale = W / HERO_REF_W;
  html.style.setProperty('--hero-scale', heroScale.toFixed(4));
  html.style.setProperty('--hero-x', (ox + (1 - cx) * W).toFixed(2) + 'px');
  html.style.setProperty('--hero-y', (oy + (1 - cy) * H).toFixed(2) + 'px');
  html.setAttribute('data-hero-placed', '');

  // Enlarged preview band: top = the GEN X copy's top line, bottom = a small gap
  // above the wheel's front face. Expressed as offsets from #work (the preview's
  // absolute containing block). Measured AFTER the wheel+hero vars above are set,
  // so getBoundingClientRect reflects this frame's transforms.
  const frontCardH = (fw * W) / PHI;                        // landscape φ:1 front face height
  const bandBottom = (oy + cy * H) - frontCardH / 2 - PREVIEW_GAP;  // viewport y
  const workRect = workEl.getBoundingClientRect();
  const heroTop = heroCopy.getBoundingClientRect().top;
  html.style.setProperty('--preview-top', (heroTop - workRect.top).toFixed(2) + 'px');
  html.style.setProperty('--preview-bottom', (workRect.bottom - bandBottom).toFixed(2) + 'px');
}

// Fill the enlarged card, then place + size the wheel and lay out the faces at the
// resulting depth.
settlePreview();
placeWheel();
render();

// Re-place on resize / rotate; render() re-lays the faces at the new depth.
addEventListener('resize', () => { placeWheel(); render(); });

// The hero copy + card reflow once the web fonts load (title/blurb change height);
// re-place then so the band offsets are measured against the real fonts, not the
// fallback-font ones.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { placeWheel(); render(); });
}

// Theme control: two native radios select light/dark. Applying = set data-theme on
// <html> and persist. The initial theme is set pre-paint by the head script; here we
// just check the matching radio and react to changes. localStorage key 'theme' is
// shared with the head script.
const themeRadios = document.querySelectorAll('.js-theme-radio');

function syncThemeControl() {
  const theme = document.documentElement.dataset.theme;
  themeRadios.forEach((radio) => { radio.checked = radio.value === theme; });
}

themeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    document.documentElement.dataset.theme = radio.value;
    localStorage.setItem('theme', radio.value);
  });
});

syncThemeControl();

// CRT power: a native checkbox toggles the phosphor overlay. Same shape as the
// theme control — the initial state is applied pre-paint by the head script
// (data-crt on <html>, localStorage key 'crt', default on); here we sync the
// checkbox to it and persist changes.
const crtToggle = document.querySelector('.js-crt-toggle');

function syncCrtControl() {
  crtToggle.checked = document.documentElement.dataset.crt !== 'off';
}

crtToggle.addEventListener('change', () => {
  const state = crtToggle.checked ? 'on' : 'off';
  document.documentElement.dataset.crt = state;
  localStorage.setItem('crt', state);
});

syncCrtControl();
